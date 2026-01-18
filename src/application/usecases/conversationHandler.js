const {
  TELEGRAM_TOKEN,
  GLOBAL_CONCURRENCY,
  REQUEST_INTERVAL_MS,
  DAILY_LIMIT,
  DAILY_WINDOW_MS,
} = require('../../../config/config.js');
const { createRateLimiter } = require('../services/rateLimiter.js');
const { getPhotoUrl } = require('../../infrastructure/telegram/mediaHelper.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

const userConversationIds = {};

const limiter = createRateLimiter({
  concurrency: GLOBAL_CONCURRENCY,
  requestIntervalMs: REQUEST_INTERVAL_MS,
  dailyLimit: DAILY_LIMIT,
  dailyWindowMs: DAILY_WINDOW_MS,
});
const limiterConfig = limiter.getConfig();

function escapeMarkdownV2(text) {
  if (text == null) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}\.!\\])/g, '\\$1');
}

function chunkText(text, maxLen = 3800) {
  if (!text) return [""];
  const chunks = [];
  let remaining = String(text);
  while (remaining.length > maxLen) {
    let cut = remaining.lastIndexOf('\n', maxLen);
    if (cut === -1 || cut < maxLen * 0.5) {
      cut = maxLen;
    }
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendLongMessage(bot, chatId, text, baseOptions = {}, onChunkSent) {
  const chunks = chunkText(text, 3800);
  for (const [index, chunk] of chunks.entries()) {
    try {
      await bot.sendMessage(chatId, chunk, { ...baseOptions, parse_mode: "Markdown" });
    } catch (mdError) {
      try {
        console.log('Markdown failed, trying MarkdownV2:', mdError.message);
        const safeV2 = escapeMarkdownV2(chunk);
        await bot.sendMessage(chatId, safeV2, { ...baseOptions, parse_mode: "MarkdownV2" });
      } catch (markdownError) {
        console.log('MarkdownV2 failed, fallback to plain text:', markdownError.message);
        await bot.sendMessage(chatId, chunk, { ...baseOptions });
      }
    }
    if (typeof onChunkSent === 'function') {
      onChunkSent(chunk, index === chunks.length - 1);
    }
  }
}

async function handleRequestIfAllowed(msg, query, bot, ALLOWED_USERS, BLOCKED_USERS, ports) {
  const userId = msg.from.id;
  const username = msg.from.username;

  if (BLOCKED_USERS && BLOCKED_USERS.includes(username)) {
    console.log(`User ${username} is blacklisted, rejecting request`);
    await sendPromptMessage(
      msg.chat.id,
      "Sorry, your account is restricted from using this feature. Please contact admin if you have questions.",
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  const bypass = ALLOWED_USERS.includes(username);
  const check = limiter.checkAndConsume({ userId, username, bypass });
  if (!check.allowed) {
    if (check.reason === 'cooldown') {
      await sendPromptMessage(
        msg.chat.id,
        `I'm spacing out right now. will be back to u in ${check.secondsLeft} seconds.`
      );
      return;
    }
    if (check.reason === 'quota') {
      const ms = check.msUntilReset || 0;
      const hoursLeft = Math.ceil(ms / (60 * 60 * 1000));
      const minutesLeft = Math.ceil(ms / (60 * 1000)) % 60;
      console.log(`User ${username} reached 24h request limit`);
      await sendPromptMessage(
        msg.chat.id,
        `You have reached the maximum number of requests (${limiterConfig.dailyLimit}) for 24 hours.\nPlease try again in approximately ${hoursLeft} hours and ${minutesLeft} minutes.`,
        { reply_to_message_id: msg.message_id }
      );
      return;
    }
    return;
  }

  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  const skipUsername = msg.text.includes("🎲") || msg.text.includes("⚽") || msg.text.toLowerCase().includes("Dice");

  limiter.enqueue(async () => {
    try {
      const response = await ports.chat.sendText(
        query,
        userId,
        userConversationIds[userId] || ""
      );

      userConversationIds[userId] = response.conversation_id;
      let result = response.answer.replace(/\*\*(.*?)\*\*/g, '*$1*');

      const reply = isGroup ? `${skipUsername ? '' : (username ? `@${username}` : msg.from.first_name)} ${result}`.trim() : result;

      await sendLongMessage(
        bot,
        msg.chat.id,
        reply,
        { reply_to_message_id: msg.message_id },
        (sentChunk) => bot.emit('send_message', msg.chat.id, sentChunk)
      );
      console.log('Conversation request completed');
    } catch (error) {
      console.error('Conversation request failed:', error.message);
      if (error.response) {
        const status = error.response.status;
        if ([400, 500, 502].includes(status) ||
            (status === 404 && error.response.data.message === 'Conversation Not Exists.')) {
          delete userConversationIds[userId];
        await sendPromptMessage(
            msg.chat.id,
            "Starting a new conversation. Please try your message again.",
            { reply_to_message_id: msg.message_id }
          );
          bot.emit('send_message', msg.chat.id, "Starting a new conversation. Please try your message again.");
        } else {
        await sendPromptMessage(
            msg.chat.id,
            "An error occurred. Please try again.",
            { reply_to_message_id: msg.message_id }
          );
          bot.emit('send_message', msg.chat.id, "An error occurred. Please try again.");
        }
      } else {
      await sendPromptMessage(
          msg.chat.id,
          "Network error. Please try again later.",
          { reply_to_message_id: msg.message_id }
        );
        bot.emit('send_message', msg.chat.id, "Network error. Please try again later.");
      }
    }
  }).catch(() => {});
}

async function handlePhotoMessage(msg, photo, query, bot, ALLOWED_USERS, BLOCKED_USERS, ports) {
  const userId = msg.from.id;
  const username = msg.from.username;

  if (BLOCKED_USERS && BLOCKED_USERS.includes(username)) {
    console.log(`User ${username} is blacklisted, rejecting photo request`);
    await sendPromptMessage(
      msg.chat.id,
      "Sorry, your account is restricted from using this feature. Please contact admin if you have questions.",
      { reply_to_message_id: msg.message_id }
    );
    return;
  }

  const bypass = ALLOWED_USERS.includes(username);
  const check = limiter.checkAndConsume({ userId, username, bypass });
  if (!check.allowed) {
    if (check.reason === 'cooldown') {
      await sendPromptMessage(
        msg.chat.id,
        `I'm spacing out right now. will be back to u in ${check.secondsLeft} seconds.`
      );
      return;
    }
    if (check.reason === 'quota') {
      const ms = check.msUntilReset || 0;
      const hoursLeft = Math.ceil(ms / (60 * 60 * 1000));
      const minutesLeft = Math.ceil(ms / (60 * 1000)) % 60;
      console.log(`User ${username} reached 24h photo request limit`);
      await sendPromptMessage(
        msg.chat.id,
        `You have reached the maximum number of requests (${limiterConfig.dailyLimit}) for 24 hours.\nPlease try again in approximately ${hoursLeft} hours and ${minutesLeft} minutes.`,
        { reply_to_message_id: msg.message_id }
      );
      return;
    }
    return;
  }

  const fileUrl = await getPhotoUrl(bot, photo.file_id, TELEGRAM_TOKEN);

  limiter.enqueue(async () => {
    try {
      const response = await ports.chat.sendImage(
        fileUrl,
        query,
        userId,
        userConversationIds[userId] || ""
      );

      userConversationIds[userId] = response.conversation_id;
      const result = response.answer;

      await sendLongMessage(
        bot,
        msg.chat.id,
        result,
        {},
        (sentChunk) => bot.emit('send_message', msg.chat.id, sentChunk)
      );
    } catch (error) {
      console.error('Photo request failed:', error.message);
      if (error.response) {
        const status = error.response.status;
        if ([400, 500, 502].includes(status) ||
            (status === 404 && error.response.data.message === 'Conversation Not Exists.')) {
          delete userConversationIds[userId];
          await sendPromptMessage(
            msg.chat.id,
            "Starting a new conversation. Please send your image again."
          );
          bot.emit('send_message', msg.chat.id, "Starting a new conversation. Please send your image again.");
        } else {
          await sendPromptMessage(
            msg.chat.id,
            "An error occurred while processing the image. Please try again."
          );
          bot.emit('send_message', msg.chat.id, "An error occurred while processing the image. Please try again.");
        }
      } else {
        await sendPromptMessage(
          msg.chat.id,
          "Network error while processing image. Please try again later."
        );
        bot.emit('send_message', msg.chat.id, "Network error while processing image. Please try again later.");
      }
    }
  }).catch(() => {});
}

module.exports = {
  handleRequestIfAllowed,
  handlePhotoMessage,
  userConversationIds
};


