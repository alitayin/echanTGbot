const TelegramBot = require("node-telegram-bot-api");
const { TELEGRAM_TOKEN } = require('../../config/config.js');
const { registerRoutes } = require('./router.js');
const { MessageScheduler } = require('../application/services/messageScheduler.js');
const { startRewardScheduler } = require('../application/services/missionRewardScheduler.js');
const { startWeeklyExportScheduler } = require('../application/services/dataExportScheduler.js');
const { GithubVersionChecker } = require('../application/services/githubVersionChecker.js');

async function createBotApp() {
    // Start with polling off so we can flush pending updates first
    const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: false });

    // Drop all updates that accumulated while the bot was offline.
    // node-telegram-bot-api does not support drop_pending_updates via deleteWebHook,
    // so we loop over getUpdates until the queue is fully drained.
    try {
        let totalDropped = 0;
        let offset = undefined;
        while (true) {
            const params = { timeout: 0, limit: 100 };
            if (offset !== undefined) params.offset = offset;
            const pending = await bot.getUpdates(params);
            if (pending.length === 0) break;
            totalDropped += pending.length;
            offset = pending[pending.length - 1].update_id + 1;
        }
        // Advance Telegram's server-side offset so the queue is marked as read.
        if (offset !== undefined) {
            await bot.getUpdates({ offset, timeout: 0, limit: 1 });
            console.log(`Dropped ${totalDropped} pending update(s).`);
        } else {
            console.log('No pending updates.');
        }
    } catch (err) {
        console.warn('Failed to drop pending updates:', err.message);
    }

    // Now start polling for new updates only
    bot.startPolling();

    registerRoutes(bot);

    // Start message scheduler
    const scheduler = new MessageScheduler(bot);
    scheduler.start();

    // Start mission reward scheduler
    startRewardScheduler(bot);

    // Start weekly data export scheduler
    startWeeklyExportScheduler(bot);

    // Start GitHub version update checker
    new GithubVersionChecker(bot).start();

    console.log('Bot is running...');
    return bot;
}

module.exports = {
    createBotApp,
};
