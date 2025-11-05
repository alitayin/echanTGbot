const { 
    KOUSH_USER_ID,
    ALITAYIN_USER_ID,
    SPAM_THRESHOLD,
    RELEVANT_KEYWORDS,
    NOTIFICATION_GROUP_ID,
    USERNAME_LENGTH_THRESHOLD
} = require('../../../config/config.js');

const { fetchMessageAnalysis } = require('../../infrastructure/ai/messageAnalysis.js');
const { performSecondarySpamCheck } = require('../../infrastructure/ai/secondarySpamCheck.js');
const { translateToEnglishIfTargetGroup } = require('../../infrastructure/ai/translation.js');
const { updateSpamRecord } = require('../../infrastructure/storage/spamUserStore.js');
const { isSimilarToSpam, addSpamMessage } = require('../../infrastructure/storage/spamMessageCache.js');
const { kickUser, unbanUser, deleteMessage, forwardMessage, getIsAdmin } = require('../../infrastructure/telegram/adminActions.js');
const { containsWhitelistKeyword } = require('../../infrastructure/storage/whitelistKeywordStore.js');

const {
    isSpamMessage,
    decideSecondarySpamCheck,
    decideDisciplinaryAction,
} = require('../../domain/policies/spamPolicy.js');

function buildCombinedAnalysisQuery(msg) {
    try {
        const isForwarded = Boolean(msg && (msg.forward_from || msg.forward_sender_name || msg.forward_from_chat));
        const text = (msg && msg.text) ? String(msg.text).trim() : '';
        const caption = (msg && msg.caption) ? String(msg.caption).trim() : '';
        const contentParts = [];

        // Check if sender has long username and add it to content
        if (msg && msg.from) {
            const displayName = `${msg.from.first_name || ''} ${msg.from.last_name || ''}`.trim() || msg.from.username || '';
            if (displayName.length >= USERNAME_LENGTH_THRESHOLD) {
                contentParts.push(`[Sender Name]: ${displayName}`);
                console.log(`Added long username to spam check: "${displayName}" (length: ${displayName.length})`);
            }
        }

        if (msg && msg.quote && msg.quote.text) {
            const quoteText = String(msg.quote.text).trim();
            if (quoteText) {
                contentParts.push(`[Quoted]: ${quoteText}`);
            }
        }

        if (isForwarded) {
            const forwardUser = msg.forward_from?.username
                ? `@${msg.forward_from.username}`
                : (msg.forward_sender_name || msg.forward_from_chat?.title || 'Unknown');

            if (text) {
                contentParts.push(`[Forwarded from ${forwardUser}] ${text}`);
            } else if (caption) {
                contentParts.push(`[Forwarded from ${forwardUser}] ${caption}`);
            }
        } else {
            if (text) {
                contentParts.push(text);
            } else if (caption) {
                contentParts.push(caption);
            }
        }

        return contentParts.join('\n\n').trim();
    } catch (e) {
        return String(msg?.text || msg?.caption || '');
    }
}

async function handleSpamMessage(msg, bot, spamData, query) {
    const { deviation, suspicion, inducement, spam } = spamData;
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
            await handleSpamDeletion(msg, bot, query);
            return true;
        }
    }
    return false;
}

async function handleSpamDeletion(msg, bot, query = null, skipCache = false) {
    try {
        
        // Add spam message to cache (skip if it's similar to existing spam)
        if (!skipCache) {
            const messageContent = query || buildCombinedAnalysisQuery(msg);
            addSpamMessage(messageContent);
        }
        
        const userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || 'Unknown User';
        const groupName = msg.chat.title || 'Unknown Group';
        const sourceInfo = `Spam detected from ${userName} in "${groupName}"`;
        await bot.sendMessage(NOTIFICATION_GROUP_ID, sourceInfo);

        await forwardMessage(bot, NOTIFICATION_GROUP_ID, msg.chat.id, msg.message_id);

        const isAdmin = await getIsAdmin(bot, msg.chat.id, msg.from.id);

        if (!isAdmin) {
            await deleteMessage(bot, msg.chat.id, msg.message_id);
            
            const userRecord = updateSpamRecord(msg.from.id);
            
            let actionTaken = '';
            const action = decideDisciplinaryAction({ currentSpamCountInWindow: userRecord.count });
            if (action === 'warn') {
                const kickSuccess = await kickUser(bot, msg.chat.id, msg.from.id);
                if (kickSuccess) {
                    await unbanUser(bot, msg.chat.id, msg.from.id);
                    actionTaken = `kicked ${userName} (first spam offense, can rejoin)`;
                } else {
                    actionTaken = `cannot kick ${userName} (regular group limitation - first spam offense)`;
                }
            } else {
                const kickSuccess = await kickUser(bot, msg.chat.id, msg.from.id);
                if (kickSuccess) {
                    actionTaken = `BANNED ${userName} permanently (${userRecord.count} spam messages in 3h)`;
                } else {
                    actionTaken = `cannot ban ${userName} (regular group limitation - ${userRecord.count} spam messages in 3h)`;
                }
            }
            
            const explanationMessage = `Spam detected in "${groupName}" - ${actionTaken}`;
            await bot.sendMessage(NOTIFICATION_GROUP_ID, explanationMessage);
        }
    } catch (error) {
        console.error('Failed to handle spam deletion:', error);
    }
}

