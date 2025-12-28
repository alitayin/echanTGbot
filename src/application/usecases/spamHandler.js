const { 
    KOUSH_USER_ID,
    ALITAYIN_USER_ID,
    SPAM_THRESHOLD,
    RELEVANT_KEYWORDS,
    NOTIFICATION_GROUP_ID,
    USERNAME_LENGTH_THRESHOLD
} = require('../../../config/config.js');

const { fetchMessageAnalysis, fetchMessageAnalysisWithImage } = require('../../infrastructure/ai/messageAnalysis.js');
const { performSecondarySpamCheck } = require('../../infrastructure/ai/secondarySpamCheck.js');
const { translateToEnglishIfTargetGroup } = require('../../infrastructure/ai/translation.js');
const { updateSpamRecord } = require('../../infrastructure/storage/spamUserStore.js');
const { isSimilarToSpam, addSpamMessage } = require('../../infrastructure/storage/spamMessageCache.js');
const { addSpamImage, isSpamImage } = require('../../infrastructure/storage/spamImageStore.js');
const { kickUser, unbanUser, deleteMessage, forwardMessage, getIsAdmin } = require('../../infrastructure/telegram/adminActions.js');
const { getImageUrls, hasImageMedia, getImageFileId } = require('../../infrastructure/telegram/mediaHelper.js');
const { containsWhitelistKeyword } = require('../../infrastructure/storage/whitelistKeywordStore.js');
const { buildSpamModerationButtons } = require('./spamModerationHandler.js');
const { HIGH_FREQ_WORDS } = require('../../infrastructure/ai/englishHighFreq.js');
// Skip-list for high-frequency collisions (e.g., Indonesian "dan")
const ENGLISH_COVERAGE_SKIP = new Set(['dan']);
const {
    isUserTrustedInGroup,
    recordNormalMessageInGroup,
    resetNormalMessageStreakInGroup,
} = require('../../infrastructure/storage/normalMessageTracker.js');

const {
    isSpamMessage,
    decideSecondarySpamCheck,
    decideDisciplinaryAction,
} = require('../../domain/policies/spamPolicy.js');

