// Persisted tracker for users' normal message streaks globally.
// Keyed by `userId`.
// When a user reaches the configured number of consecutive normal messages
// in any group, they are treated as "trusted" across all groups.

const { Level } = require('level');
const path = require('path');
const { NORMAL_STREAK_THRESHOLD } = require('../../../config/config.js');

const dbPath = process.env.NORMAL_MESSAGE_TRACKER_DB_PATH || path.join(__dirname, '../../../data/normalMessageTracker');
const db = new Level(dbPath, { valueEncoding: 'json' });

/**
 * @typedef {Object} NormalMessageRecord
 * @property {number} streak - Current consecutive normal message count
 * @property {boolean} trusted - Whether the user is globally trusted
 * @property {number} lastUpdated - Timestamp of the last update
 */

/** @type {Map<string, NormalMessageRecord>} */
const normalMessageTracker = new Map();

let loadPromise = null;

function makeKey(userId) {
    return String(userId);
}

function parseTrackerKey(rawKey) {
    const key = String(rawKey || '');
    if (!key) {
        return null;
    }

    const parts = key.split(':');
    if (parts.length === 1) {
        return { userId: parts[0], legacy: false };
    }

    if (parts.length === 2 && parts[1]) {
        return { userId: parts[1], legacy: true };
    }

    return null;
}

function normalizeRecord(record) {
    if (!record || typeof record !== 'object') {
        return null;
    }

    const streakValue = Number(record.streak);
    const lastUpdatedValue = Number(record.lastUpdated);

    return {
        streak: Number.isFinite(streakValue) && streakValue >= 0 ? streakValue : 0,
        trusted: record.trusted === true,
        lastUpdated: Number.isFinite(lastUpdatedValue) ? lastUpdatedValue : Date.now(),
    };
}

function mergeRecords(existing, incoming) {
    const base = normalizeRecord(existing) || {
        streak: 0,
        trusted: false,
        lastUpdated: 0,
    };
    const next = normalizeRecord(incoming) || {
        streak: 0,
        trusted: false,
        lastUpdated: 0,
    };

    return {
        streak: Math.max(base.streak, next.streak),
        trusted: base.trusted || next.trusted,
        lastUpdated: Math.max(base.lastUpdated, next.lastUpdated),
    };
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

async function migrateLegacyRecords(aggregatedRecords, legacyKeys) {
    for (const legacyKey of legacyKeys) {
        await deleteRecord(legacyKey);
    }

    for (const [key, record] of aggregatedRecords.entries()) {
        await persistRecord(key, record);
    }

    console.log(`Migrated ${legacyKeys.length} legacy trusted record(s) to global format`);
}

async function ensureLoaded() {
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                const aggregatedRecords = new Map();
                const legacyKeys = [];

                for await (const [rawKey, value] of db.iterator()) {
                    const parsedKey = parseTrackerKey(rawKey);
                    const normalizedRecord = normalizeRecord(value);
                    if (!parsedKey || !normalizedRecord) {
                        continue;
                    }

                    const userKey = makeKey(parsedKey.userId);
                    const mergedRecord = mergeRecords(aggregatedRecords.get(userKey), normalizedRecord);
                    aggregatedRecords.set(userKey, mergedRecord);

                    if (parsedKey.legacy) {
                        legacyKeys.push(String(rawKey));
                    }
                }

                normalMessageTracker.clear();
                for (const [key, record] of aggregatedRecords.entries()) {
                    normalMessageTracker.set(key, record);
                }

                console.log(`Loaded ${normalMessageTracker.size} normal message records from DB`);

                if (legacyKeys.length > 0) {
                    await migrateLegacyRecords(aggregatedRecords, legacyKeys);
                }
            } catch (err) {
                console.error('Failed to load normal message tracker DB:', err);
            }
        })();
    }
    return loadPromise;
}

/**
 * Check if a user is globally trusted.
 * @param {number|string} userId
 * @returns {Promise<boolean>}
 */
async function isUserTrusted(userId) {
    await ensureLoaded();
    if (userId == null) return false;
    const key = makeKey(userId);
    const record = normalMessageTracker.get(key);
    return Boolean(record && record.trusted === true);
}

/**
 * Record a normal (non-spam) message for a user.
 * Increments the user's global consecutive normal message streak and marks the
 * user as trusted once the threshold is reached.
 * @param {number|string} userId
 * @returns {Promise<NormalMessageRecord>}
 */
