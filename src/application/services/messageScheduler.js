const {
    getDueScheduledMessages,
    updateScheduledMessageNextTime,
    deleteScheduledMessage
} = require('../../infrastructure/storage/storedMessageStore.js');

class MessageScheduler {
    constructor(bot) {
        this.bot = bot;
        this.intervalId = null;
        this.checkInterval = 30 * 1000; // Check every 30 seconds
    }

    start() {
        if (this.intervalId) {
            console.log('⚠️ Message scheduler is already running');
            return;
        }

        console.log('✅ Message scheduler started');
        this.intervalId = setInterval(() => this.checkAndSendMessages(), this.checkInterval);
        
        // Also run immediately on start
        this.checkAndSendMessages();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('✅ Message scheduler stopped');
        }
    }

    async checkAndSendMessages() {
        try {
            const dueMessages = await getDueScheduledMessages();
            
            if (dueMessages.length === 0) {
                return;
            }

            console.log(`📬 Found ${dueMessages.length} scheduled message(s) to send`);

            for (const msgData of dueMessages) {
                try {
                    await this.bot.sendMessage(msgData.chatId, msgData.messageContent);
                    console.log(`✅ Sent scheduled message: "${msgData.commandName}" to chat ${msgData.chatId}`);
                    
                    // Update next send time (repeat the message)
                    await updateScheduledMessageNextTime(msgData.key, msgData.intervalMs);
                    console.log(`🔄 Next send in ${msgData.intervalMs / 1000}s`);
                } catch (error) {
                    console.error(`Failed to send scheduled message "${msgData.commandName}":`, error.message);
                    
                    // If the message is too old (more than 7 days overdue), delete it
                    if (Date.now() - msgData.nextSendTime > 7 * 24 * 60 * 60 * 1000) {
                        console.log(`🗑️ Deleting overdue scheduled message: "${msgData.commandName}"`);
                        await deleteScheduledMessage(msgData.key);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to check and send scheduled messages:', error);
        }
    }
}

module.exports = { MessageScheduler };

