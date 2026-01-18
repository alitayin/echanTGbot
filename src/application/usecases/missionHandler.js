const { 
    createMission, 
    getMission,
    getMissionByMessageId,
    getAllMissions,
    hasUserCompletedMission,
    recordMissionCompletion,
    deleteMission,
    updateMissionMessageId
} = require('../../infrastructure/storage/missionStorage.js');
const { getUserAddress } = require('../../infrastructure/storage/userAddressStore.js');
const { ensureAddressWithFallback } = require('../../infrastructure/blockchain/addressUtils.js');
const { resolveTokenAlias } = require('../../infrastructure/blockchain/tokenInfo.js');
const { sendSlp, isMnemonicConfigured } = require('../../infrastructure/blockchain/tokenSender.js');
const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

const OORAH_TOKEN_ID = resolveTokenAlias('oorah');

/**
 * Handle /mission command (admin only, group only)
 * @param {object} msg - Telegram message
 * @param {object} bot - Telegram bot instance
 */
async function handleMissionCommand(msg, bot) {
    const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
    if (!isGroup) {
        await sendPromptMessage(msg.chat.id, '❌ This command can only be used in groups.');
        return;
    }

    const text = msg.text.trim();
    const description = text.replace(/^\/mission\s*/i, '').trim();
    
    if (!description) {
        await sendPromptMessage(
            msg.chat.id, 
            '❌ Usage: /mission <description>\n\nExample:\n/mission Complete 10 transactions on eCash network'
        );
        return;
    }

    try {
        const mission = await createMission(
            description,
            msg.chat.id,
            msg.message_id,
            msg.from.username || msg.from.first_name || 'unknown'
        );

        const responseText = `✅ Mission created!\n\n` +
            `🎯 Mission ID: ${mission.id}\n` +
            `📝 Description: ${mission.description}\n` +
            `🎁 Reward: 1 OORAH\n\n` +
            `💡 To complete this mission, reply to this message with ✅ or "done"`;

        const sentMessage = await bot.sendMessage(msg.chat.id, responseText, {
            reply_to_message_id: msg.message_id
        });

        // Store the actual mission message ID so replies bind correctly
        await updateMissionMessageId(mission.id, sentMessage.message_id);

        console.log(`Mission ${mission.id} created in chat ${msg.chat.id}`);
    } catch (error) {
        console.error('Failed to create mission:', error);
        await sendPromptMessage(msg.chat.id, '❌ Failed to create mission. Please try again.');
    }
}

/**
 * Handle mission completion (when user replies with ✅ or "done")
 * @param {object} msg - Telegram message
 * @param {object} bot - Telegram bot instance
 */
async function handleMissionCompletion(msg, bot) {
    if (!msg.reply_to_message) {
        return;
    }

    const repliedToMessageId = msg.reply_to_message.message_id;
    let mission = await getMissionByMessageId(msg.chat.id, repliedToMessageId);
    
    if (!mission) {
        // Fallback: parse Mission ID from the replied message text in case messageId was not stored
        const replyText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        const idMatch = replyText.match(/Mission ID:\s*([A-Z0-9]{6})/i);
        if (idMatch && idMatch[1]) {
            mission = await getMission(idMatch[1].toUpperCase());
            if (!mission) {
                console.log(`No mission found for parsed ID ${idMatch[1]} from reply text`);
                return;
            }
        } else {
            return;
        }
    }

    const text = (msg.text || '').trim().toLowerCase();
    if (text !== '✅' && text !== 'done') {
        return;
    }

    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'unknown';

    try {
        const alreadyCompleted = await hasUserCompletedMission(mission.id, userId);
        if (alreadyCompleted) {
            console.log(`⚠️ User @${username} already completed mission ${mission.id}`);
            await sendPromptMessage(
                msg.chat.id,
                `⚠️ @${username}, you have already completed mission ${mission.id}. Each mission can only be completed once per user.`,
                { reply_to_message_id: msg.message_id }
            );
            return;
        }

        const addressData = await getUserAddress(userId);
        if (!addressData) {
            await sendPromptMessage(
                msg.chat.id,
                `❌ @${username}, you need to register first!\n\nPlease use /signup <address> to register your eCash address before completing missions.`,
                { reply_to_message_id: msg.message_id }
            );
            return;
        }

        const recipientAddress = ensureAddressWithFallback(addressData.address);

        if (!isMnemonicConfigured()) {
            console.error('MNEMONIC not configured - cannot send rewards');
            await recordMissionCompletion(mission.id, userId, username);
            console.log(`✅ Mission ${mission.id} completion recorded for @${username} (wallet not configured)`);
            return;
        }

        const amount = 1;
        const decimals = 0;
        const amountInBaseUnits = amount * Math.pow(10, decimals);
        const recipients = [{ address: recipientAddress, amount: amountInBaseUnits }];

        try {
            const result = await sendSlp(recipients, OORAH_TOKEN_ID, decimals);
            await recordMissionCompletion(mission.id, userId, username);

            if (NOTIFICATION_GROUP_ID) {
                try {
                    const txid = result?.txid || '';
                    const shortTxid = txid ? `${txid.slice(0, 4)}...${txid.slice(-4)}` : 'unknown';
                    const txLink = txid
                        ? `<a href="https://explorer.e.cash/tx/${txid}">${shortTxid}</a>`
                        : 'unknown';
                    await bot.sendMessage(
                        NOTIFICATION_GROUP_ID,
                        `🎯 Mission Completed!\n\n` +
                        `👤 User: @${username}\n` +
                        `🎯 Mission ID: ${mission.id}\n` +
                        `📝 Description: ${mission.description}\n` +
                        `🎁 Reward: 1 OORAH\n` +
                        `🔗 txid: ${txLink}`,
                        { parse_mode: 'HTML' }
                    );
                } catch (notifError) {
                    console.log(`ℹ️ Could not send notification to log group (ID: ${NOTIFICATION_GROUP_ID}): ${notifError.message}`);
                }
            }

            console.log(`✅ Mission ${mission.id} completed by @${username}, reward sent: ${result.txid}`);
        } catch (sendError) {
            console.error('Failed to send reward:', sendError);
            await recordMissionCompletion(mission.id, userId, username);
            
            try {
                await bot.sendMessage(
                    userId,
                    `⚠️ Mission ${mission.id} completion recorded, but failed to send reward.\n` +
                    `Please contact admin. Error: ${sendError.message}`
                );
            } catch (dmError) {
                console.log(`Could not send DM to user ${userId}: ${dmError.message}`);
            }
        }
    } catch (error) {
        console.error('Failed to process mission completion:', error);
    }
}