async function recordNormalMessage(userId) {
    await ensureLoaded();
    if (userId == null) return null;
    const key = makeKey(userId);
    const now = Date.now();

    const existing = normalMessageTracker.get(key) || {
        streak: 0,
        trusted: false,
        lastUpdated: now,
    };

    if (existing.trusted) {
        existing.lastUpdated = now;
        normalMessageTracker.set(key, existing);
        await persistRecord(key, existing);
        return existing;
    }

    existing.streak += 1;
    existing.lastUpdated = now;

    if (existing.streak >= NORMAL_STREAK_THRESHOLD) {
        existing.trusted = true;
        console.log(`User ${userId} reached normal streak ${existing.streak}, marked as globally trusted`);
    }

    normalMessageTracker.set(key, existing);
    await persistRecord(key, existing);
    return existing;
}

/**
 * Reset the global normal message streak for a user.
 * This can be called when spam is detected to require the user to rebuild trust.
 * @param {number|string} userId
 */
async function resetNormalMessageStreak(userId) {
    await ensureLoaded();
    if (userId == null) return;
    const key = makeKey(userId);
    const existing = normalMessageTracker.get(key);
    if (!existing) return;

    const resetRecord = {
        streak: 0,
        trusted: false,
        lastUpdated: Date.now(),
    };

    normalMessageTracker.set(key, resetRecord);
    await persistRecord(key, resetRecord);
}

/**
 * Mark a user as globally trusted (manual override).
 * @param {number|string} userId
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
async function markUserTrusted(userId, reason = 'manual') {
    await ensureLoaded();
    if (userId == null) return false;
    const key = makeKey(userId);
    const now = Date.now();
    const existing = normalMessageTracker.get(key);
    const streakValue = existing && Number.isFinite(Number(existing.streak))
        ? Number(existing.streak)
        : 0;
    const updated = {
        streak: Math.max(streakValue, NORMAL_STREAK_THRESHOLD),
        trusted: true,
        lastUpdated: now,
    };
    normalMessageTracker.set(key, updated);
    await persistRecord(key, updated);
    console.log(`User ${userId} marked as globally trusted (reason: ${reason})`);
    return true;
}

/**
 * Export all tracker records for backup.
 * @returns {Promise<Array<{userId: string, streak: number, trusted: boolean, lastUpdated: number}>>}
 */
async function exportTrustedRecords() {
    await ensureLoaded();
    const records = [];
    for (const [userId, record] of normalMessageTracker.entries()) {
        const normalizedRecord = normalizeRecord(record);
        if (!normalizedRecord) {
            continue;
        }

        records.push({
            userId,
            streak: normalizedRecord.streak,
            trusted: normalizedRecord.trusted,
            lastUpdated: normalizedRecord.lastUpdated,
        });
    }
    return records;
}

/**
 * Import tracker records from backup.
 * Accepts both the current global format and the legacy group-scoped format.
 * @param {Array} records
 * @returns {Promise<{success: number, failed: number, errors: Array<string>}>}
 */
async function importTrustedRecords(records) {
    await ensureLoaded();
    const results = { success: 0, failed: 0, errors: [] };
    if (!Array.isArray(records)) {
        return results;
    }

    const aggregatedImports = new Map();

    for (const record of records) {
        try {
            if (!record || record.userId == null) {
                results.failed += 1;
                results.errors.push(`Missing userId for record: ${JSON.stringify(record)}`);
                continue;
            }

            const key = makeKey(record.userId);
            const normalizedRecord = normalizeRecord(record);
            if (!normalizedRecord) {
                results.failed += 1;
                results.errors.push(`Invalid trusted record: ${JSON.stringify(record)}`);
                continue;
            }

            aggregatedImports.set(key, mergeRecords(aggregatedImports.get(key), normalizedRecord));
        } catch (error) {
            results.failed += 1;
            results.errors.push(`Failed to import trusted record: ${error.message}`);
            console.error('❌ Failed to import trusted record:', error);
        }
    }

    for (const [key, data] of aggregatedImports.entries()) {
        normalMessageTracker.set(key, data);
        await persistRecord(key, data);
        results.success += 1;
    }

    return results;
}

/**
 * Periodic cleanup to avoid unbounded memory growth.
 * Only remove invalid records; do not expire trusted status by time.
 */
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

setInterval(async () => {
    await ensureLoaded();
    for (const [key, record] of normalMessageTracker.entries()) {
        if (!record || typeof record.lastUpdated !== 'number') {
            normalMessageTracker.delete(key);
            deleteRecord(key);
        }
    }
}, CLEANUP_INTERVAL_MS);

module.exports = {
    NORMAL_STREAK_THRESHOLD,
    isUserTrusted,
    recordNormalMessage,
    resetNormalMessageStreak,
    markUserTrusted,
    exportTrustedRecords,
    importTrustedRecords,
};
