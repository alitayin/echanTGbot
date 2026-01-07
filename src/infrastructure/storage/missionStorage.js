const { Level } = require('level');
const path = require('path');

// Initialize levelDB for missions
const dbPath = path.join(__dirname, '../../../data/missions');
const db = new Level(dbPath, { valueEncoding: 'json' });

/**
 * Generate a random mission ID (6 characters)
 * @returns {string} - Random mission ID
 */
function generateMissionId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

/**
 * Create a new mission
 * @param {string} description - Mission description
 * @param {number} chatId - Group chat ID where mission was created
 * @param {number} messageId - Message ID of the mission message
 * @param {string} creatorUsername - Username of creator
 * @returns {Promise<object>} - Mission object with ID
 */
async function createMission(description, chatId, messageId, creatorUsername) {
    try {
        let missionId = generateMissionId();
        
        // Ensure unique ID
        while (await missionExists(missionId)) {
            missionId = generateMissionId();
        }
        
        const mission = {
            id: missionId,
            description,
            chatId: String(chatId),
            // Track all related message IDs to allow replies to multiple messages
            messageId: Number(messageId), // legacy single ID
            messageIds: [Number(messageId)],
            commandMessageId: Number(messageId),
            creatorUsername,
            reward: 1, // 1 OORAH
            createdAt: new Date().toISOString(),
            active: true
        };
        
        const key = `mission:${missionId}`;
        await db.put(key, mission);
        
        console.log(`✅ Mission created: ${missionId} by @${creatorUsername}`);
        return mission;
    } catch (error) {
        console.error('Failed to create mission:', error);
        throw error;
    }
}

/**
 * Update stored message ID for a mission (used to bind to the bot's message)
 * @param {string} missionId - Mission ID
 * @param {number} messageId - Telegram message ID to store
 * @returns {Promise<boolean>}
 */
async function updateMissionMessageId(missionId, messageId) {
    try {
        const key = `mission:${missionId}`;
        const mission = await db.get(key);
        const msgId = Number(messageId);
        mission.messageId = msgId; // keep legacy field updated
        mission.messageIds = Array.isArray(mission.messageIds) ? mission.messageIds : [];
        if (!mission.messageIds.includes(msgId)) {
            mission.messageIds.push(msgId);
        }
        mission.botMessageId = msgId;
        await db.put(key, mission);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        console.error('Failed to update mission message ID:', error);
        return false;
    }
}

/**
 * Check if mission exists
 * @param {string} missionId - Mission ID
 * @returns {Promise<boolean>}
 */
async function missionExists(missionId) {
    try {
        const key = `mission:${missionId}`;
        await db.get(key);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        throw error;
    }
}

/**
 * Get mission by ID
 * @param {string} missionId - Mission ID
 * @returns {Promise<object|null>}
 */
async function getMission(missionId) {
    try {
        const key = `mission:${missionId}`;
        const mission = await db.get(key);
        return mission;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return null;
        }
        console.error('Failed to get mission:', error);
        throw error;
    }
}

/**
 * Get mission by message ID
 * @param {number} chatId - Chat ID
 * @param {number} messageId - Message ID
 * @returns {Promise<object|null>}
 */
async function getMissionByMessageId(chatId, messageId) {
    try {
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('mission:') && value.chatId === String(chatId)) {
                const targetId = Number(messageId);
                const hasArrayMatch = Array.isArray(value.messageIds) && value.messageIds.includes(targetId);
                const hasLegacyMatch = value.messageId === targetId;
                if (hasArrayMatch || hasLegacyMatch) {
                    return value;
                }
            }
        }
        return null;
    } catch (error) {
        console.error('Failed to get mission by message ID:', error);
        return null;
    }
}

/**
 * Get all missions
 * @returns {Promise<Array>}
 */
async function getAllMissions() {
    try {
        const missions = [];
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('mission:')) {
                missions.push(value);
            }
        }
        return missions;
    } catch (error) {
        console.error('Failed to get all missions:', error);
        return [];
    }
}

/**
 * Check if user has completed a mission
 * @param {string} missionId - Mission ID
 * @param {number} userId - User ID
 * @returns {Promise<boolean>}
 */
