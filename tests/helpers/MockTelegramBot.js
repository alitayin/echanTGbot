/**
 * Mock Telegram Bot for testing
 * Simulates Telegram Bot API without making real API calls
 */
export class MockTelegramBot {
    constructor() {
        this.sentMessages = [];
        this.editedMessages = [];
        this.deletedMessages = [];
        this.answeredCallbacks = [];
        this.chatMembers = new Map();
    }

    async sendMessage(chatId, text, options = {}) {
        const msg = {
            message_id: Date.now() + Math.random(),
            chat: { id: chatId, type: 'private' },
            text,
            ...options
        };
        this.sentMessages.push(msg);
        return msg;
    }

    async editMessageText(text, options = {}) {
        const edit = { text, ...options };
        this.editedMessages.push(edit);
        return true;
    }

    async deleteMessage(chatId, messageId) {
        this.deletedMessages.push({ chatId, messageId });
        return true;
    }

    async answerCallbackQuery(callbackQueryId, options = {}) {
        this.answeredCallbacks.push({ callbackQueryId, ...options });
        return true;
    }

    async getChatMember(chatId, userId) {
        const key = `${chatId}:${userId}`;
        return this.chatMembers.get(key) || { status: 'member' };
    }

    async getMe() {
        return {
            id: 123456789,
            is_bot: true,
            first_name: 'TestBot',
            username: 'test_bot'
        };
    }

    // Test helpers
    getLastSentMessage() {
        return this.sentMessages[this.sentMessages.length - 1];
    }

    getSentMessagesTo(chatId) {
        return this.sentMessages.filter(msg => msg.chat.id === chatId);
    }

    getLastEditedMessage() {
        return this.editedMessages[this.editedMessages.length - 1];
    }

    clearHistory() {
        this.sentMessages = [];
        this.editedMessages = [];
        this.deletedMessages = [];
        this.answeredCallbacks = [];
    }

    setChatMember(chatId, userId, status) {
        const key = `${chatId}:${userId}`;
        this.chatMembers.set(key, { status, user: { id: userId } });
    }

    // Simulate bot events
    on(event, handler) {
        // Store handlers for testing
        if (!this._handlers) this._handlers = {};
        if (!this._handlers[event]) this._handlers[event] = [];
        this._handlers[event].push(handler);
    }

    async simulateMessage(msg) {
        if (this._handlers && this._handlers.message) {
            for (const handler of this._handlers.message) {
                await handler(msg);
            }
        }
    }

    async simulateCallbackQuery(query) {
        if (this._handlers && this._handlers.callback_query) {
            for (const handler of this._handlers.callback_query) {
                await handler(query);
            }
        }
    }
}
