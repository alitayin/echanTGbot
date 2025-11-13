const { Level } = require('level');
const path = require('path');

// Initialize levelDB for stored messages
const dbPath = path.join(__dirname, '../../../data/storedMessages');
const db = new Level(dbPath, { valueEncoding: 'json' });

/**
 * Save a message with a command name
 * @param {string} commandName - Command name to identify the message
 * @param {string} messageContent - Full message content to store
 * @param {string} savedBy - Username who saved the message
 * @returns {Promise<boolean>}
 */
async function saveMessage(commandName, messageContent, savedBy) {
    try {
        const normalizedCommandName = commandName.toLowerCase().trim();
        const key = `message:${normalizedCommandName}`;
        const data = {
            commandName: normalizedCommandName,
            messageContent,
            savedBy,
            savedAt: new Date().toISOString()
        };
        await db.put(key, data);
        console.log(`✅ Message saved with command: "${normalizedCommandName}" by ${savedBy}`);
        return true;
    } catch (error) {
        console.error('Failed to save message:', error);
        return false;
    }
}

/**
 * Delete a stored message by command name
 * @param {string} commandName - Command name to delete
 * @returns {Promise<boolean>}
 */
async function deleteMessage(commandName) {
    try {
        const normalizedCommandName = commandName.toLowerCase().trim();
        const key = `message:${normalizedCommandName}`;
        // Check if exists first
        await db.get(key);
        await db.del(key);
        console.log(`✅ Message deleted: "${normalizedCommandName}"`);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            console.log(`❌ Message not found: "${commandName}"`);
            return false;
        }
        console.error('Failed to delete message:', error);
        return false;
    }
}

/**
 * Get a specific message by command name
 * @param {string} commandName - Command name to retrieve
 * @returns {Promise<Object|null>}
 */
async function getMessage(commandName) {
    try {
        const normalizedCommandName = commandName.toLowerCase().trim();
        const key = `message:${normalizedCommandName}`;
        const data = await db.get(key);
        return data;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return null;
        }
        console.error('Failed to get message:', error);
        return null;
    }
}

/**
 * Get all stored messages
 * @returns {Promise<Array>}
 */
async function getAllMessages() {
    try {
        const messages = [];
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('message:')) {
                messages.push(value);
            }
        }
        // Sort by savedAt (newest first)
        messages.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        return messages;
    } catch (error) {
        console.error('Failed to get all messages:', error);
        return [];
    }
}

/**
 * Check if a command name already exists
 * @param {string} commandName - Command name to check
 * @returns {Promise<boolean>}
 */
async function messageExists(commandName) {
    try {
        const normalizedCommandName = commandName.toLowerCase().trim();
        const key = `message:${normalizedCommandName}`;
        await db.get(key);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        console.error('Failed to check message existence:', error);
        return false;
    }
}

async function saveScheduledMessage(commandName, messageContent, chatId, intervalMs, savedBy) {
    try {
        const normalizedCommandName = commandName.toLowerCase().trim();
        const key = `scheduled:${normalizedCommandName}`;
        const nextSendTime = Date.now() + intervalMs;
        const data = {
            commandName: normalizedCommandName,
            messageContent,
            chatId,
            intervalMs,
            nextSendTime,
            savedBy,
            createdAt: new Date().toISOString()
        };
        await db.put(key, data);
        console.log(`✅ Scheduled message saved: "${normalizedCommandName}" (repeats every ${intervalMs / 1000}s)`);
        return true;
    } catch (error) {
        console.error('Failed to save scheduled message:', error);
        return false;
    }
}

async function getDueScheduledMessages() {
    try {
        const now = Date.now();
        const dueMessages = [];
        
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('scheduled:') && value.nextSendTime <= now) {
                dueMessages.push({ key, ...value });
            }
        }
        
        return dueMessages;
    } catch (error) {
        console.error('Failed to get due scheduled messages:', error);
        return [];
    }
}

async function updateScheduledMessageNextTime(key, intervalMs) {
    try {
        const data = await db.get(key);
        data.nextSendTime = Date.now() + intervalMs;
        await db.put(key, data);
        return true;
    } catch (error) {
        console.error('Failed to update scheduled message:', error);
        return false;
    }
}

async function deleteScheduledMessage(key) {
    try {
        await db.del(key);
        console.log(`✅ Scheduled message deleted: "${key}"`);
        return true;
    } catch (error) {
        console.error('Failed to delete scheduled message:', error);
        return false;
    }
}

async function getAllScheduledMessages() {
    try {
        const messages = [];
        for await (const [key, value] of db.iterator()) {
            if (key.startsWith('scheduled:')) {
                messages.push({ key, ...value });
            }
        }
        messages.sort((a, b) => a.scheduledTime - b.scheduledTime);
        return messages;
    } catch (error) {
        console.error('Failed to get all scheduled messages:', error);
        return [];
    }
}

/**
 * Close database connection
 */
async function closeDB() {
    try {
        await db.close();
        console.log('✅ Stored message database closed');
    } catch (error) {
        console.error('Failed to close stored message database:', error);
    }
}

async function deleteScheduledMessageByName(commandName) {
    try {
        const normalizedCommandName = commandName.toLowerCase().trim();
        const key = `scheduled:${normalizedCommandName}`;
        await db.del(key);
        console.log(`✅ Scheduled message deleted: "${normalizedCommandName}"`);
        return true;
    } catch (error) {
        if (error.code === 'LEVEL_NOT_FOUND') {
            return false;
        }
        console.error('Failed to delete scheduled message:', error);
        return false;
    }
}

module.exports = {
    saveMessage,
    deleteMessage,
    getMessage,
    getAllMessages,
    messageExists,
    saveScheduledMessage,
    getDueScheduledMessages,
    updateScheduledMessageNextTime,
    deleteScheduledMessage,
    deleteScheduledMessageByName,
    getAllScheduledMessages,
    closeDB
};

