// Telegram messaging operations
// Infrastructure layer module

/**
 * Send a message to a chat
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Object} options - Additional options (parse_mode, etc.)
 * @returns {Promise<Object>} Message object
 */
async function sendMessage(bot, chatId, text, options = {}) {
    try {
        return await bot.sendMessage(chatId, text, options);
    } catch (error) {
        console.error('Failed to send message:', error.message);
        throw error;
    }
}

/**
 * Edit an existing message
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID to edit
 * @param {string} text - New message text
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Edited message object
 */
async function editMessageText(bot, chatId, messageId, text, options = {}) {
    try {
        return await bot.editMessageText(text, {
            chat_id: chatId,
            message_id: messageId,
            ...options
        });
    } catch (error) {
        console.error('Failed to edit message:', error.message);
        throw error;
    }
}

module.exports = {
    sendMessage,
    editMessageText
};


