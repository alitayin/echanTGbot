// In-memory cache for impersonation detection
// Infrastructure layer module

const {
    DEFAULT_CACHE_DURATION_MS,
    DEFAULT_WHITELIST_DURATION_MS,
    isWhitelistValid,
} = require('../../domain/policies/impersonationPolicy.js');

// Admin cache per group
const groupAdmins = new Map();
const cacheTimestamps = new Map();

// Whitelist: users passed avatar check
const whitelistUsers = new Map(); // key: `${chatId}_${userId}`, value: { reason, timestamp }
const whitelistTimestamps = new Map(); // key: `${chatId}_${userId}`, value: timestamp

/**
 * Clean expired admin cache and whitelist
 */
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
        console.log(`🗑️ Cleaned expired cache: group ${chatId}`);
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
        console.log(`🗑️ Cleaned expired whitelist: ${userKey}`);
    });
}

// Periodic cache cleanup (10 min)
setInterval(cleanExpiredCache, 10 * 60 * 1000);

/**
 * Get cached admins for a group
 * @param {number} chatId - Chat ID
 * @returns {Array|null} Admin list or null if not cached/expired
 */
function getCachedAdmins(chatId) {
    const now = Date.now();
    
    if (groupAdmins.has(chatId) && cacheTimestamps.has(chatId)) {
        const cacheAge = now - cacheTimestamps.get(chatId);
        if (cacheAge < DEFAULT_CACHE_DURATION_MS) {
            return groupAdmins.get(chatId);
        }
    }
    
    return null;
}

/**
 * Store admins in cache
 * @param {number} chatId - Chat ID
 * @param {Array} adminData - Admin list
 */
function setCachedAdmins(chatId, adminData) {
    const now = Date.now();
    groupAdmins.set(chatId, adminData);
    cacheTimestamps.set(chatId, now);
    console.log(`✅ Admin cache updated: group ${chatId}`);
}

/**
 * Check if user is in whitelist
 * @param {number} chatId - Chat ID
 * @param {number} userId - User ID
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
 * Add user to whitelist
 * @param {number} chatId - Chat ID
 * @param {number} userId - User ID
 * @param {string} reason - Reason for whitelisting
 */
function addUserToWhitelist(chatId, userId, reason = 'avatar_check_passed') {
    const userKey = `${chatId}_${userId}`;
    const now = Date.now();
    
    whitelistUsers.set(userKey, { reason, timestamp: now });
    whitelistTimestamps.set(userKey, now);
    
    console.log(`✅ User added to whitelist: ${userKey} (reason: ${reason})`);
}

/**
 * Get whitelist statistics
 * @returns {Object} Whitelist stats
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

/**
 * Get stored admins (for external queries)
 * @param {number} chatId - Chat ID
 * @returns {Array} Admin list
 */
function getStoredAdmins(chatId) {
    return groupAdmins.get(chatId) || [];
}

module.exports = {
    cleanExpiredCache,
    getCachedAdmins,
    setCachedAdmins,
    isUserInWhitelist,
    addUserToWhitelist,
    getWhitelistStats,
    getStoredAdmins
};