function detectNonEnglish(msg) {
    const content = (msg?.text || msg?.caption || '').trim();
    if (!content || content.length < 5) {
        return { isNonEnglish: false, reason: 'too-short', ratio: 0, coverage: null, length: content.length };
    }
    const nonLatinRegex = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u052f\u0600-\u06ff\u0590-\u05ff\u0900-\u0d7f]/;
    if (nonLatinRegex.test(content)) {
        return { isNonEnglish: true, reason: 'non-latin-script', ratio: 1, coverage: null, length: content.length };
    }
    const nonAscii = (content.match(/[^\x00-\x7F]/g) || []).length;
    const ratio = nonAscii / content.length;
    if (ratio >= 0.15) {
        return { isNonEnglish: true, reason: `non-ascii-ratio>=0.15 (${ratio.toFixed(3)})`, ratio, coverage: null, length: content.length };
    }
    const words = content.toLowerCase().match(/[a-z']+/g) || [];
    if (!words.length) {
        return { isNonEnglish: false, reason: 'no-english-words', ratio, coverage: 0, length: content.length };
    }
    let hits = 0;
    for (const w of words) {
        if (!ENGLISH_COVERAGE_SKIP.has(w) && HIGH_FREQ_WORDS.has(w)) hits++;
    }
    const coverage = hits / words.length;
    if (coverage < 0.05) {
        return { isNonEnglish: true, reason: `low-english-coverage<0.05 (${coverage.toFixed(3)})`, ratio, coverage, length: content.length };
    }
    return { isNonEnglish: false, reason: 'english-coverage-ok', ratio, coverage, length: content.length };
}

function buildCombinedAnalysisQuery(msg) {
    try {
        const isForwarded = Boolean(msg && (msg.forward_from || msg.forward_sender_name || msg.forward_from_chat));
        const text = (msg && msg.text) ? String(msg.text).trim() : '';
        const caption = (msg && msg.caption) ? String(msg.caption).trim() : '';
        const contentParts = [];

        // Check if message contains image-like media
        if (hasImageMedia(msg)) {
            contentParts.push('[This message contains an image]');
        }

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

async function handleSpamMessage(msg, bot, spamData, query, imageUrls = []) {
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
        const additionalSpam = await performSecondarySpamCheck(query, msg.from.id, imageUrls);
        if (additionalSpam === true) {
            await handleSpamDeletion(msg, bot, query);
            return true;
        }
    }
    return false;
}

async function handleSpamDeletion(msg, bot, query = null, skipCache = false) {
    try {
        
        // Add spam message/image to cache (skip if it's similar to existing spam)
        if (!skipCache) {
            // Check if message contains image
            if (hasImageMedia(msg)) {
                // For image messages, only store the image, not text
                const imageFileId = getImageFileId(msg);

                if (imageFileId) {
                    await addSpamImage(bot, imageFileId, msg.from.id, {
                        chatId: msg.chat.id,
                        messageId: msg.message_id,
                        hasSticker: !!msg.sticker,
                        caption: msg.caption,
                        mimeType: msg.document?.mime_type
                    });
                    console.log('Stored spam image in database');
                }
            } else {
                // For text-only messages, store text content
                const messageContent = query || buildCombinedAnalysisQuery(msg);
                addSpamMessage(messageContent);
            }
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
            let moderationButtons = null;
            if (action === 'warn') {
                const kickSuccess = await kickUser(bot, msg.chat.id, msg.from.id);
                if (kickSuccess) {
                    await unbanUser(bot, msg.chat.id, msg.from.id);
                    actionTaken = `kicked ${userName} (first spam offense, can rejoin)`;
                    // 提供手动升级为封禁的按钮
                    moderationButtons = buildSpamModerationButtons({
                        chatId: msg.chat.id,
                        userId: msg.from.id,
                        showBan: true,
                    });
                } else {
                    actionTaken = `cannot kick ${userName} (regular group limitation - first spam offense)`;
                }
            } else {
                const kickSuccess = await kickUser(bot, msg.chat.id, msg.from.id);
                if (kickSuccess) {
                    actionTaken = `BANNED ${userName} permanently (${userRecord.count} spam messages in 3h)`;
                    moderationButtons = buildSpamModerationButtons({
                        chatId: msg.chat.id,
                        userId: msg.from.id,
                        showUnban: true,
                    });
                } else {
                    actionTaken = `cannot ban ${userName} (regular group limitation - ${userRecord.count} spam messages in 3h)`;
                }
            }
            
            const explanationMessage = `Spam detected in "${groupName}" - ${actionTaken}`;
            await bot.sendMessage(NOTIFICATION_GROUP_ID, explanationMessage, moderationButtons || {});
        }
    } catch (error) {
        console.error('Failed to handle spam deletion:', error);
    }
}

async function handleTranslation(msg, bot) {
    await translateToEnglishIfTargetGroup(msg, bot);
}

async function processGroupMessage(msg, bot, ports) {
    console.log('processGroupMessage entry', {
        chatId: msg?.chat?.id,
        chatType: msg?.chat?.type,
        fromId: msg?.from?.id,
        isBot: msg?.from?.is_bot,
        hasPhoto: !!msg?.photo,
        hasSticker: !!msg?.sticker,
        hasDocument: !!msg?.document,
        documentMime: msg?.document?.mime_type,
        hasAnimation: !!msg?.animation
    });

    if (msg.chat.type !== "group" && msg.chat.type !== "supergroup") {
        return;
    }

    // Ignore bot messages; only track human users for trust / spam detection
    if (!msg.from || msg.from.is_bot) {
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
    
    if (!query.trim() && !hasImageMedia(msg)) {
        console.log('Skip empty message (no text or image)');
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

    // If user has already built enough normal-message history in this group,
    // skip further spam detection for better UX.
    if (isUserTrustedInGroup(msg.chat.id, msg.from.id)) {
        console.log(
            `User ${msg.from.id} in chat ${msg.chat.id} is trusted (>= normal streak threshold), skipping spam detection`
        );
        // Even if we skip spam checks for trusted users, keep auto-translation working for non-English text
        const detection = detectNonEnglish(msg);
        if (detection.isNonEnglish) {
            console.log(`Non-English detected (trusted path): reason=${detection.reason}, ratio=${detection.ratio?.toFixed(3)}, coverage=${detection.coverage != null ? detection.coverage.toFixed(3) : 'n/a'}, len=${detection.length}`);
            await handleTranslation(msg, bot);
        }
        return;
    }

    // Check if message contains whitelisted keyword
    const whitelistedKeyword = await containsWhitelistKeyword(query);
    if (whitelistedKeyword) {
        console.log(`Message contains whitelisted keyword "${whitelistedKeyword}", skipping spam detection`);
        return;
    }

    // Check if image is spam (similarity check) before calling API
    const possibleImageFileId = getImageFileId(msg);
    if (possibleImageFileId && await isSpamImage(bot, possibleImageFileId)) {
        console.log('Image is similar to cached spam image, deleting without API call');
        await handleSpamDeletion(msg, bot, query, true); // skipCache = true, no need to cache similar spam
        return;
    }

    // Check similarity with cached spam messages before calling API
    if (isSimilarToSpam(query, 95)) {
        console.log('Message is similar to cached spam (>=95%), deleting without API call');
        await handleSpamDeletion(msg, bot, query, true); // skipCache = true, no need to cache similar spam
        return;
    }

    // Get image URLs if present
    const imageUrls = await getImageUrls(msg, bot);
    let answer;

    if (imageUrls.length > 0) {
        console.log(`Analyzing message with ${imageUrls.length} image(s)`);
        answer = await fetchMessageAnalysisWithImage(query || 'Analyze this image for spam content', imageUrls, msg.from.id);
    } else {
        answer = await fetchMessageAnalysis(query, msg.from.id);
    }
    
    if (!answer) {
        console.log('No analysis result, skip');
        return;
    }

    if (isBotAdmin) {
        const wasSpam = await handleSpamMessage(msg, bot, answer, query, imageUrls);

        if (wasSpam) {
            // If spam is detected, reset the user's normal-message streak
            resetNormalMessageStreakInGroup(msg.chat.id, msg.from.id);
            return;
        }

        // Non-spam message from a human user in group: record as normal.
        recordNormalMessageInGroup(msg.chat.id, msg.from.id);

        const detection = detectNonEnglish(msg);
        if (detection.isNonEnglish) {
            console.log(`Non-English detected (local heuristic), translating. reason=${detection.reason}, ratio=${detection.ratio?.toFixed(3)}, coverage=${detection.coverage != null ? detection.coverage.toFixed(3) : 'n/a'}, len=${detection.length}`);
            await handleTranslation(msg, bot);
        } else {
            console.log('Normal message');
        }
    }
}

module.exports = {
    processGroupMessage,
};