const groupMessages = new Map();
const MAX_MESSAGES_PER_GROUP = 100;

/**
 * Add a message to group history.
 * @param {number} chatId
 * @param {Object} msg
 * @param {string} botUsername
 */
function addMessageToGroup(chatId, msg, botUsername = null) {
    if (!groupMessages.has(chatId)) {
        groupMessages.set(chatId, []);
    }
    
    const messages = groupMessages.get(chatId);
    const messageData = {
        messageId: msg.message_id || Date.now(),
        text: msg.text || msg.caption || '',
        from: msg.from ? (msg.from.username || '') : (botUsername || ''),
        date: msg.date || Math.floor(Date.now() / 1000),
        type: msg.photo ? 'photo' : 'text',
        isBot: msg.from ? msg.from.is_bot : true
    };
    
    messages.unshift(messageData);
    
    if (messages.length > MAX_MESSAGES_PER_GROUP) {
        messages.pop();
    }
}

/**
 * Add bot message to group history.
 * @param {number} chatId
 * @param {string} text
 * @param {string} botUsername
 */
function addBotMessageToGroup(chatId, text, botUsername) {
    if (groupMessages.has(chatId)) {
        const messages = groupMessages.get(chatId);
        const messageData = {
            messageId: Date.now(),
            text: text,
            from: botUsername,
            date: Math.floor(Date.now() / 1000),
            type: 'text',
            isBot: true
        };
        messages.unshift(messageData);
        
        if (messages.length > MAX_MESSAGES_PER_GROUP) {
            messages.pop();
        }
    }
}

/**
 * Get group message history.
 * @param {number} chatId
 * @returns {Array}
 */
function getGroupMessages(chatId) {
    return groupMessages.get(chatId) || [];
}

/**
 * Get formatted context before a message.
 * @param {number} chatId
 * @param {number} currentMessageId
 * @param {string} botUsername
 * @param {number} contextLimit
 * @returns {string|null}
 */
function getFormattedContext(chatId, currentMessageId, botUsername, contextLimit = 8) {
    const messages = groupMessages.get(chatId) || [];
    const currentMsgIndex = messages.findIndex(m => m.messageId === currentMessageId);
    
    console.log('\n=== 消息上下文调试 ===');
    console.log('当前消息索引:', currentMsgIndex);
    console.log('消息历史长度:', messages.length);
    
    if (currentMsgIndex === -1) {
        return null;
    }
    
    // Messages before current
    const previousMessages = messages
        .slice(currentMsgIndex + 1)  
        .slice(0, contextLimit)
        .map(m => {
            const displayName = m.from === botUsername ? 'eChan' : m.from;
            const suffix = m.from === botUsername ? '(you)' : (m.isBot ? '(Bot)' : '');
            const time = new Date(m.date * 1000).toLocaleTimeString();
            
            // Truncate to 50 words
            const words = m.text.split(/\s+/);
            let truncatedText = m.text;
            if (words.length > 50) {
                truncatedText = words.slice(0, 50).join(' ') + '...(omitted)...';
            }
            
            return `[${time}][${displayName}${suffix}]: ${truncatedText}`;
        })
        .join('\n');
    
    return previousMessages || null;
}

/**
 * Check if message is in a group.
 * @param {Object} msg
 * @returns {boolean}
 */
function isGroupMessage(msg) {
    return msg.chat.type === 'group' || msg.chat.type === 'supergroup';
}

module.exports = {
    addMessageToGroup,
    addBotMessageToGroup,
    getGroupMessages,
    getFormattedContext,
    isGroupMessage
}; 