async function handleTranslation(msg, bot) {
    await translateToEnglishIfTargetGroup(msg, bot);
}

async function processGroupMessage(msg, bot, ports) {
    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
        return;
    }

    const query = buildCombinedAnalysisQuery(msg);
    
    console.log('Message structure (selected fields):', JSON.stringify({
        text: msg.text,
        caption: msg.caption,
        forward_from: msg.forward_from ? { username: msg.forward_from.username, id: msg.forward_from.id } : null,
        forward_sender_name: msg.forward_sender_name,
        forward_from_chat: msg.forward_from_chat ? { title: msg.forward_from_chat.title, id: msg.forward_from_chat.id } : null,
        forward_origin: msg.forward_origin,
        reply_to_message: msg.reply_to_message ? {
            text: msg.reply_to_message.text,
            caption: msg.reply_to_message.caption,
            from: msg.reply_to_message.from ? { username: msg.reply_to_message.from.username, id: msg.reply_to_message.from.id } : null
        } : null,
        quote: msg.quote,
        external_reply: msg.external_reply,
        entities: msg.entities,
        caption_entities: msg.caption_entities,
        link_preview_options: msg.link_preview_options,
        has_photo: !!msg.photo,
        has_video: !!msg.video,
        has_document: !!msg.document
    }, null, 2));
    
    console.log('All msg keys:', Object.keys(msg).join(', '));
    
    console.log('Built query for detection:');
    console.log(query);
    console.log('Query length:', query.length);
    
    if (!query.trim()) {
        console.log('Skip empty message');
        return;
    }

    // Check if message contains whitelisted keyword
    const whitelistedKeyword = await containsWhitelistKeyword(query);
    if (whitelistedKeyword) {
        console.log(`Message contains whitelisted keyword "${whitelistedKeyword}", skipping spam detection`);
        return;
    }

    if (!ports || !ports.telegramGroup || typeof ports.telegramGroup.hasMember !== 'function') {
        console.log('Ports not available, skipping spam detection');
        return;
    }
    const hasAlitayin = await ports.telegramGroup.hasMember(msg.chat.id, ALITAYIN_USER_ID);
    console.log(`Has target member: ${hasAlitayin}`);
    if (!hasAlitayin) {
        console.log('Target member not in group, skipping spam detection');
        return;
    }

    const botInfo = await bot.getMe();
    const botMember = await bot.getChatMember(msg.chat.id, botInfo.id);
    const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);
    console.log(`Bot is admin: ${isBotAdmin}`);

    if (isBotAdmin) {
        let channelUsername = null;
        
        if (msg.external_reply && msg.external_reply.origin) {
            const origin = msg.external_reply.origin;
            if (origin.type === 'channel' && origin.chat && origin.chat.username) {
                channelUsername = origin.chat.username;
            } else if (origin.sender_chat && origin.sender_chat.username) {
                channelUsername = origin.sender_chat.username;
            }
        }
        
        if (!channelUsername && msg.quote && msg.quote.origin) {
            const origin = msg.quote.origin;
            if (origin.type === 'channel' && origin.chat && origin.chat.username) {
                channelUsername = origin.chat.username;
            } else if (origin.sender_chat && origin.sender_chat.username) {
                channelUsername = origin.sender_chat.username;
            }
        }
        
        const blacklistedChannels = ['Insider_SOL_Trades'];
        if (channelUsername && blacklistedChannels.includes(channelUsername)) {
            console.log(`Quote/external_reply from blacklisted channel @${channelUsername}, marking as spam immediately`);
            await handleSpamDeletion(msg, bot, query);
            return;
        }
    }

    // Check similarity with cached spam messages before calling API
    if (isSimilarToSpam(query, 95)) {
        console.log('Message is similar to cached spam (>=95%), deleting without API call');
        await handleSpamDeletion(msg, bot, query, true); // skipCache = true, no need to cache similar spam
        return;
    }

    const answer = await fetchMessageAnalysis(query, msg.from.id);
    if (!answer) {
        console.log('No analysis result, skip');
        return;
    }

    if (isBotAdmin) {
        const wasSpam = await handleSpamMessage(msg, bot, answer, query);
        if (!wasSpam && answer.is_english === false) {
            console.log('Non-English detected, translating');
            await handleTranslation(msg, bot);
        } else if (!wasSpam) {
            console.log('Normal message');
        }
    }
}

module.exports = {
    processGroupMessage,
};
