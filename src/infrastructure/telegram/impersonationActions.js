// Telegram operations for impersonation detection
// Infrastructure layer module

const { TELEGRAM_TOKEN } = require('../../../config/config.js');

/**
 * Get chat administrators
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @returns {Promise<Array>} Array of admin data
 */
async function getChatAdmins(bot, chatId) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        return admins
            .filter(admin => !admin.user.is_bot)
            .map(admin => ({
                userId: admin.user.id,
                username: admin.user.username ? admin.user.username.toLowerCase() : null,
                firstName: admin.user.first_name || '',
                lastName: admin.user.last_name || '',
                fullName: `${admin.user.first_name || ''} ${admin.user.last_name || ''}`.trim()
            }));
    } catch (error) {
        console.error(`Failed to get admin list for group ${chatId}:`, error.message);
        return [];
    }
}

/**
 * Get user avatar URL
 * @param {Object} bot - Telegram bot instance
 * @param {number} userId - User ID
 * @returns {Promise<string|null>} Avatar URL or null
 */
async function getUserAvatarUrl(bot, userId) {
    try {
        const photos = await bot.getUserProfilePhotos(userId, { limit: 1 });
        if (photos.total_count === 0) {
            return null;
        }
        
        const photo = photos.photos[0];
        const largestPhoto = photo[photo.length - 1];
        const file = await bot.getFile(largestPhoto.file_id);
        return `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    } catch (error) {
        console.error('Failed to get user avatar:', error.message);
        return null;
    }
}

/**
 * Get chat member information
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Member info or null
 */
async function getChatMemberInfo(bot, chatId, userId) {
    try {
        const member = await bot.getChatMember(chatId, userId);
        return {
            userId: member.user.id,
            firstName: member.user.first_name || '',
            lastName: member.user.last_name || '',
            fullName: `${member.user.first_name || ''} ${member.user.last_name || ''}`.trim(),
            username: member.user.username || null,
            status: member.status
        };
    } catch (error) {
        console.error('Failed to get user info:', error.message);
        return null;
    }
}

/**
 * Check if bot has admin rights
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @returns {Promise<boolean>}
 */
async function isBotAdmin(bot, chatId) {
    try {
        const botInfo = await bot.getMe();
        const botMember = await bot.getChatMember(chatId, botInfo.id);
        return ['creator', 'administrator'].includes(botMember.status);
    } catch (error) {
        console.error('Failed to check bot permissions:', error.message);
        return false;
    }
}

/**
 * Ban user from chat
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
async function banUser(bot, chatId, userId) {
    try {
        await bot.banChatMember(chatId, userId);
        return true;
    } catch (error) {
        console.error('Failed to ban user:', error.message);
        return false;
    }
}

/**
 * Send message to chat
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} text - Message text
 * @returns {Promise<boolean>}
 */
async function sendMessage(bot, chatId, text) {
    try {
        await bot.sendMessage(chatId, text);
        return true;
    } catch (error) {
        console.error('Failed to send message:', error.message);
        return false;
    }
}

module.exports = {
    getChatAdmins,
    getUserAvatarUrl,
    getChatMemberInfo,
    isBotAdmin,
    banUser,
    sendMessage
};


