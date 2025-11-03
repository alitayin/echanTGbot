const { Level } = require('level');
const path = require('path');

// Initialize levelDB
const dbPath = path.join(__dirname, '../../../data/userAddresses');
const db = new Level(dbPath, { valueEncoding: 'json' });

/**
 * Save user's eCash address
 * @param {string|number} userId - Telegram user ID
 * @param {string} address - eCash address
 * @param {string} username - Telegram username (optional, for logging)
 * @returns {Promise<boolean>}
 */
async function saveUserAddress(userId, address, username = null) {
    try {
        const key = `user:${userId}`;
        const data = {
            userId: String(userId),
            address,
            username,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await db.put(key, data);
        console.log(`✅ Address saved for user ${userId} (${username || 'unknown'})`);
        return true;
    } catch (error) {
        console.error('Failed to save user address:', error);
        return false;
    }
}

/**
 * Get user's eCash address by user ID
 * @param {string|number} userId - Telegram user ID
 * @returns {Promise<object|null>} - User data or null
 */
async function getUserAddress(userId) {
    try {
        const key = `user:${userId}`;
        const data = await db.get(key);
        return data;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return null;
        }
        console.error('Failed to get user address:', error);
        throw error;
    }
}

/**
 * Get all registered users
 * @returns {Promise<Array>} - Array of user data
 */
async function getAllUsers() {
    try {
        const users = [];
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('user:')) {
                users.push(value);
            }
        }
        return users;
    } catch (error) {
        console.error('Failed to get all users:', error);
        return [];
    }
}

/**
 * Delete user's address
 * @param {string|number} userId - Telegram user ID
 * @returns {Promise<boolean>}
 */
async function deleteUserAddress(userId) {
    try {
        const key = `user:${userId}`;
        await db.del(key);
        console.log(`✅ Address deleted for user ${userId}`);
        return true;
    } catch (error) {
        console.error('Failed to delete user address:', error);
        return false;
    }
}

/**
 * Export all user data as JSON string
 * @returns {Promise<string>} - JSON string of all user data
 */
async function exportAllData() {
    try {
        const users = await getAllUsers();
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            totalUsers: users.length,
            users: users
        };
        return JSON.stringify(exportData, null, 2);
    } catch (error) {
        console.error('Failed to export data:', error);
        throw error;
    }
}

/**
 * Import user data from JSON string
 * @param {string} jsonData - JSON string containing user data
 * @returns {Promise<{success: number, failed: number, errors: Array}>}
 */
async function importAllData(jsonData) {
    const results = {
        success: 0,
        failed: 0,
        errors: []
    };

    try {
        const importData = JSON.parse(jsonData);
        
        if (!importData.users || !Array.isArray(importData.users)) {
            throw new Error('Invalid data format: missing users array');
        }

        console.log(`🔄 Starting import of ${importData.users.length} users...`);

        for (const user of importData.users) {
            try {
                // Validate required fields
                if (!user.userId || !user.address) {
                    results.failed++;
                    results.errors.push(`Missing userId or address for user: ${JSON.stringify(user)}`);
                    continue;
                }

                const key = `user:${user.userId}`;
                const data = {
                    userId: String(user.userId),
                    address: user.address,
                    username: user.username || null,
                    createdAt: user.createdAt || new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await db.put(key, data);
                results.success++;
                console.log(`✅ Imported user ${user.userId} (${user.username || 'unknown'})`);
            } catch (error) {
                results.failed++;
                results.errors.push(`Failed to import user ${user.userId}: ${error.message}`);
                console.error(`❌ Failed to import user ${user.userId}:`, error);
            }
        }

        console.log(`✅ Import completed: ${results.success} success, ${results.failed} failed`);
        return results;
    } catch (error) {
        console.error('Failed to import data:', error);
        throw error;
    }
}

/**
 * Close database connection
 */
async function closeDB() {
    try {
        await db.close();
        console.log('✅ Database connection closed');
    } catch (error) {
        console.error('Failed to close database:', error);
    }
}

module.exports = {
    saveUserAddress,
    getUserAddress,
    getAllUsers,
    deleteUserAddress,
    exportAllData,
    importAllData,
    closeDB
};


