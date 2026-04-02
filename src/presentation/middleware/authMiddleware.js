const { ALLOWED_USERS } = require('../../../config/config.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

/**
 * Authorization middleware factory
 */
function createAuthMiddleware(options = {}) {
    const {
        requireAdmin = false,
        requireReporter = false,
        allowedUsers = [],
        customCheck = null
    } = options;

    return async (msg, bot, next) => {
        // Custom authorization check
        if (customCheck) {
            const allowed = await customCheck(msg, bot);
            if (!allowed) {
                await sendPromptMessage(bot, msg.chat.id, '❌ You are not authorized to use this command.');
                return;
            }
            return next();
        }

        // Admin check
        if (requireAdmin) {
            if (!ALLOWED_USERS.includes(msg.from.username)) {
                await sendPromptMessage(bot, msg.chat.id, '❌ This command is only available to administrators.');
                return;
            }
        }

        // Allowed users check
        if (allowedUsers.length > 0) {
            if (!allowedUsers.includes(msg.from.username)) {
                await sendPromptMessage(bot, msg.chat.id, '❌ You are not authorized to use this command.');
                return;
            }
        }

        return next();
    };
}

/**
 * Limited mode middleware
 */
function createLimitedModeMiddleware(LIMITED_MODE, disabledMessages) {
    return async (msg, bot, next) => {
        if (LIMITED_MODE) {
            const randomMsg = disabledMessages[Math.floor(Math.random() * disabledMessages.length)];
            await sendPromptMessage(bot, msg.chat.id, randomMsg);
            return;
        }
        return next();
    };
}

/**
 * Group-only middleware
 */
function groupOnlyMiddleware(msg, bot, next) {
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (!isGroup) {
        return;
    }
    return next();
}

/**
 * Private-only middleware
 */
function privateOnlyMiddleware(msg, bot, next) {
    if (msg.chat.type !== 'private') {
        return;
    }
    return next();
}

module.exports = {
    createAuthMiddleware,
    createLimitedModeMiddleware,
    groupOnlyMiddleware,
    privateOnlyMiddleware
};
