// In-memory tracker for users' normal message streaks in each group.
// Keyed by `${chatId}:${userId}`.
// When a user in a group has a configured number of consecutive normal messages,
// they are treated as "trusted" and group spam detection can be skipped for them.

const { NORMAL_STREAK_THRESHOLD } = require('../../../config/config.js');

/**
 * @typedef {Object} NormalMessageRecord
 * @property {number} streak - Current consecutive normal message count
 * @property {boolean} trusted - Whether the user is considered trusted in this group
 * @property {number} lastUpdated - Timestamp of the last update
 */

/** @type {Map<string, NormalMessageRecord>} */
const normalMessageTracker = new Map();

function makeKey(chatId, userId) {
    return `${String(chatId)}:${String(userId)}`;
}

/**
 * Check if a user is trusted in a specific group.
 * @param {number|string} chatId
 * @param {number|string} userId
 * @returns {boolean}
 */
function isUserTrustedInGroup(chatId, userId) {
    if (chatId == null || userId == null) return false;
    const key = makeKey(chatId, userId);
    const record = normalMessageTracker.get(key);
    return Boolean(record && record.trusted === true);
}

/**
 * Record a normal (non-spam) message for a user in a group.
 * Increments the consecutive normal message streak and marks the user as trusted
 * once the threshold is reached.
 * @param {number|string} chatId
 * @param {number|string} userId
 * @returns {NormalMessageRecord}
 */
function recordNormalMessageInGroup(chatId, userId) {
    if (chatId == null || userId == null) return null;
    const key = makeKey(chatId, userId);
    const now = Date.now();

    const existing = normalMessageTracker.get(key) || {
        streak: 0,
        trusted: false,
        lastUpdated: now,
    };

    // If already trusted, just refresh timestamp
    if (existing.trusted) {
        existing.lastUpdated = now;
        normalMessageTracker.set(key, existing);
        return existing;
    }

    existing.streak += 1;
    existing.lastUpdated = now;

    if (existing.streak >= NORMAL_STREAK_THRESHOLD) {
        existing.trusted = true;
        console.log(
            `User ${userId} in chat ${chatId} reached normal streak ${existing.streak}, marked as trusted`
        );
    }

    normalMessageTracker.set(key, existing);
    return existing;
}

/**
 * Reset the normal message streak for a user in a group.
 * This can be called when spam is detected to require the user to rebuild trust.
 * @param {number|string} chatId
 * @param {number|string} userId
 */
function resetNormalMessageStreakInGroup(chatId, userId) {
    if (chatId == null || userId == null) return;
    const key = makeKey(chatId, userId);
    const existing = normalMessageTracker.get(key);
    if (!existing) return;

    normalMessageTracker.set(key, {
        streak: 0,
        trusted: false,
        lastUpdated: Date.now(),
    });
}

/**
 * Periodic cleanup to avoid unbounded memory growth.
 * Records that have not been updated for more than 24 hours are removed.
 */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; 
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

setInterval(() => {
    const now = Date.now();
    for (const [key, record] of normalMessageTracker.entries()) {
        if (!record || typeof record.lastUpdated !== 'number') {
            normalMessageTracker.delete(key);
            continue;
        }
        if (now - record.lastUpdated > RECORD_TTL_MS) {
            normalMessageTracker.delete(key);
        }
    }
}, CLEANUP_INTERVAL_MS);

module.exports = {
    NORMAL_STREAK_THRESHOLD,
    isUserTrustedInGroup,
    recordNormalMessageInGroup,
    resetNormalMessageStreakInGroup,
};


