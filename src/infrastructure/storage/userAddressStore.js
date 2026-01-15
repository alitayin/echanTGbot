const { Level } = require('level');
const path = require('path');
const {
    getAllMessages,
    getAllScheduledMessages,
    saveMessage,
    saveScheduledMessage
} = require('./storedMessageStore.js');
const { exportTrustedRecords, importTrustedRecords } = require('./normalMessageTracker.js');

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
        const [users, messages, scheduledMessages, trustedRecords] = await Promise.all([
            getAllUsers(),
            getAllMessages(),
            getAllScheduledMessages(),
            exportTrustedRecords()
        ]);

        const exportData = {
            version: '1.2',
            exportDate: new Date().toISOString(),
            totalUsers: users.length,
            totalMessages: messages.length,
            totalScheduledMessages: scheduledMessages.length,
            totalTrustedRecords: trustedRecords.length,
            users,
            messages,
            scheduledMessages,
            trustedRecords
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
        users: { success: 0, failed: 0, errors: [] },
        messages: { success: 0, failed: 0, errors: [] },
        scheduledMessages: { success: 0, failed: 0, errors: [] },
        trustedRecords: { success: 0, failed: 0, errors: [] }
    };

    try {
        const importData = JSON.parse(jsonData);
        const usersArray = Array.isArray(importData.users) ? importData.users : null;
        if (!usersArray) {
            throw new Error('Invalid data format: missing users array');
        }

        const messagesArray = Array.isArray(importData.messages) ? importData.messages : [];
        const scheduledArray = Array.isArray(importData.scheduledMessages) ? importData.scheduledMessages : [];
        const trustedArray = Array.isArray(importData.trustedRecords) ? importData.trustedRecords : [];

        console.log(`🔄 Starting import of ${usersArray.length} users, ${messagesArray.length} messages, ${scheduledArray.length} scheduled messages...`);

        for (const user of usersArray) {
            try {
                if (!user.userId || !user.address) {
                    results.users.failed++;
                    results.users.errors.push(`Missing userId or address for user: ${JSON.stringify(user)}`);
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
                results.users.success++;
                console.log(`✅ Imported user ${user.userId} (${user.username || 'unknown'})`);
            } catch (error) {
                results.users.failed++;
                results.users.errors.push(`Failed to import user ${user.userId}: ${error.message}`);
                console.error(`❌ Failed to import user ${user.userId}:`, error);
            }
        }

        for (const message of messagesArray) {
            try {
                const commandName = (message.commandName || message.key || '').toLowerCase().trim();
                if (!commandName) {
                    results.messages.failed++;
                    results.messages.errors.push('Missing commandName for message template');
                    continue;
                }

                const photoBuffer = message.photo?.buffer ? Buffer.from(message.photo.buffer, 'base64') : null;
                const photoMetadata = message.photo?.metadata || null;
                const content = message.messageContent || '';
                const savedBy = message.savedBy || 'imported';

                const saved = await saveMessage(commandName, content, savedBy, photoBuffer, photoMetadata);
                if (saved) {
                    results.messages.success++;
                } else {
                    results.messages.failed++;
                    results.messages.errors.push(`Failed to save message template: ${commandName}`);
                }
            } catch (error) {
                results.messages.failed++;
                results.messages.errors.push(`Failed to import message template: ${error.message}`);
                console.error('❌ Failed to import message template:', error);
            }
        }

        for (const item of scheduledArray) {
            try {
                const commandName = (item.commandName || item.key?.replace(/^scheduled:/, '') || '').toLowerCase().trim();
                if (!commandName || !item.chatId || !item.intervalMs) {
                    results.scheduledMessages.failed++;
                    results.scheduledMessages.errors.push(`Missing required fields for scheduled message: ${JSON.stringify(item)}`);
                    continue;
                }

                const photoBuffer = item.photo?.buffer ? Buffer.from(item.photo.buffer, 'base64') : null;
                const photoMetadata = item.photo?.metadata || null;
                const content = item.messageContent || '';
                const savedBy = item.savedBy || 'imported';

                const saved = await saveScheduledMessage(
                    commandName,
                    content,
                    item.chatId,
                    item.intervalMs,
                    savedBy,
                    photoBuffer,
                    photoMetadata
                );

                if (saved) {
                    results.scheduledMessages.success++;
                } else {
                    results.scheduledMessages.failed++;
                    results.scheduledMessages.errors.push(`Failed to save scheduled message: ${commandName}`);
                }
            } catch (error) {
                results.scheduledMessages.failed++;
                results.scheduledMessages.errors.push(`Failed to import scheduled message: ${error.message}`);
                console.error('❌ Failed to import scheduled message:', error);
            }
        }

        const trustedResults = await importTrustedRecords(trustedArray);
        results.trustedRecords = trustedResults;

        console.log(
            `✅ Import completed: users ${results.users.success}/${results.users.failed} (success/failed), ` +
            `messages ${results.messages.success}/${results.messages.failed}, ` +
            `scheduled ${results.scheduledMessages.success}/${results.scheduledMessages.failed}, ` +
            `trusted ${results.trustedRecords.success}/${results.trustedRecords.failed}`
        );
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


