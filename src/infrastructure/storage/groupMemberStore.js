/**
 * Track known group members to detect first-time message senders
 */

// Map: chatId -> Set of user IDs
const knownMembers = new Map();

/**
 * Check if a user is a known member of a group
 * @param {number|string} chatId
 * @param {number|string} userId
 * @returns {boolean}
 */
function isKnownMember(chatId, userId) {
    const members = knownMembers.get(String(chatId));
    if (!members) {
        return false;
    }
    return members.has(String(userId));
}

/**
 * Add a user as a known member of a group
 * @param {number|string} chatId
 * @param {number|string} userId
 */
function addKnownMember(chatId, userId) {
    const chatIdStr = String(chatId);
    const userIdStr = String(userId);
    
    if (!knownMembers.has(chatIdStr)) {
        knownMembers.set(chatIdStr, new Set());
    }
    
    knownMembers.get(chatIdStr).add(userIdStr);
}

/**
 * Check if this is a user's first message in the group
 * If yes, mark them as known and return true
 * @param {number|string} chatId
 * @param {number|string} userId
 * @returns {boolean} true if this is their first message
 */
function checkAndMarkFirstMessage(chatId, userId) {
    const isFirstMessage = !isKnownMember(chatId, userId);
    if (isFirstMessage) {
        addKnownMember(chatId, userId);
    }
    return isFirstMessage;
}

module.exports = {
    isKnownMember,
    addKnownMember,
    checkAndMarkFirstMessage
};


