const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');
const {
    markUserTrusted,
    untrustUser,
    getUserTrustRecord,
} = require('../../infrastructure/storage/normalMessageTracker.js');

function parseTelegramUserId(text) {
    const value = String(text || '').trim().split(/\s+/)[1];
    return /^\d+$/.test(value || '') && value !== '0' ? value : null;
}

async function handleTrustUser(msg, bot, dependencies = {}) {
    const trust = dependencies.markUserTrusted || markUserTrusted;
    const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
    const userId = parseTelegramUserId(msg.text);
    if (!userId) {
        await sendPrompt(bot, msg.chat.id, 'Usage: /trustuser <telegram_user_id>');
        return;
    }
    await trust(userId, `admin:${msg.from.id}`);
    await sendPrompt(bot, msg.chat.id, `User ${userId} is now trusted.`);
}

async function handleUntrustUser(msg, bot, dependencies = {}) {
    const untrust = dependencies.untrustUser || untrustUser;
    const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
    const userId = parseTelegramUserId(msg.text);
    if (!userId) {
        await sendPrompt(bot, msg.chat.id, 'Usage: /untrustuser <telegram_user_id>');
        return;
    }
    await untrust(userId, `admin:${msg.from.id}`);
    await sendPrompt(bot, msg.chat.id, `User ${userId} is now untrusted.`);
}

async function handleTrustStatus(msg, bot, dependencies = {}) {
    const getRecord = dependencies.getUserTrustRecord || getUserTrustRecord;
    const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
    const userId = parseTelegramUserId(msg.text);
    if (!userId) {
        await sendPrompt(bot, msg.chat.id, 'Usage: /truststatus <telegram_user_id>');
        return;
    }
    const record = await getRecord(userId);
    if (!record) {
        await sendPrompt(bot, msg.chat.id, `User ${userId} has no trust record.`);
        return;
    }
    await sendPrompt(
        bot,
        msg.chat.id,
        `User ${userId}: ${record.trusted ? 'trusted' : 'untrusted'} (normal streak: ${record.streak}).`
    );
}

module.exports = {
    parseTelegramUserId,
    handleTrustUser,
    handleUntrustUser,
    handleTrustStatus,
};
