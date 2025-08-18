const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_TOKEN } = require('../../config/config.js');
const { registerRoutes } = require('./router.js');

function createBotApp() {
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    registerRoutes(bot);
    console.log("Bot is running...");
    return bot;
}

module.exports = {
    createBotApp,
};


