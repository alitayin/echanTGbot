require('dotenv').config();
require('../utils/logger');
const { createBotApp } = require('./botApp.js');
const { closeAllLevelStores } = require('../infrastructure/storage/levelStoreRegistry.js');

let bot;
let shuttingDown = false;

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down.`);
    let exitCode = 0;
    try {
        await bot?.stopPolling?.();
    } catch (error) {
        exitCode = 1;
        console.error('Failed to stop Telegram polling:', error);
    }
    try {
        await closeAllLevelStores();
    } catch (error) {
        exitCode = 1;
        console.error('Failed to close LevelDB stores:', error);
    }
    process.exit(exitCode);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

createBotApp().then((createdBot) => {
    bot = createdBot;
}).catch((err) => {
    console.error('Failed to start bot:', err);
    process.exit(1);
});
