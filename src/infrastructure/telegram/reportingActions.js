// Infrastructure helpers for report flow: admin check, forward or copy, delete, notifications

async function getBotIsAdmin(bot, chatId) {
  try {
    const botInfo = await bot.getMe();
    const botMember = await bot.getChatMember(chatId, botInfo.id);
    return ['creator', 'administrator'].includes(botMember.status);
  } catch (error) {
    if (error?.message?.includes('CHAT_ADMIN_REQUIRED')) {
      return false;
    }
    return false;
  }
}

async function forwardOrCopyToAdmin(bot, adminId, originalMsg, sourceChatId, groupName) {
  try {
    await bot.forwardMessage(adminId, sourceChatId, originalMsg.message_id);
    return true;
  } catch (e) {
    const desc = e?.response?.body?.description || e?.message || '';
    const reportedFrom = originalMsg.from?.username ? `@${originalMsg.from.username}` : (originalMsg.from?.first_name || 'Unknown');
    const header = `Reported message from ${reportedFrom} in "${groupName}" (fallback copy)`;

    if (originalMsg.photo && originalMsg.photo.length > 0) {
      const largestPhoto = originalMsg.photo[originalMsg.photo.length - 1];
      const cap = originalMsg.caption ? `${header}\n\n${originalMsg.caption}` : header;
      await bot.sendPhoto(adminId, largestPhoto.file_id, { caption: cap });
      return true;
    } else if (originalMsg.text) {
      await bot.sendMessage(adminId, `${header}\n\n${originalMsg.text}`);
      return true;
    } else if (originalMsg.caption && originalMsg.document) {
      await bot.sendDocument(adminId, originalMsg.document.file_id, { caption: `${header}\n\n${originalMsg.caption}` });
      return true;
    } else {
      await bot.sendMessage(adminId, `${header}\n\n[Unsupported content type; forward failed: ${desc}]`);
      return false;
    }
  }
}

async function deleteMessageSafe(bot, chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
    return true;
  } catch (e) {
    return false;
  }
}

async function sendChatNotification(bot, chatId, notificationMessage) {
  try {
    await bot.sendMessage(chatId, notificationMessage);
  } catch (_) {
    // ignore
  }
}

async function sendAdminReports(bot, reportText, adminIds = []) {
  for (const adminId of adminIds) {
    if (!adminId) continue;
    try {
      await bot.sendMessage(adminId, reportText);
    } catch (_) {
      // ignore individual admin failures
    }
  }
}

module.exports = {
  getBotIsAdmin,
  forwardOrCopyToAdmin,
  deleteMessageSafe,
  sendChatNotification,
  sendAdminReports,
};


