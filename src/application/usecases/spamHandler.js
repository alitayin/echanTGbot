const { 
    KOUSH_USER_ID,
    ALITAYIN_USER_ID,
    SPAM_THRESHOLD,
    RELEVANT_KEYWORDS
} = require('../../../config/config.js');

// Infra: analysis, secondary spam check, translation, admin actions, storage
const { fetchMessageAnalysis } = require('../../infrastructure/ai/messageAnalysis.js');
const { performSecondarySpamCheck } = require('../../infrastructure/ai/secondarySpamCheck.js');
const { translateToEnglishIfTargetGroup } = require('../../infrastructure/ai/translation.js');
const { updateSpamRecord } = require('../../infrastructure/storage/spamUserStore.js');
const { kickUser, deleteMessage, forwardMessage, getIsAdmin } = require('../../infrastructure/telegram/adminActions.js');

// Domain policies 
const {
    isSpamMessage,
    decideSecondarySpamCheck,
    decideDisciplinaryAction,
} = require('../../domain/policies/spamPolicy.js');

// Spam count storage handled in infra

// Keyword relevance handled by domain policy

// Handle spam (returns whether handled as spam)
async function handleSpamMessage(msg, bot, spamData) {
    const { deviation, suspicion, inducement, spam } = spamData;
    const query = msg.text || msg.caption || '';
    const primarySpam = isSpamMessage({
        spamFlag: spam === true,
        deviation,
        suspicion,
        inducement,
        spamThreshold: SPAM_THRESHOLD,
        query,
        relevantKeywords: RELEVANT_KEYWORDS,
        minWordCount: 1,
    });

    if (decideSecondarySpamCheck(primarySpam)) {
        const additionalSpam = await performSecondarySpamCheck(query, msg.from.id);
        if (additionalSpam === true) {
            await handleSpamDeletion(msg, bot);
            return true;
        }
    }
    return false;
}

// Delete spam message and act
async function handleSpamDeletion(msg, bot) {
    try {
        // Always notify admins about source (group and user)
        const userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || 'Unknown User';
        const groupName = msg.chat.title || 'Unknown Group';
        const sourceInfo = `Spam detected from ${userName} in "${groupName}"`;
        await bot.sendMessage(ALITAYIN_USER_ID, sourceInfo);
        await bot.sendMessage(KOUSH_USER_ID, sourceInfo);

        // Forward to admins (prefer ALITAYIN)
        await forwardMessage(bot, ALITAYIN_USER_ID, msg.chat.id, msg.message_id);
        await forwardMessage(bot, KOUSH_USER_ID, msg.chat.id, msg.message_id);

        // Check if sender is admin
        const isAdmin = await getIsAdmin(bot, msg.chat.id, msg.from.id);

        if (!isAdmin) {
            await deleteMessage(bot, msg.chat.id, msg.message_id);
            
            // Update user spam record
            const userRecord = updateSpamRecord(msg.from.id);
            
            let actionTaken = '';
            const action = decideDisciplinaryAction({ currentSpamCountInWindow: userRecord.count });
            if (action === 'warn') {
                const warningMessage = await bot.sendMessage(
                    msg.chat.id,
                    `${userName} your last message was marked as spam and removed. Another message of this kind will lead to ban.`
                );
                actionTaken = `warned ${userName} (first spam offense)`;
                // setTimeout(() => {
                //     bot.deleteMessage(msg.chat.id, warningMessage.message_id).catch(() => {});
                // }, 3000);
            } else {
                const kickSuccess = await kickUser(bot, msg.chat.id, msg.from.id);
                if (kickSuccess) {
                    actionTaken = `kicked ${userName} (${userRecord.count} spam messages in 30min)`;
                    await bot.sendMessage(msg.chat.id, `${userName} was kicked for spam`);
                } else {
                    actionTaken = `cannot kick ${userName} (regular group limitation - ${userRecord.count} spam messages in 30min)`;
                }
            }
            
            const explanationMessage = `Spam detected in "${groupName}" - ${actionTaken}`;
            await bot.sendMessage(KOUSH_USER_ID, explanationMessage);
            await bot.sendMessage(ALITAYIN_USER_ID, explanationMessage);
        }
    } catch (error) {
        console.error('Failed to handle spam deletion:', error);
    }
}

// Handle translation (infra)
async function handleTranslation(msg, bot) {
    await translateToEnglishIfTargetGroup(msg, bot);
}

// Main entry
async function processGroupMessage(msg, bot, ports) {
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
        return;
    }

    const query = msg.text || msg.caption || '';
    
    // Skip empty messages
    if (!query.trim()) {
        console.log('跳过空消息处理');
        return;
    }

    // Only detect spam if target member is present
    if (!ports || !ports.telegramGroup || typeof ports.telegramGroup.hasMember !== 'function') {
        return;
    }
    const hasAlitayin = await ports.telegramGroup.hasMember(msg.chat.id, ALITAYIN_USER_ID);
    if (!hasAlitayin) {
        return;
    }

    const answer = await fetchMessageAnalysis(query, msg.from.id);
    if (!answer) {
        console.log('No analysis result, skip');
        return;
    }

    const botInfo = await bot.getMe();
    const botMember = await bot.getChatMember(msg.chat.id, botInfo.id);
    const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);

    if (isBotAdmin) {
        const wasSpam = await handleSpamMessage(msg, bot, answer);
        if (!wasSpam && answer.is_english === false) {
            console.log('🔄 Non-English detected, translating');
            await handleTranslation(msg, bot);
        } else if (!wasSpam) {
            console.log('✅ Normal message');
        }
    }
}

// Exports
module.exports = {
    processGroupMessage,
};
