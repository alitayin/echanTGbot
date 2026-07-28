const {
  ALLOWED_USERS,
  BOT_USERNAME,
  TARGET_GROUP_IDS,
} = require('../../../config/config.js');
const { detectNonEnglish } = require('../../domain/utils/languageDetect.js');
const { isUserTrusted } = require('../../infrastructure/storage/normalMessageTracker.js');
const {
  translateText,
  translateToEnglishIfTargetGroup,
} = require('../../infrastructure/ai/translation.js');
const { recordTranslationLink } = require('../../infrastructure/storage/translationLinkStore.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

function isTranslateCommand(msg) {
  const text = String(msg?.text || '').trim();
  const botSuffix = BOT_USERNAME ? `(?:@${BOT_USERNAME})?` : '';
  return new RegExp(`^/translate${botSuffix}(?:\\s|$)`, 'i').test(text);
}

async function isTrustedTranslationUser(msg, dependencies = {}) {
  const allowedUsers = dependencies.allowedUsers || ALLOWED_USERS;
  const checkTrusted = dependencies.isUserTrusted || isUserTrusted;
  const username = msg?.from?.username;
  if (username && allowedUsers.includes(username)) {
    return true;
  }
  return checkTrusted(msg?.from?.id);
}

function shouldSkipAutoTranslation(msg) {
  if (!msg?.from || msg.from.is_bot) return true;
  const text = String(msg.text || msg.caption || '').trim();
  if (!text || text.startsWith('/')) return true;
  if (BOT_USERNAME && text.includes(`@${BOT_USERNAME}`)) return true;
  if (/\bechan\b/i.test(text)) return true;
  return msg.reply_to_message?.from?.username === BOT_USERNAME;
}

async function handleTrustedAutoTranslation(msg, bot, dependencies = {}) {
  const targetGroupIds = dependencies.targetGroupIds || TARGET_GROUP_IDS;
  const detectLanguage = dependencies.detectNonEnglish || detectNonEnglish;
  const translateToEnglish = dependencies.translateToEnglishIfTargetGroup
    || translateToEnglishIfTargetGroup;
  const isGroup = msg?.chat?.type === 'group' || msg?.chat?.type === 'supergroup';
  if (!isGroup || !targetGroupIds.includes(String(msg.chat.id))) return false;
  if (shouldSkipAutoTranslation(msg)) return false;
  if (!await isTrustedTranslationUser(msg, dependencies)) return false;

  const detection = detectLanguage(msg);
  if (!detection.shouldCheckWithApi) return false;
  return translateToEnglish(msg, bot);
}

async function handleTranslateCommand(msg, bot, dependencies = {}) {
  const runTranslation = dependencies.translateText || translateText;
  const saveTranslationLink = dependencies.recordTranslationLink || recordTranslationLink;
  const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
  if (!isTranslateCommand(msg)) return false;
  if (!await isTrustedTranslationUser(msg, dependencies)) {
    await sendPrompt(bot, msg.chat.id, 'Translation is available to trusted users only.', {
      reply_to_message_id: msg.message_id,
    });
    return true;
  }

  const commandArgs = String(msg.text || '')
    .replace(/^\/translate(?:@[^\s]+)?/i, '')
    .trim();
  const replied = msg.reply_to_message;
  const sourceText = replied
    ? String(replied.text || replied.caption || '').trim()
    : commandArgs;
  const targetLanguage = replied ? (commandArgs || 'English') : 'English';

  if (!sourceText) {
    await sendPrompt(
      bot,
      msg.chat.id,
      'Reply to a message with /translate [language], or use /translate <text>.',
      { reply_to_message_id: msg.message_id }
    );
    return true;
  }

  try {
    const translatedText = await runTranslation(sourceText, targetLanguage, msg.from.id);
    if (!translatedText) throw new Error('Empty translation response');
    const originalMessageId = replied?.message_id || msg.message_id;
    const sent = await bot.sendMessage(msg.chat.id, `🔄 Translation: ${translatedText}`, {
      reply_to_message_id: originalMessageId,
    });
    await saveTranslationLink(msg.chat.id, originalMessageId, sent?.message_id);
  } catch (error) {
    console.error('Translate command failed:', error.message || error);
    await sendPrompt(bot, msg.chat.id, 'Translation failed. Please try again later.', {
      reply_to_message_id: msg.message_id,
    });
  }
  return true;
}

module.exports = {
  isTranslateCommand,
  isTrustedTranslationUser,
  handleTrustedAutoTranslation,
  handleTranslateCommand,
};
