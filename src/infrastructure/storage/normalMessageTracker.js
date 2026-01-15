// Persisted tracker for users' normal message streaks in each group.
// Keyed by `${chatId}:${userId}`.
// When a user in a group has a configured number of consecutive normal messages,
// they are treated as "trusted" and group spam detection can be skipped for them.

const { Level } = require('level');
const path = require('path');
const { NORMAL_STREAK_THRESHOLD } = require('../../../config/config.js');

const dbPath = path.join(__dirname, '../../../data/normalMessageTracker');
const db = new Level(dbPath, { valueEncoding: 'json' });

/**
 * @typedef {Object} NormalMessageRecord
 * @property {number} streak - Current consecutive normal message count
 * @property {boolean} trusted - Whether the user is considered trusted in this group
 * @property {number} lastUpdated - Timestamp of the last update
 */

/** @type {Map<string, NormalMessageRecord>} */
const normalMessageTracker = new Map();

let loadPromise = null;

async function ensureLoaded() {
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                for await (const [key, value] of db.iterator()) {
                    if (value && typeof value === 'object') {
                        normalMessageTracker.set(key, value);
                    }
                }
                console.log(`Loaded ${normalMessageTracker.size} normal message records from DB`);
            } catch (err) {
                console.error('Failed to load normal message tracker DB:', err);
            }
        })();
    }
    return loadPromise;
}

async function persistRecord(key, record) {
    try {
        await db.put(key, record);
    } catch (err) {
        console.error(`Failed to persist normal message record for ${key}:`, err);
    }
}

async function deleteRecord(key) {
    try {
        await db.del(key);
    } catch (err) {
        if (err.code !== 'LEVEL_NOT_FOUND') {
            console.error(`Failed to delete normal message record for ${key}:`, err);
        }
    }
}

function makeKey(chatId, userId) {
    return `${String(chatId)}:${String(userId)}`;
}

/**
 * Check if a user is trusted in a specific group.
 * @param {number|string} chatId
 * @param {number|string} userId
 * @returns {Promise<boolean>}
 */
async function isUserTrustedInGroup(chatId, userId) {
    await ensureLoaded();
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
 * @returns {Promise<NormalMessageRecord>}
 */
async function recordNormalMessageInGroup(chatId, userId) {
    await ensureLoaded();
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
        persistRecord(key, existing);
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
    persistRecord(key, existing);
    return existing;
}

/**
 * Reset the normal message streak for a user in a group.
 * This can be called when spam is detected to require the user to rebuild trust.
 * @param {number|string} chatId
 * @param {number|string} userId
 */
async function resetNormalMessageStreakInGroup(chatId, userId) {
    await ensureLoaded();
    if (chatId == null || userId == null) return;
    const key = makeKey(chatId, userId);
    const existing = normalMessageTracker.get(key);
    if (!existing) return;

    const resetRecord = {
        streak: 0,
        trusted: false,
        lastUpdated: Date.now(),
    };

    normalMessageTracker.set(key, resetRecord);
    persistRecord(key, resetRecord);
}

/**
 * Export all trusted tracker records for backup.
 * @returns {Promise<Array<{chatId: string, userId: string, streak: number, trusted: boolean, lastUpdated: number}>>}
 */
async function exportTrustedRecords() {
    await ensureLoaded();
    const records = [];
    for (const [key, record] of normalMessageTracker.entries()) {
        if (!record || typeof record !== 'object') {
            continue;
        }
        const [chatId, userId] = String(key).split(':');
        if (!chatId || !userId) {
            continue;
        }
        const streakValue = Number(record.streak);
        const lastUpdatedValue = Number(record.lastUpdated);
        records.push({
            chatId,
            userId,
            streak: Number.isFinite(streakValue) && streakValue >= 0 ? streakValue : 0,
            trusted: record.trusted === true,
            lastUpdated: Number.isFinite(lastUpdatedValue) ? lastUpdatedValue : Date.now(),
        });
    }
    return records;
}

/**
 * Import trusted tracker records from backup.
 * @param {Array} records
 * @returns {Promise<{success: number, failed: number, errors: Array<string>}>}
 */
async function importTrustedRecords(records) {
    await ensureLoaded();
    const results = { success: 0, failed: 0, errors: [] };
    if (!Array.isArray(records)) {
        return results;
    }
    for (const record of records) {
        try {
            if (!record || record.chatId == null || record.userId == null) {
                results.failed += 1;
                results.errors.push(`Missing chatId or userId for record: ${JSON.stringify(record)}`);
                continue;
            }
            const key = makeKey(record.chatId, record.userId);
            const streakValue = Number(record.streak);
            const lastUpdatedValue = Number(record.lastUpdated);
            const data = {
                streak: Number.isFinite(streakValue) && streakValue >= 0 ? streakValue : 0,
                trusted: record.trusted === true,
                lastUpdated: Number.isFinite(lastUpdatedValue) ? lastUpdatedValue : Date.now(),
            };
            normalMessageTracker.set(key, data);
            await persistRecord(key, data);
            results.success += 1;
        } catch (error) {
            results.failed += 1;
            results.errors.push(`Failed to import trusted record: ${error.message}`);
            console.error('❌ Failed to import trusted record:', error);
        }
    }
    return results;
}

/**
 * Periodic cleanup to avoid unbounded memory growth.
 * Records that have not been updated for more than 24 hours are removed.
 */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; 
const RECORD_TTL_MS = 24 * 60 * 60 * 1000;

setInterval(async () => {
    await ensureLoaded();
    const now = Date.now();
    for (const [key, record] of normalMessageTracker.entries()) {
        if (!record || typeof record.lastUpdated !== 'number') {
            normalMessageTracker.delete(key);
            deleteRecord(key);
            continue;
        }
        if (now - record.lastUpdated > RECORD_TTL_MS) {
            normalMessageTracker.delete(key);
            deleteRecord(key);
        }
    }
}, CLEANUP_INTERVAL_MS);

module.exports = {
    NORMAL_STREAK_THRESHOLD,
    isUserTrustedInGroup,
    recordNormalMessageInGroup,
    resetNormalMessageStreakInGroup,
    exportTrustedRecords,
    importTrustedRecords,
};


