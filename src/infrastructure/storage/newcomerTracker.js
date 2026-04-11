const { Level } = require('level');
const path = require('path');

const NEWCOMER_RESTRICTION_WINDOW_MS = 60 * 60 * 1000;
const STALE_RECORD_TTL_MS = 24 * 60 * 60 * 1000;

const dbPath = process.env.NEWCOMER_TRACKER_DB_PATH || path.join(__dirname, '../../../data/newcomerTracker');
const db = new Level(dbPath, { valueEncoding: 'json' });

const newcomerTracker = new Map();

let loadPromise = null;

function makeKey(chatId, userId) {
    return `${String(chatId)}:${String(userId)}`;
}

function normalizeRecord(record) {
    if (!record || typeof record !== 'object') {
        return null;
    }

    const joinedAtValue = Number(record.joinedAt);
    const updatedAtValue = Number(record.updatedAt);

    if (!Number.isFinite(joinedAtValue) || joinedAtValue <= 0) {
        return null;
    }

    return {
        joinedAt: joinedAtValue,
        updatedAt: Number.isFinite(updatedAtValue) ? updatedAtValue : joinedAtValue,
    };
}

async function ensureLoaded() {
    if (!loadPromise) {
        loadPromise = (async () => {
            try {
                for await (const [key, value] of db.iterator()) {
                    const normalizedRecord = normalizeRecord(value);
                    if (normalizedRecord) {
                        newcomerTracker.set(String(key), normalizedRecord);
                    }
                }
                console.log(`Loaded ${newcomerTracker.size} newcomer records from DB`);
            } catch (err) {
                console.error('Failed to load newcomer tracker DB:', err);
            }
        })();
    }
    return loadPromise;
}

async function persistRecord(key, record) {
    try {
        await db.put(key, record);
    } catch (err) {
        console.error(`Failed to persist newcomer record for ${key}:`, err);
    }
}

async function deleteRecord(key) {
    try {
        await db.del(key);
    } catch (err) {
        if (err.code !== 'LEVEL_NOT_FOUND') {
            console.error(`Failed to delete newcomer record for ${key}:`, err);
        }
    }
}

async function recordNewcomerJoin(chatId, userId, joinedAt = Date.now()) {
    await ensureLoaded();
    if (chatId == null || userId == null) return null;

    const safeJoinedAt = Number.isFinite(Number(joinedAt)) && Number(joinedAt) > 0
        ? Number(joinedAt)
        : Date.now();
    const key = makeKey(chatId, userId);
    const record = {
        joinedAt: safeJoinedAt,
        updatedAt: Date.now(),
    };

    newcomerTracker.set(key, record);
    await persistRecord(key, record);
    return record;
}

async function clearNewcomerJoin(chatId, userId) {
    await ensureLoaded();
    if (chatId == null || userId == null) return;

    const key = makeKey(chatId, userId);
    newcomerTracker.delete(key);
    await deleteRecord(key);
}

async function isUserRestrictedNewcomer(chatId, userId, now = Date.now()) {
    await ensureLoaded();
    if (chatId == null || userId == null) return false;

    const key = makeKey(chatId, userId);
    const record = newcomerTracker.get(key);
    if (!record) {
        return false;
    }

    const normalizedRecord = normalizeRecord(record);
    if (!normalizedRecord) {
        newcomerTracker.delete(key);
        await deleteRecord(key);
        return false;
    }

    return now - normalizedRecord.joinedAt <= NEWCOMER_RESTRICTION_WINDOW_MS;
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

setInterval(async () => {
    await ensureLoaded();
    const now = Date.now();
    for (const [key, record] of newcomerTracker.entries()) {
        const normalizedRecord = normalizeRecord(record);
        if (!normalizedRecord || now - normalizedRecord.joinedAt > STALE_RECORD_TTL_MS) {
            newcomerTracker.delete(key);
            deleteRecord(key);
        }
    }
}, CLEANUP_INTERVAL_MS);

module.exports = {
    NEWCOMER_RESTRICTION_WINDOW_MS,
    recordNewcomerJoin,
    clearNewcomerJoin,
    isUserRestrictedNewcomer,
};