async function hasUserCompletedMission(missionId, userId) {
    try {
        const key = `completion:${missionId}:${userId}`;
        await db.get(key);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        throw error;
    }
}

/**
 * Record mission completion
 * @param {string} missionId - Mission ID
 * @param {number} userId - User ID
 * @param {string} username - Username
 * @returns {Promise<boolean>}
 */
async function recordMissionCompletion(missionId, userId, username) {
    try {
        const completionKey = `completion:${missionId}:${userId}`;
        const completion = {
            missionId,
            userId: String(userId),
            username,
            completedAt: new Date().toISOString()
        };
        await db.put(completionKey, completion);
        
        // Update user stats
        await incrementUserCompletionCount(userId, missionId);
        
        console.log(`✅ Mission ${missionId} completed by @${username} (${userId})`);
        return true;
    } catch (error) {
        console.error('Failed to record mission completion:', error);
        return false;
    }
}

/**
 * Increment user's mission completion count
 * @param {number} userId - User ID
 * @param {string} missionId - Mission ID
 * @returns {Promise<void>}
 */
async function incrementUserCompletionCount(userId, missionId) {
    try {
        const key = `userstats:${userId}`;
        let stats;
        
        try {
            stats = await db.get(key);
        } catch (error) {
            if (error.code === 'LEVEL_NOT_FOUND') {
                stats = {
                    userId: String(userId),
                    totalCompleted: 0,
                    completedMissions: []
                };
            } else {
                throw error;
            }
        }
        
        stats.totalCompleted += 1;
        stats.completedMissions.push({
            missionId,
            completedAt: new Date().toISOString()
        });
        
        await db.put(key, stats);
    } catch (error) {
        console.error('Failed to update user stats:', error);
    }
}

/**
 * Get user completion stats
 * @param {number} userId - User ID
 * @returns {Promise<object|null>}
 */
async function getUserStats(userId) {
    try {
        const key = `userstats:${userId}`;
        const stats = await db.get(key);
        return stats;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return null;
        }
        console.error('Failed to get user stats:', error);
        throw error;
    }
}

/**
 * Get all users' stats
 * @returns {Promise<Array>}
 */
async function getAllUserStats() {
    try {
        const allStats = [];
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('userstats:')) {
                allStats.push(value);
            }
        }
        return allStats;
    } catch (error) {
        console.error('Failed to get all user stats:', error?.message || error);
        return [];
    }
}

/**
 * Decrement user's mission completion count
 * @param {number} userId - User ID
 * @param {number} amount - Amount to decrement
 * @returns {Promise<boolean>}
 */
async function decrementUserCompletionCount(userId, amount) {
    try {
        const key = `userstats:${userId}`;
        const stats = await db.get(key);
        
        if (!stats) {
            return false;
        }
        
        stats.totalCompleted = Math.max(0, stats.totalCompleted - amount);
        await db.put(key, stats);
        
        console.log(`✅ Decremented ${amount} missions for user ${userId}, new total: ${stats.totalCompleted}`);
        return true;
    } catch (error) {
        console.error('Failed to decrement user stats:', error);
        return false;
    }
}

/**
 * Delete mission by ID
 * @param {string} missionId - Mission ID
 * @returns {Promise<boolean>}
 */
async function deleteMission(missionId) {
    try {
        const key = `mission:${missionId}`;
        await db.del(key);
        console.log(`✅ Mission deleted: ${missionId}`);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        console.error('Failed to delete mission:', error);
        throw error;
    }
}

/**
 * Close database connection
 */
async function closeDB() {
    try {
        await db.close();
        console.log('✅ Mission database connection closed');
    } catch (error) {
        console.error('Failed to close mission database:', error);
    }
}

module.exports = {
    createMission,
    getMission,
    getMissionByMessageId,
    getAllMissions,
    hasUserCompletedMission,
    recordMissionCompletion,
    getUserStats,
    getAllUserStats,
    decrementUserCompletionCount,
    deleteMission,
    updateMissionMessageId,
    closeDB
};

