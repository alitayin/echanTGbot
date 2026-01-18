const { AUTO_DELETE_PROMPT_MS } = require('../../../config/config.js');

function resolveAutoDeleteDelayMs(options = {}) {
    if (options.disableAutoDelete === true) {
        return 0;
    }
    if (Number.isFinite(options.autoDeleteAfterMs)) {
        return Math.max(0, options.autoDeleteAfterMs);
    }
    return AUTO_DELETE_PROMPT_MS;
}

function scheduleAutoDelete(bot, chatId, messageId, delayMs) {
    if (!bot || !chatId || !messageId || !delayMs || delayMs <= 0) {
        return;
    }
    setTimeout(() => {
        bot.deleteMessage(chatId, messageId).catch(() => {});
    }, delayMs);
}

module.exports = {
    resolveAutoDeleteDelayMs,
    scheduleAutoDelete
};

