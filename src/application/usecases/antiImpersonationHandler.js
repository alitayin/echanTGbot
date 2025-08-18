const { KOUSH_USER_ID, ALITAYIN_USER_ID, SECONDARY_SPAM_API_KEY, API_ENDPOINT, TELEGRAM_TOKEN } = require('../../../config/config.js');
const axios = require("axios");
const {
    DEFAULT_CACHE_DURATION_MS,
    DEFAULT_WHITELIST_DURATION_MS,
    isPotentialNameImpersonation,
    decideAfterAvatarCheck,
    isWhitelistValid,
} = require('../../domain/policies/impersonationPolicy.js');

// Admin cache per group
const groupAdmins = new Map();
const cacheTimestamps = new Map();

// Whitelist: users passed avatar check
const whitelistUsers = new Map(); // key: `${chatId}_${userId}`, value: timestamp
const whitelistTimestamps = new Map(); // key: `${chatId}_${userId}`, value: timestamp

// TTL from domain constants

/** Clean expired admin cache and whitelist. */
function cleanExpiredCache() {
    const now = Date.now();
    const expiredGroups = [];
    const expiredWhitelist = [];
    
    // Clean admin cache
    for (const [chatId, timestamp] of cacheTimestamps.entries()) {
        if (now - timestamp > DEFAULT_CACHE_DURATION_MS) {
            expiredGroups.push(chatId);
        }
    }
    
    expiredGroups.forEach(chatId => {
        groupAdmins.delete(chatId);
        cacheTimestamps.delete(chatId);
        console.log(`🗑️ 清理过期缓存：群组 ${chatId}`);
    });
    
    // Clean whitelist
    for (const [userKey, timestamp] of whitelistTimestamps.entries()) {
        if (now - timestamp > DEFAULT_WHITELIST_DURATION_MS) {
            expiredWhitelist.push(userKey);
        }
    }
    
    expiredWhitelist.forEach(userKey => {
        whitelistUsers.delete(userKey);
        whitelistTimestamps.delete(userKey);
        console.log(`🗑️ 清理过期白名单：${userKey}`);
    });
}

/**
 * Check whitelist membership.
 * @param {number} chatId
 * @param {number} userId
 * @returns {boolean}
 */
function isUserInWhitelist(chatId, userId) {
    const userKey = `${chatId}_${userId}`;
    const now = Date.now();
    const ts = whitelistTimestamps.get(userKey);
    if (whitelistUsers.has(userKey) && isWhitelistValid(ts, now, DEFAULT_WHITELIST_DURATION_MS)) {
        return true;
    }
    // Cleanup stale entries
    if (whitelistUsers.has(userKey) || whitelistTimestamps.has(userKey)) {
        whitelistUsers.delete(userKey);
        whitelistTimestamps.delete(userKey);
    }
    return false;
}

/**
 * Add user to whitelist.
 * @param {number} chatId
 * @param {number} userId
 * @param {string} reason
 */
function addUserToWhitelist(chatId, userId, reason = 'avatar_check_passed') {
    const userKey = `${chatId}_${userId}`;
    const now = Date.now();
    
    whitelistUsers.set(userKey, { reason, timestamp: now });
    whitelistTimestamps.set(userKey, now);
    
    console.log(`✅ 用户已添加到白名单: ${userKey} (原因: ${reason})`);
}

/**
 * Ensure admin cache is fresh for a group.
 * @param {number} chatId
 * @param {Object} bot
 * @returns {boolean}
 */
async function ensureAdminCache(chatId, bot) {
    const now = Date.now();
    
    // 检查是否有有效缓存
    if (groupAdmins.has(chatId) && cacheTimestamps.has(chatId)) {
        const cacheAge = now - cacheTimestamps.get(chatId);
        if (cacheAge < DEFAULT_CACHE_DURATION_MS) {
            return true;
        }
    }
    
    // 获取新的管理员列表
    const adminData = await fetchAndStoreAdmins(chatId, bot);
    
    if (adminData && adminData.length > 0) {
        cacheTimestamps.set(chatId, now);
        console.log(`✅ 管理员缓存已更新：群组 ${chatId}`);
        return true;
    }
    
    return false;
}

// Periodic cache cleanup (10 min)
setInterval(cleanExpiredCache, 10 * 60 * 1000);

/**
 * Fetch and store group admins.
 * @param {number} chatId
 * @param {Object} bot
 */
async function fetchAndStoreAdmins(chatId, bot) {
    try {
        const admins = await bot.getChatAdministrators(chatId);
        const adminData = admins
            .filter(admin => !admin.user.is_bot)
            .map(admin => ({
                userId: admin.user.id,
                username: admin.user.username ? admin.user.username.toLowerCase() : null,
                firstName: admin.user.first_name || '',
                lastName: admin.user.last_name || '',
                fullName: `${admin.user.first_name || ''} ${admin.user.last_name || ''}`.trim()
            }));
        
        groupAdmins.set(chatId, adminData);
        return adminData;
    } catch (error) {
        console.error(`获取群组 ${chatId} 管理员列表失败:`, error.message);
        return [];
    }
}

