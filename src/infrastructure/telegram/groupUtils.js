const { ALITAYIN_USER_ID } = require('../../../config/config.js');

async function isGroupWithAlitayin(chatId, bot) {
    try {
        // Check bot admin first
        const botInfo = await bot.getMe();
        const botMember = await bot.getChatMember(chatId, botInfo.id);
        const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);
        
        if (!isBotAdmin) {
            console.log(`Bot is not admin in chat ${chatId}, skipping member check`);
            return false;
        }
        
        // If admin, check if alitayin is in group
        const member = await bot.getChatMember(chatId, ALITAYIN_USER_ID);
        return member.status !== 'left' && member.status !== 'kicked';
    } catch (error) {
        if (error.message.includes('CHAT_ADMIN_REQUIRED')) {
            console.log(`Bot needs admin rights in chat ${chatId} to check members`);
            return false;
        }
        console.error(`Error checking member status: ${error}`);
        return false;
    }
}

module.exports = {
    isGroupWithAlitayin,
};