/**
 * Handle /showmission command (admin only)
 * @param {object} msg - Telegram message
 * @param {object} bot - Telegram bot instance
 */
async function handleShowMissionCommand(msg, bot) {
    try {
        const missions = await getAllMissions();
        
        if (missions.length === 0) {
            await bot.sendMessage(msg.chat.id, '📋 No missions have been created yet.');
            return;
        }

        missions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        let message = `📋 All Missions (${missions.length} total)\n\n`;
        
        missions.forEach((mission, index) => {
            const shortDesc = mission.description.substring(0, 50);
            const truncated = mission.description.length > 50 ? '...' : '';
            const date = new Date(mission.createdAt).toLocaleDateString();
            
            message += `${index + 1}. ID: ${mission.id}\n`;
            message += `   📝 ${shortDesc}${truncated}\n`;
            message += `   📅 ${date} by @${mission.creatorUsername}\n`;
            message += `   🎁 Reward: ${mission.reward} OORAH\n\n`;
        });

        message += `💡 Use /mission <description> to create a new mission`;

        if (message.length > 4000) {
            const chunks = [];
            let currentChunk = `📋 All Missions (${missions.length} total)\n\n`;
            
            missions.forEach((mission, index) => {
                const shortDesc = mission.description.substring(0, 50);
                const truncated = mission.description.length > 50 ? '...' : '';
                const date = new Date(mission.createdAt).toLocaleDateString();
                
                const entry = `${index + 1}. ID: ${mission.id}\n` +
                    `   📝 ${shortDesc}${truncated}\n` +
                    `   📅 ${date} by @${mission.creatorUsername}\n` +
                    `   🎁 Reward: ${mission.reward} OORAH\n\n`;
                
                if (currentChunk.length + entry.length > 4000) {
                    chunks.push(currentChunk);
                    currentChunk = entry;
                } else {
                    currentChunk += entry;
                }
            });
            
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
            }
            
            for (const chunk of chunks) {
                await bot.sendMessage(msg.chat.id, chunk);
            }
        } else {
            await bot.sendMessage(msg.chat.id, message);
        }

        console.log(`Mission list viewed by @${msg.from.username}`);
    } catch (error) {
        console.error('Failed to show missions:', error);
        await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve missions. Please try again.');
    }
}

/**
 * Handle /deletemission command (admin only)
 * Supports two modes:
 * 1. Reply to mission message with /deletemission
 * 2. Direct usage: /deletemission <mission_id>
 * @param {object} msg - Telegram message
 * @param {object} bot - Telegram bot instance
 */
async function handleDeleteMissionCommand(msg, bot) {
    try {
        let mission = null;
        let missionId = null;

        if (msg.reply_to_message) {
            const repliedToMessageId = msg.reply_to_message.message_id;
            mission = await getMissionByMessageId(msg.chat.id, repliedToMessageId);
            
            if (!mission) {
                await bot.sendMessage(
                    msg.chat.id,
                    '❌ The replied message is not a mission.',
                    { reply_to_message_id: msg.message_id }
                );
                return;
            }
            missionId = mission.id;
        } else {
            const parts = msg.text.trim().split(/\s+/);
            
            if (parts.length < 2) {
                await bot.sendMessage(
                    msg.chat.id,
                    '❌ Usage:\n' +
                    '1. Reply to a mission message with /deletemission\n' +
                    '2. Use /deletemission <mission_id>\n\n' +
                    'Example:\n/deletemission P6LIA5'
                );
                return;
            }

            missionId = parts[1].trim().toUpperCase();
            
            mission = await getMission(missionId);
            if (!mission) {
                await bot.sendMessage(
                    msg.chat.id,
                    `❌ Mission ${missionId} not found.`
                );
                return;
            }
        }

        const success = await deleteMission(missionId);
        
        if (success) {
            await bot.sendMessage(
                msg.chat.id,
                `✅ Mission ${missionId} has been deleted.\n\n📝 Description: ${mission.description.substring(0, 100)}${mission.description.length > 100 ? '...' : ''}`
            );
            console.log(`Mission ${missionId} deleted by @${msg.from.username}`);
        } else {
            await bot.sendMessage(
                msg.chat.id,
                `❌ Failed to delete mission ${missionId}.`
            );
        }
    } catch (error) {
        console.error('Failed to delete mission:', error);
        await bot.sendMessage(msg.chat.id, '❌ Failed to delete mission. Please try again.');
    }
}

module.exports = {
    handleMissionCommand,
    handleMissionCompletion,
    handleShowMissionCommand,
    handleDeleteMissionCommand
};

