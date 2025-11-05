const { 
    NOTIFICATION_GROUP_ID, 
    USERNAME_LENGTH_THRESHOLD,
    SPAM_THRESHOLD,
    RELEVANT_KEYWORDS
} = require('../../../config/config.js');
const { fetchMessageAnalysis } = require('../../infrastructure/ai/messageAnalysis.js');
const { kickUser, deleteMessage } = require('../../infrastructure/telegram/adminActions.js');
const { isSpamMessage } = require('../../domain/policies/spamPolicy.js');

function getUserDisplayName(user) {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.username || '';
}

function shouldCheckNewMemberUsername(user) {
    if (!user || user.is_bot) {
        return false;
    }
    
    const displayName = getUserDisplayName(user);
    const nameLength = displayName.length;
    
    console.log(`New member display name: "${displayName}" (length: ${nameLength})`);
    
    return nameLength >= USERNAME_LENGTH_THRESHOLD;
}

async function checkNewMemberUsernameSpam(user) {
    const displayName = getUserDisplayName(user);
    
    // Build query with username
    const query = `New user joined with display name: "${displayName}"`;
    
    console.log(`Checking new member username with AI: "${displayName}"`);
    
    const analysis = await fetchMessageAnalysis(query, user.id);
    
    if (!analysis) {
        console.log('No analysis result for new member username');
        return { isSpam: false, reason: 'no_analysis' };
    }
    
    // Use same spam detection logic as spamHandler
    const { deviation, suspicion, inducement, spam } = analysis;
    const isSpam = isSpamMessage({
        spamFlag: spam === true,
        deviation,
        suspicion,
        inducement,
        spamThreshold: SPAM_THRESHOLD,
        query,
        relevantKeywords: RELEVANT_KEYWORDS,
        minWordCount: 1,
    });
    
    console.log(`New member username spam check result: ${displayName} - spam: ${isSpam}`);
    
    return { 
        isSpam, 
        reason: 'ai_check',
        analysis,
        displayName
    };
}

async function handleNewMemberSpamUsername(user, chatId, messageId, bot) {
    const displayName = getUserDisplayName(user);
    
    try {
        // Kick the user
        await kickUser(bot, chatId, user.id);
        
        console.log(`New member kicked for spam username: ${displayName} (ID: ${user.id})`);
        
        // Delete the "user joined" message
        if (messageId) {
            try {
                await deleteMessage(bot, chatId, messageId);
                console.log(`Join message deleted: ${messageId}`);
            } catch (deleteError) {
                console.log('Failed to delete join message:', deleteError);
            }
        }
        
        // Send notification to group
        const userIdentifier = user.username ? `@${user.username}` : `User (ID: ${user.id})`;
        const groupNotification = `⚠️ ${userIdentifier} has been removed for having a suspicious username.`;
        await bot.sendMessage(chatId, groupNotification);
        
        // Send report to notification group
        const reportMessage = `🚨 Suspicious Username Detected (New Member)\n\n` +
            `Chat ID: ${chatId}\n` +
            `User: ${userIdentifier} (ID: ${user.id})\n` +
            `Display Name: "${displayName}"\n` +
            `Name Length: ${displayName.length} characters\n` +
            `Action: New member kicked from group`;
        
        try {
            await bot.sendMessage(NOTIFICATION_GROUP_ID, reportMessage);
        } catch (error) {
            console.log('Failed to send report to notification group:', error);
        }
        
        return true;
    } catch (error) {
        console.error('Failed to handle new member spam username:', error);
        return false;
    }
}

async function processNewMemberUsername(user, chatId, messageId, bot) {
    if (!shouldCheckNewMemberUsername(user)) {
        return false;
    }
    
    const checkResult = await checkNewMemberUsernameSpam(user);
    
    if (checkResult.isSpam) {
        console.log(`Spam username detected for new member: ${checkResult.displayName}`);
        await handleNewMemberSpamUsername(user, chatId, messageId, bot);
        return true;
    }
    
    return false;
}

module.exports = {
    processNewMemberUsername,
    getUserDisplayName,
    shouldCheckNewMemberUsername,
};

