const { resolveAutoDeleteDelayMs, scheduleAutoDelete } = require('./autoDeleteManager.js');

function sanitizeOptions(options = {}) {
    if (!options || typeof options !== 'object') {
        return {};
    }
    const { autoDeleteAfterMs, disableAutoDelete, ...rest } = options;
    return rest;
}

async function sendPromptMessage(bot, chatId, text, options = {}) {
    const delayMs = resolveAutoDeleteDelayMs(options);
    const safeOptions = sanitizeOptions(options);
    const message = await bot.sendMessage(chatId, text, safeOptions);
    if (message && message.message_id) {
        scheduleAutoDelete(bot, chatId, message.message_id, delayMs);
    }
    return message;
}

module.exports = {
    sendPromptMessage
};

