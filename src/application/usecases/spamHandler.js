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
// Minimum English high-frequency coverage to treat Latin text as English
const ENGLISH_MIN_COVERAGE = 0.6; //
const ENGLISH_MIN_COVERAGE_STEM = 0.80; 
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

function simpleStem(word) {
    if (word.length <= 3) return word;
    if (word.endsWith('ing') && word.length > 4) return word.slice(0, -3);
    if (word.endsWith('ed') && word.length > 3) return word.slice(0, -2);
    if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
    if (word.endsWith('s') && word.length > 3) return word.slice(0, -1);
    return word;
}

// Strip emoji to avoid inflating non-ASCII ratio and hurting precision
function stripEmoji(text = '') {
    const emojiRegex = /[\u{1F1E6}-\u{1F1FF}|\u{1F300}-\u{1F5FF}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{1F700}-\u{1F77F}|\u{1F780}-\u{1F7FF}|\u{1F800}-\u{1F8FF}|\u{1F900}-\u{1F9FF}|\u{1FA00}-\u{1FA6F}|\u{1FA70}-\u{1FAFF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}]/gu;
    return text.replace(emojiRegex, '');
}

// Heuristic to decide whether we should consult API for language confirmation.
// - Always compute non-ASCII ratio on emoji-stripped text.
// - For long text (>50), also compute English high-frequency coverage.
// - We do NOT translate directly; we only signal "shouldCheckWithApi".
function detectNonEnglish(msg) {
    const t0 = Date.now();
    const rawContent = (msg?.text || msg?.caption || '').trim();
    const content = stripEmoji(rawContent);
    const length = content.length;

    if (!content) {
        return { shouldCheckWithApi: false, reasons: ['empty'], ratio: 0, coverage: null, coverageStem: null, length, durationMs: Date.now() - t0 };
    }

    const nonAscii = (content.match(/[^\x00-\x7F]/g) || []).length;
    const ratio = length > 0 ? nonAscii / length : 0;
    const reasons = [];

    if (ratio >= 0.15) {
        reasons.push(`non-ascii-ratio>=0.15 (${ratio.toFixed(3)})`);
    }

    let coverageRaw = null;
    let coverageStem = null;

    if (length > 50) {
        const words = content.toLowerCase().match(/[a-z']+/g) || [];
        if (words.length) {
            let hitsRaw = 0;
            for (const w of words) {
                if (!ENGLISH_COVERAGE_SKIP.has(w) && HIGH_FREQ_WORDS.has(w)) hitsRaw++;
            }
            let hitsStem = hitsRaw;
            if (hitsRaw < words.length) {
                for (const w of words) {
                    if (ENGLISH_COVERAGE_SKIP.has(w) || HIGH_FREQ_WORDS.has(w)) continue;
                    const stem = simpleStem(w);
                    if (!ENGLISH_COVERAGE_SKIP.has(stem) && HIGH_FREQ_WORDS.has(stem)) {
                        hitsStem++;
                    }
                }
            }
            coverageRaw = hitsRaw / words.length;
            coverageStem = hitsStem / words.length;
            if (coverageRaw < ENGLISH_MIN_COVERAGE && coverageStem < ENGLISH_MIN_COVERAGE_STEM) {
                reasons.push(`low-english-coverage raw=${coverageRaw.toFixed(3)}, stem=${coverageStem.toFixed(3)}`);
            }
        } else {
            reasons.push('long-text-no-english-words');
        }
    }

    return {
        shouldCheckWithApi: reasons.length > 0,
        reasons,
        ratio,
        coverage: coverageRaw,
        coverageStem,
        length,
        durationMs: Date.now() - t0
    };
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
        } else if (msg && msg.sender_chat) {
            // For channel messages, include channel name
            const channelName = msg.sender_chat.title || msg.sender_chat.username || '';
            if (channelName) {
                contentParts.push(`[Channel]: ${channelName}`);
                console.log(`Added channel name to spam check: "${channelName}"`);
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
        const senderId = msg.from ? msg.from.id : (msg.sender_chat ? msg.sender_chat.id : 0);
        const additionalSpam = await performSecondarySpamCheck(query, senderId, imageUrls);
        if (additionalSpam === true) {
            await handleSpamDeletion(msg, bot, query);
            return true;
        }
    }
    return false;
}

async function handleSpamDeletion(msg, bot, query = null, skipCache = false) {
    try {
        const isFromChannel = !msg.from && msg.sender_chat;
        const senderId = msg.from ? msg.from.id : (msg.sender_chat ? msg.sender_chat.id : 0);
        
        // Add spam message/image to cache (skip if it's similar to existing spam)
        if (!skipCache) {
            // Check if message contains image
            if (hasImageMedia(msg)) {
                // For image messages, only store the image, not text
                const imageFileId = getImageFileId(msg);

                if (imageFileId) {
                    await addSpamImage(bot, imageFileId, senderId, {
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
        
        let userName;
        if (isFromChannel) {
            userName = msg.sender_chat.title || (msg.sender_chat.username ? `@${msg.sender_chat.username}` : 'Unknown Channel');
        } else {
            userName = msg.from.username ? `@${msg.from.username}` : msg.from.first_name || 'Unknown User';
        }
        
        const groupName = msg.chat.title || 'Unknown Group';
        const senderType = isFromChannel ? 'channel' : 'user';
        const sourceInfo = `Spam detected from ${senderType} ${userName} in "${groupName}"`;
        await bot.sendMessage(NOTIFICATION_GROUP_ID, sourceInfo);

        await forwardMessage(bot, NOTIFICATION_GROUP_ID, msg.chat.id, msg.message_id);

        const isAdmin = await getIsAdmin(bot, msg.chat.id, senderId);

        if (!isAdmin) {
            await deleteMessage(bot, msg.chat.id, msg.message_id);
            
            if (isFromChannel) {
                // For channel spam, ban the channel from the group
                try {
                    const banSuccess = await bot.banChatSenderChat(msg.chat.id, msg.sender_chat.id);
                    if (banSuccess) {
                        const actionTaken = `BANNED channel ${userName} from posting in this group`;
                        const explanationMessage = `Spam detected in "${groupName}" - ${actionTaken}`;
                        await bot.sendMessage(NOTIFICATION_GROUP_ID, explanationMessage);
                    } else {
                        const actionTaken = `Deleted spam from channel ${userName} (cannot ban channel - may lack permissions)`;
                        const explanationMessage = `Spam detected in "${groupName}" - ${actionTaken}`;
                        await bot.sendMessage(NOTIFICATION_GROUP_ID, explanationMessage);
                    }
                } catch (banError) {
                    console.error('Failed to ban channel:', banError);
                    const actionTaken = `Deleted spam from channel ${userName} (ban failed: ${banError.message})`;
                    const explanationMessage = `Spam detected in "${groupName}" - ${actionTaken}`;
                    await bot.sendMessage(NOTIFICATION_GROUP_ID, explanationMessage);
                }
            } else {
                // For user spam, use existing logic
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
                            showUnban: true,
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
        senderChatId: msg?.sender_chat?.id,
        senderChatType: msg?.sender_chat?.type,
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
    // Allow messages from channels (sender_chat) for spam detection
    const isFromChannel = !msg.from && msg.sender_chat && msg.sender_chat.type === 'channel';
    const isFromBot = msg.from && msg.from.is_bot;
    const senderId = msg.from ? msg.from.id : (msg.sender_chat ? msg.sender_chat.id : 0);
    
    if (!msg.from && !isFromChannel) {
        return;
    }
    
    if (isFromBot) {
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

    // Channels are never "trusted" - always check them for spam
    // If user has already built enough normal-message history in this group,
    // skip further spam detection for better UX.
    if (!isFromChannel && await isUserTrustedInGroup(msg.chat.id, msg.from.id)) {
        console.log(
            `User ${msg.from.id} in chat ${msg.chat.id} is trusted (>= normal streak threshold), skipping spam detection`
        );
        // Trusted users: skip spam checks but still ensure non-English content is translated.
        // Detection only signals the need to consult API; translation happens only after API confirms.
        const detection = detectNonEnglish(msg);
        if (detection.shouldCheckWithApi) {
            console.log(`Non-English candidate (trusted path): reasons=${detection.reasons.join('; ')}, ratio=${detection.ratio?.toFixed(3)}, coverage=${detection.coverage != null ? detection.coverage.toFixed(3) : 'n/a'}, coverageStem=${detection.coverageStem != null ? detection.coverageStem.toFixed(3) : 'n/a'}, len=${detection.length}, detectMs=${detection.durationMs}`);
            try {
                const langAnalysis = await fetchMessageAnalysis(query, senderId);
                if (langAnalysis && langAnalysis.is_english === false) {
                    console.log('API confirmed non-English (trusted path), translating');
                    await handleTranslation(msg, bot);
                } else {
                    console.log(`API says English or unknown (trusted path): is_english=${langAnalysis?.is_english}`);
                }
            } catch (err) {
                console.error('Trusted path language API check failed:', err?.message || err);
            }
            return;
        }
        // If no heuristic signals, do nothing (no translation) for trusted users.
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
        answer = await fetchMessageAnalysisWithImage(query || 'Analyze this image for spam content', imageUrls, senderId);
    } else {
        answer = await fetchMessageAnalysis(query, senderId);
    }
    
    if (!answer) {
        console.log('No analysis result, skip');
        return;
    }

    if (isBotAdmin) {
        const wasSpam = await handleSpamMessage(msg, bot, answer, query, imageUrls);

        if (wasSpam) {
            // If spam is detected, reset the user's normal-message streak (only for users, not channels)
            if (!isFromChannel) {
                await resetNormalMessageStreakInGroup(msg.chat.id, msg.from.id);
            }
            return;
        }

        // Non-spam message from a human user in group: record as normal (only for users, not channels)
        if (!isFromChannel) {
            await recordNormalMessageInGroup(msg.chat.id, msg.from.id);
        }

        // 非 trusted 用户仅使用 API 的 is_english 标记，不再使用本地启发式
        const apiIsEnglish = answer?.is_english;
        if (apiIsEnglish === false) {
            console.log('API marked message as non-English (non-trusted path), translating');
            await handleTranslation(msg, bot);
        } else {
            console.log(`API language flag (non-trusted path): is_english=${apiIsEnglish}`);
        }
    }
}

module.exports = {
    processGroupMessage,
};