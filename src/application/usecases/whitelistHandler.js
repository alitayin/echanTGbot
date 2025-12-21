const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');
const { addWhitelistKeyword, removeWhitelistKeyword, getAllWhitelistKeywords } = require('../../infrastructure/storage/whitelistKeywordStore.js');

/**
 * Handle /whitelisting command
 * @param {object} msg - Telegram message object
 * @param {object} bot - Telegram bot instance
 */
async function handleWhitelistingCommand(msg, bot) {
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    
    // Parse the command: /whitelisting <keyword>
    const parts = msg.text.trim().split(/\s+/);
    
    if (parts.length < 2) {
        await bot.sendMessage(
            msg.chat.id,
            '❌ Usage: /whitelisting <keyword>\n\nExample: /whitelisting ecash'
        );
        return;
    }
    
    // Get the keyword (everything after the command)
    const keyword = parts.slice(1).join(' ').trim();
    
    if (!keyword) {
        await bot.sendMessage(
            msg.chat.id,
            '❌ Please provide a keyword to whitelist.'
        );
        return;
    }
    
    // Send confirmation to the user
    await bot.sendMessage(
        msg.chat.id,
        `✅ Your whitelist request for keyword "${keyword}" has been submitted for review.`
    );
    
    // Send approval request to notification group
    const requestMessage = `🔔 Whitelist Keyword Request\n\n` +
        `Keyword: "${keyword}"\n` +
        `Requested by: @${username} (ID: ${userId})\n` +
        `From group: ${msg.chat.title || 'Direct Message'}\n\n` +
        `Please approve or reject this request:`;
    
    const approvalButtons = {
        reply_markup: {
            inline_keyboard: [
                [
                    {
                        text: '✅ Approve',
                        callback_data: `whitelist_approve:${keyword}:${username}`
                    },
                    {
                        text: '❌ Reject',
                        callback_data: `whitelist_reject:${keyword}:${username}`
                    }
                ]
            ]
        }
    };
    
    try {
        await bot.sendMessage(NOTIFICATION_GROUP_ID, requestMessage, approvalButtons);
        console.log(`Whitelist request sent: "${keyword}" by ${username}`);
    } catch (error) {
        // Gracefully report configuration/delivery issues to the requester
        const tgDescription = error?.response?.body?.description || error.message || 'Unknown error';
        console.error('Failed to forward whitelist request to notification group:', tgDescription);
        await bot.sendMessage(
            msg.chat.id,
            `❌ Failed to submit whitelist request for review.\nReason: ${tgDescription}\n\n` +
            'Please contact an admin to verify NOTIFICATION_GROUP_ID and that the bot is in the notification group.'
        );
        return;
    }
}

/**
 * Handle whitelist approval/rejection callbacks
 * @param {object} query - Telegram callback query
 * @param {object} bot - Telegram bot instance
 */
async function handleWhitelistCallback(query, bot) {
    const callbackData = query.data;
    const adminUsername = query.from.username || query.from.first_name || 'Admin';
    
    // Parse callback data: whitelist_approve:keyword:username or whitelist_reject:keyword:username
    const [action, keyword, requesterUsername] = callbackData.replace('whitelist_', '').split(':');
    
    if (action === 'approve') {
        // Add keyword to whitelist
        const success = await addWhitelistKeyword(keyword, requesterUsername);
        
        if (success) {
            // Update the message to show it's been approved
            const approvedMessage = `✅ APPROVED\n\n` +
                `Keyword: "${keyword}"\n` +
                `Requested by: @${requesterUsername}\n` +
                `Approved by: @${adminUsername}\n\n` +
                `This keyword will now bypass spam detection.`;
            
            await bot.editMessageText(approvedMessage, {
                chat_id: query.message.chat.id,
                message_id: query.message.message_id
            });
            
            await bot.answerCallbackQuery(query.id, {
                text: `✅ Keyword "${keyword}" has been whitelisted`
            });
        } else {
            await bot.answerCallbackQuery(query.id, {
                text: '❌ Failed to add keyword to whitelist',
                show_alert: true
            });
        }
    } else if (action === 'reject') {
        // Update the message to show it's been rejected
        const rejectedMessage = `❌ REJECTED\n\n` +
            `Keyword: "${keyword}"\n` +
            `Requested by: @${requesterUsername}\n` +
            `Rejected by: @${adminUsername}\n\n` +
            `This keyword will NOT be added to the whitelist.`;
        
        await bot.editMessageText(rejectedMessage, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id
        });
        
        await bot.answerCallbackQuery(query.id, {
            text: `Keyword "${keyword}" request has been rejected`
        });
    }
}

/**
 * Handle /listwhitelist command (optional - for viewing all whitelisted keywords)
 * @param {object} msg - Telegram message object
 * @param {object} bot - Telegram bot instance
 */
async function handleListWhitelistCommand(msg, bot) {
    const keywords = await getAllWhitelistKeywords();
    
    if (keywords.length === 0) {
        await bot.sendMessage(msg.chat.id, '📋 No whitelisted keywords found.');
        return;
    }
    
    let message = '📋 Whitelisted Keywords:\n\n';
    keywords.forEach((data, index) => {
        message += `${index + 1}. "${data.keyword}"\n`;
        message += `   Added by: ${data.addedBy}\n`;
        message += `   Added at: ${new Date(data.addedAt).toLocaleString()}\n\n`;
    });
    
    await bot.sendMessage(msg.chat.id, message);
}

/**
 * Handle /removewhitelist command (admin only - for removing whitelisted keywords)
 * @param {object} msg - Telegram message object
 * @param {object} bot - Telegram bot instance
 */
async function handleRemoveWhitelistCommand(msg, bot) {
    const adminUsername = msg.from.username || msg.from.first_name || 'Admin';
    
    // Parse the command: /removewhitelist <keyword>
    const parts = msg.text.trim().split(/\s+/);
    
    if (parts.length < 2) {
        await bot.sendMessage(
            msg.chat.id,
            '❌ Usage: /removewhitelist <keyword>\n\nExample: /removewhitelist ecash'
        );
        return;
    }
    
    // Get the keyword (everything after the command)
    const keyword = parts.slice(1).join(' ').trim().toLowerCase();
    
    if (!keyword) {
        await bot.sendMessage(
            msg.chat.id,
            '❌ Please provide a keyword to remove from whitelist.'
        );
        return;
    }
    
    // Remove the keyword
    const success = await removeWhitelistKeyword(keyword);
    
    if (success) {
        await bot.sendMessage(
            msg.chat.id,
            `✅ Keyword "${keyword}" has been removed from the whitelist by @${adminUsername}.`
        );
        
        // Notify the notification group
        await bot.sendMessage(
            NOTIFICATION_GROUP_ID,
            `🗑️ Whitelist Keyword Removed\n\n` +
            `Keyword: "${keyword}"\n` +
            `Removed by: @${adminUsername}\n\n` +
            `This keyword will no longer bypass spam detection.`
        );
    } else {
        await bot.sendMessage(
            msg.chat.id,
            `❌ Failed to remove keyword "${keyword}". It may not exist in the whitelist.`
        );
    }
}

module.exports = {
    handleWhitelistingCommand,
    handleWhitelistCallback,
    handleListWhitelistCommand,
    handleRemoveWhitelistCommand
};