/**
 * Get user avatar URL.
 * @param {number} userId
 * @param {Object} bot
 * @returns {string|null}
 */
async function getUserAvatarUrl(userId, bot) {
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
        console.error('获取用户头像失败:', error.message);
        return null;
    }
}

/**
 * Compare two avatars via API.
 * @param {string} avatarUrl1
 * @param {string} avatarUrl2
 * @param {number} userId
 * @returns {boolean}
 */
async function compareAvatars(avatarUrl1, avatarUrl2, userId) {
    try {
        const response = await axios.post(API_ENDPOINT, {
            inputs: {},
            files: [
                {
                    "type": "image",
                    "transfer_method": "remote_url",
                    "url": avatarUrl1
                },
                {
                    "type": "image", 
                    "transfer_method": "remote_url",
                    "url": avatarUrl2
                }
            ],
            query: "is that same?",
            response_mode: "blocking",
            user: String(userId),
        }, {
            headers: {
                Authorization: `Bearer ${SECONDARY_SPAM_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30 * 1000,
        });

        const result = JSON.parse(response.data.answer);
        return result.spam === false && result.similar_avatar === true;
    } catch (error) {
        console.error('头像比较API调用失败:', error.message);
        return false;
    }
}

/**
 * Check admin impersonation by display name.
 * @param {{id:number,username?:string,first_name?:string,last_name?:string}} user
 * @param {number} chatId
 * @param {Object} bot
 * @returns {Object}
 */
async function checkImpersonation(user, chatId, bot) {
    // 首先检查用户是否在白名单中
    if (isUserInWhitelist(chatId, user.id)) {
        console.log(`✅ 用户在白名单中，跳过检测: ${user.username ? '@' + user.username : 'ID:' + user.id}`);
        return { isImpersonation: false, inWhitelist: true };
    }
    
    // 确保有有效的管理员缓存
    const hasCacheSuccess = await ensureAdminCache(chatId, bot);
    if (!hasCacheSuccess) {
        return { isImpersonation: false };
    }
    
    const admins = groupAdmins.get(chatId);
    let userFullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    
    // 如果消息中的显示名为空，尝试通过getChatMember获取准确信息
    if ((!userFullName || userFullName.replace(/\s+/g, '') === '') && bot) {
        try {
            const member = await bot.getChatMember(chatId, user.id);
            const actualFirstName = member.user.first_name || '';
            const actualLastName = member.user.last_name || '';
            const actualFullName = `${actualFirstName} ${actualLastName}`.trim();
            
            if (actualFullName && actualFullName.replace(/\s+/g, '') !== '') {
                userFullName = actualFullName;
                user.first_name = actualFirstName;
                user.last_name = actualLastName;
            }
        } catch (error) {
            // 忽略获取用户信息的错误
        }
    }
    
    // Final display name check
    if (!userFullName || userFullName.replace(/\s+/g, '') === '') {
        return { isImpersonation: false };
    }
    
    for (const admin of admins) {
        // Skip admins without display name
        if (!admin.fullName || admin.fullName.replace(/\s+/g, '') === '') {
            continue;
        }
        
        const potential = isPotentialNameImpersonation({
            user: { id: user.id, username: user.username || null, fullName: userFullName },
            admin,
        });
        if (!potential) continue;

        console.log(`🔍 检测到显示名称匹配，准备比较头像: ${user.username ? '@' + user.username : 'ID:' + user.id} vs 管理员 "${admin.fullName}"`);

        // Get avatar URLs
        const userAvatarUrl = await getUserAvatarUrl(user.id, bot);
        const adminAvatarUrl = await getUserAvatarUrl(admin.userId, bot);

        // Skip avatar compare if missing
        if (!userAvatarUrl || !adminAvatarUrl) {
            console.log(`⚠️ 无法获取头像进行比较，跳过头像检测: 用户头像=${!!userAvatarUrl}, 管理员头像=${!!adminAvatarUrl}`);
            continue;
        }

        // Compare avatars via API
        const avatarsSimilar = await compareAvatars(userAvatarUrl, adminAvatarUrl, user.id);
        const decision = decideAfterAvatarCheck({ avatarsSimilar });

        if (decision.isImpersonation) {
            console.log(`🚨 头像相似度确认冒充: ${user.username ? '@' + user.username : 'ID:' + user.id} 冒充管理员 "${admin.fullName}"`);
            return {
                isImpersonation: true,
                impersonatedAdmin: admin,
                impersonatorDisplayName: userFullName,
                impersonatorUsername: user.username || null,
                avatarComparison: decision.avatarComparison,
            };
        }

        console.log(`✅ 头像不相似，不视为冒充: ${user.username ? '@' + user.username : 'ID:' + user.id} vs 管理员 "${admin.fullName}"`);
        if (decision.addToWhitelist) {
            addUserToWhitelist(chatId, user.id, 'avatar_check_passed');
        }
        return {
            isImpersonation: false,
            avatarComparison: decision.avatarComparison,
            addedToWhitelist: !!decision.addToWhitelist,
        };
    }
    
    return { isImpersonation: false };
}

/**
 * Handle impersonation action (ban, delete, notify).
 * @param {Object} msg
 * @param {Object} bot
 * @param {Object} impersonationData
 */
async function handleImpersonation(msg, bot, impersonationData) {
    const { impersonatedAdmin, impersonatorDisplayName, impersonatorUsername } = impersonationData;
    
    try {
        // Check bot admin rights
        const botInfo = await bot.getMe();
        const botMember = await bot.getChatMember(msg.chat.id, botInfo.id);
        const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);
        
        if (!isBotAdmin) {
            console.log('⚠️ 机器人没有管理员权限，无法踢出冒充用户');
            return;
        }
        
        // Ban user
        await bot.banChatMember(msg.chat.id, msg.from.id);
        
        // Delete message
        try {
            await bot.deleteMessage(msg.chat.id, msg.message_id);
            console.log(`🗑️ 已删除冒充用户的消息: ${msg.message_id}`);
        } catch (deleteError) {
            console.log('删除冒充用户消息失败:', deleteError.message);
        }
        
        // Notify group
        const userIdentifier = impersonatorUsername ? `@${impersonatorUsername}` : `User (ID: ${msg.from.id})`;
        const adminIdentifier = impersonatedAdmin.username ? `@${impersonatedAdmin.username}` : `Admin (ID: ${impersonatedAdmin.userId})`;
        
        const notificationMessage = `⚠️ ${userIdentifier} has been removed for impersonating administrator "${impersonatedAdmin.fullName}" (${adminIdentifier}). Their message has been deleted.`;
        await bot.sendMessage(msg.chat.id, notificationMessage);
        
        // Send admin report
        const adminReport = `🚨 Display Name Impersonation Alert\n\n` +
            `Group: ${msg.chat.title || 'Unknown'} (ID: ${msg.chat.id})\n` +
            `Impersonator: ${userIdentifier} (ID: ${msg.from.id})\n` +
            `Display Name Used: "${impersonatorDisplayName}"\n` +
            `Impersonated Admin: ${adminIdentifier} (ID: ${impersonatedAdmin.userId})\n` +
            `Admin Display Name: "${impersonatedAdmin.fullName}"\n` +
            `Action: User kicked from group and message deleted\n` +
            `Message ID: ${msg.message_id}`;
        
        // 发送给指定管理员
        if (KOUSH_USER_ID) {
            try {
                await bot.sendMessage(KOUSH_USER_ID, adminReport);
            } catch (error) {
                console.log('发送报告给KOUSH失败:', error.message);
            }
        }
        if (ALITAYIN_USER_ID) {
            try {
                await bot.sendMessage(ALITAYIN_USER_ID, adminReport);
            } catch (error) {
                console.log('发送报告给ALITAYIN失败:', error.message);
            }
        }
        
        console.log(`🚨 已踢出冒充用户并删除消息: ${userIdentifier} (冒充 "${impersonatedAdmin.fullName}")`);
        
    } catch (error) {
        console.error('处理冒充用户时出错:', error.message);
        
        // Send error hint
        try {
            const userIdentifier = impersonatorUsername ? `@${impersonatorUsername}` : `User (ID: ${msg.from.id})`;
            const adminIdentifier = impersonatedAdmin.username ? `@${impersonatedAdmin.username}` : `Admin (ID: ${impersonatedAdmin.userId})`;
            const errorMessage = `⚠️ Detected ${userIdentifier} impersonating "${impersonatedAdmin.fullName}" (${adminIdentifier}), but failed to remove. Please check manually.`;
            await bot.sendMessage(msg.chat.id, errorMessage);
        } catch (sendError) {
            console.error('发送错误消息失败:', sendError.message);
        }
    }
}

/**
 * 获取存储的管理员信息
 * @param {number} chatId - 群组ID
 * @returns {Array} 管理员列表
 */
function getStoredAdmins(chatId) {
    return groupAdmins.get(chatId) || [];
}

/**
 * 获取白名单统计信息
 * @returns {Object} 白名单统计
 */
function getWhitelistStats() {
    return {
        totalUsers: whitelistUsers.size,
        users: Array.from(whitelistUsers.entries()).map(([key, data]) => ({
            key,
            reason: data.reason,
            timestamp: data.timestamp,
            age: Date.now() - data.timestamp
        }))
    };
}

module.exports = {
    fetchAndStoreAdmins,
    checkImpersonation,
    handleImpersonation,
    getStoredAdmins,
    ensureAdminCache,
    getWhitelistStats,
    isUserInWhitelist,
    addUserToWhitelist
}; 
