const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_TOKEN } = require('../../config/config.js');
const { registerRoutes } = require('./router.js');
const { MessageScheduler } = require('../application/services/messageScheduler.js');

function createBotApp() {
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    registerRoutes(bot);
    
    // Start message scheduler
    const scheduler = new MessageScheduler(bot);
    scheduler.start();
    
    console.log("Bot is running...");
    return bot;
}

module.exports = {
    createBotApp,
};


