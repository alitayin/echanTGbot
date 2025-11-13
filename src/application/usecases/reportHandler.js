const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');
const {
  getBotIsAdmin,
  forwardOrCopyToLogGroup,
  deleteMessageSafe,
  sendChatNotification,
  sendLogGroupReport,
} = require('../../infrastructure/telegram/reportingActions.js');

async function handleReportCommand(msg, bot) {
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

  await forwardOrCopyToLogGroup(bot, NOTIFICATION_GROUP_ID, original, msg.chat.id, groupName);

  await deleteMessageSafe(bot, msg.chat.id, original.message_id);

  const reporterUsername = msg.from.username;
  const notificationMessage = `Thanks for the report @${reporterUsername}, I've removed the spam message.`;
  await sendChatNotification(bot, msg.chat.id, notificationMessage);

  const targetUsername = original.from?.username || 'unknown';
  const reportInfo = `Reported message from @${targetUsername} deleted by me, report by @${reporterUsername}`;
  await sendLogGroupReport(bot, NOTIFICATION_GROUP_ID, reportInfo);
}

module.exports = {
  handleReportCommand,
};


