const { createLevelStore, resolveStorePath } = require('./levelStoreRegistry.js');

// Initialize levelDB for whitelist keywords
const dbPath = resolveStorePath('WHITELIST_KEYWORD_DB_PATH', 'whitelistKeywords');
let db = createLevelStore(dbPath, { valueEncoding: 'json' });
let dbOpenPromise = db.open();

/**
 * Ensure database is open and ready
 */
async function ensureOpen() {
    if (db.status === 'open') {
        return db;
    }
    if (db.status === 'opening') {
        await dbOpenPromise;
        return db;
    }
    // status === 'closed' or 'new'
    db = createLevelStore(dbPath, { valueEncoding: 'json' });
    dbOpenPromise = db.open();
    await dbOpenPromise;
    return db;
}

/**
 * Add a keyword to the whitelist
 * @param {string} keyword - Keyword to whitelist
 * @param {string} addedBy - Username who added the keyword
 * @returns {Promise<boolean>}
 */
async function addWhitelistKeyword(keyword, addedBy) {
    try {
        const database = await ensureOpen();
        const normalizedKeyword = keyword.toLowerCase().trim();
        const key = `keyword:${normalizedKeyword}`;
        const data = {
            keyword: normalizedKeyword,
            addedBy,
            addedAt: new Date().toISOString()
        };
        await database.put(key, data);
        console.log(`✅ Whitelist keyword added: "${normalizedKeyword}" by ${addedBy}`);
        return true;
    } catch (error) {
        console.error('Failed to add whitelist keyword:', error);
        return false;
    }
}

/**
 * Remove a keyword from the whitelist
 * @param {string} keyword - Keyword to remove
 * @returns {Promise<boolean>}
 */
async function removeWhitelistKeyword(keyword) {
    try {
        const database = await ensureOpen();
        const normalizedKeyword = keyword.toLowerCase().trim();
        const key = `keyword:${normalizedKeyword}`;
        await database.del(key);
        console.log(`✅ Whitelist keyword removed: "${normalizedKeyword}"`);
        return true;
    } catch (error) {
        console.error('Failed to remove whitelist keyword:', error);
        return false;
    }
}

/**
 * Check if a keyword is in the whitelist
 * @param {string} keyword - Keyword to check
 * @returns {Promise<boolean>}
 */
async function isWhitelistKeyword(keyword) {
    try {
        const database = await ensureOpen();
        const normalizedKeyword = keyword.toLowerCase().trim();
        const key = `keyword:${normalizedKeyword}`;
        await database.get(key);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        console.error('Failed to check whitelist keyword:', error);
        return false;
    }
}

/**
 * Check if a message contains any whitelisted keyword
 * @param {string} message - Message to check
 * @returns {Promise<string|null>} - Returns the matched keyword or null
 */
async function containsWhitelistKeyword(message) {
    try {
        const normalizedMessage = message.toLowerCase();
        const keywords = await getAllWhitelistKeywords();
        
        for (const keywordData of keywords) {
            const keyword = keywordData.keyword.toLowerCase();
            // Check if message contains the keyword (case-insensitive)
            if (normalizedMessage.includes(keyword)) {
                console.log(`✅ Message contains whitelisted keyword: "${keyword}"`);
                return keyword;
            }
        }
        
        return null;
    } catch (error) {
        console.error('Failed to check message for whitelist keywords:', error);
        return null;
    }
}

/**
 * Get all whitelisted keywords
 * @returns {Promise<Array>}
 */
async function getAllWhitelistKeywords() {
    try {
        const database = await ensureOpen();
        const keywords = [];
        for await (const [key, value] of database.iterator()) {
            if (key.startsWith('keyword:')) {
                keywords.push(value);
            }
        }
        return keywords;
    } catch (error) {
        console.error('Failed to get all whitelist keywords:', error);
        return [];
    }
}

/**
 * Close database connection (idempotent — safe to call multiple times)
 */
async function closeDB() {
    try {
        if (db && db.status !== 'closed') {
            await db.close();
        }
    } catch {
        // ignore — already closed or in error state
    }
}

module.exports = {
    addWhitelistKeyword,
    removeWhitelistKeyword,
    isWhitelistKeyword,
    containsWhitelistKeyword,
    getAllWhitelistKeywords,
    closeDB
};
