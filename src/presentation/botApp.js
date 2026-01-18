const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_TOKEN } = require('../../config/config.js');
const { registerRoutes } = require('./router.js');
const { MessageScheduler } = require('../application/services/messageScheduler.js');
const { startRewardScheduler } = require('../application/services/missionRewardScheduler.js');
const { startWeeklyExportScheduler } = require('../application/services/dataExportScheduler.js');

function createBotApp() {
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
    registerRoutes(bot);
    
    // Start message scheduler
    const scheduler = new MessageScheduler(bot);
    scheduler.start();
    
    // Start mission reward scheduler
    startRewardScheduler(bot);

    // Start weekly data export scheduler
    startWeeklyExportScheduler(bot);
    
    console.log("Bot is running...");
    return bot;
}

module.exports = {
    createBotApp,
};


