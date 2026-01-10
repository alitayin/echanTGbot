const { banUser, unbanUser } = require('../../infrastructure/telegram/adminActions.js');

function buildSpamModerationButtons({ chatId, userId, showBan = false, showUnban = false }) {
  const buttons = [];

  if (showBan) {
    buttons.push({
      text: '🚫 Ban',
      callback_data: `spam_action:ban:${chatId}:${userId}`,
    });
  }

  if (showUnban) {
    buttons.push({
      text: '♻️ Unban',
      callback_data: `spam_action:unban:${chatId}:${userId}`,
    });
  }

  if (!buttons.length) {
    return null;
  }

  return {
    reply_markup: {
      inline_keyboard: [buttons],
    },
  };
}

async function handleSpamModerationCallback(query, bot) {
  try {
    const parts = query.data.split(':');
    if (parts.length < 4) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Invalid moderation action',
        show_alert: true,
      });
      return;
    }

    const action = parts[1];
    const chatId = Number(parts[2]);
    const userId = Number(parts[3]);

    if (Number.isNaN(chatId) || Number.isNaN(userId)) {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Invalid target info',
        show_alert: true,
      });
      return;
    }

    let success = false;
    let successText = '';
    let failText = '';

    if (action === 'ban') {
      success = await banUser(bot, chatId, userId);
      successText = '✅ User banned';
      failText = '❌ Failed to ban user (check bot admin rights)';
    } else if (action === 'unban') {
      success = await unbanUser(bot, chatId, userId);
      successText = '✅ User unbanned';
      failText = '❌ Failed to unban user (check bot admin rights)';
    } else {
      await bot.answerCallbackQuery(query.id, {
        text: '❌ Unsupported action',
        show_alert: true,
      });
      return;
    }

    if (success && query.message?.text) {
      // After ban, keep an Unban button for quick reversal; after unban, clear buttons
      const replyMarkup =
        action === 'ban'
          ? {
              inline_keyboard: [[{
                text: '♻️ Unban',
                callback_data: `spam_action:unban:${chatId}:${userId}`,
              }]],
            }
          : { inline_keyboard: [] };

      const actor =
        query.from.username
          ? `@${query.from.username}`
          : query.from.first_name || 'admin';

      const statusLine =
        action === 'ban'
          ? `Action: banned by ${actor}`
          : `Action: unbanned by ${actor}`;

      const existingText = query.message.text;
      const alreadyNoted = existingText.includes(statusLine);
      const updatedText = alreadyNoted
        ? existingText
        : `${existingText}\n\n${statusLine}`;

      await bot.editMessageText(updatedText, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: replyMarkup,
      });
    }

    await bot.answerCallbackQuery(query.id, {
      text: success ? successText : failText,
      show_alert: !success,
    });
  } catch (error) {
    console.error('Failed to handle spam moderation callback:', error);
    await bot.answerCallbackQuery(query.id, {
      text: '❌ Error processing action',
      show_alert: true,
    });
  }
}

module.exports = {
  buildSpamModerationButtons,
  handleSpamModerationCallback,
};


