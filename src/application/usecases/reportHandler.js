const { KOUSH_USER_ID, ALITAYIN_USER_ID } = require('../../../config/config.js');
const {
  getBotIsAdmin,
  forwardOrCopyToAdmin,
  deleteMessageSafe,
  sendChatNotification,
  sendAdminReports,
} = require('../../infrastructure/telegram/reportingActions.js');

/** Handle /report: forward, delete, notify. */
async function handleReportCommand(msg, bot) {
  // Must be a reply
  if (!msg.reply_to_message) {
    await sendChatNotification(bot, msg.chat.id, "Please reply to the message you want to report, then send /report.");
    return;
  }

  const isBotAdmin = await getBotIsAdmin(bot, msg.chat.id);
  if (!isBotAdmin) {
    await sendChatNotification(bot, msg.chat.id, "I need admin rights to delete messages. Please make me an admin first.");
    return;
  }

  const original = msg.reply_to_message;
  const groupName = msg.chat.title || 'Unknown Group';

  // Prefer forwarding to ALITAYIN, optionally to KOUSH
  await forwardOrCopyToAdmin(bot, ALITAYIN_USER_ID, original, msg.chat.id, groupName);

  // Best-effort delete original message
  await deleteMessageSafe(bot, msg.chat.id, original.message_id);

  // Notify chat and admins
  const reporterUsername = msg.from.username;
  const notificationMessage = `Thanks for the report @${reporterUsername}, I've removed the spam message.`;
  await sendChatNotification(bot, msg.chat.id, notificationMessage);

  const targetUsername = original.from?.username || 'unknown';
  const reportInfo = `Reported message from @${targetUsername} deleted by me, report by @${reporterUsername}`;
  await sendAdminReports(bot, reportInfo, [KOUSH_USER_ID, ALITAYIN_USER_ID]);
}

module.exports = {
  handleReportCommand,
};


