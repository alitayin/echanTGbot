const { exportAllData } = require('../../infrastructure/storage/userAddressStore.js');
const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

let exportInProgress = false;

function getNextMondayMidnight(now = new Date()) {
    const next = new Date(now);
    next.setHours(0, 0, 0, 0);

    const day = next.getDay(); // 0 = Sunday, 1 = Monday
    let daysUntil = (8 - day) % 7;
    if (daysUntil === 0) {
        daysUntil = 7;
    }

    next.setDate(next.getDate() + daysUntil);
    return next;
}

async function exportAndSendToLogGroup(bot) {
    if (!NOTIFICATION_GROUP_ID) {
        console.log('ℹ️ NOTIFICATION_GROUP_ID not configured, skipping weekly export');
        return;
    }

    if (exportInProgress) {
        console.log('ℹ️ Weekly export already in progress, skipping');
        return;
    }

    exportInProgress = true;
    try {
        const jsonData = await exportAllData();
        const buffer = Buffer.from(jsonData, 'utf-8');
        const exportDate = new Date();
        const filename = `xecbot-users-export-${exportDate.toISOString().split('T')[0]}.json`;

        await bot.sendDocument(
            NOTIFICATION_GROUP_ID,
            buffer,
            {},
            {
                filename,
                contentType: 'application/json',
            }
        );

        const data = JSON.parse(jsonData);
        await bot.sendMessage(
            NOTIFICATION_GROUP_ID,
            `✅ Weekly export completed!\n\n` +
            `📊 Users: ${data.totalUsers}\n` +
            `💾 Templates: ${data.totalMessages ?? 0}\n` +
            `⏰ Scheduled: ${data.totalScheduledMessages ?? 0}\n` +
            `✅ Trusted: ${data.totalTrustedRecords ?? 0}\n` +
            `📅 Export date: ${new Date(data.exportDate).toLocaleString()}`
        );

        console.log(`✅ Weekly export sent to log group (${NOTIFICATION_GROUP_ID})`);
    } catch (error) {
        console.error('❌ Weekly export failed:', error);
    } finally {
        exportInProgress = false;
    }
}

function startWeeklyExportScheduler(bot) {
    const nextRun = getNextMondayMidnight();
    const delay = nextRun.getTime() - Date.now();

    console.log(`🗓️ Weekly export scheduled for ${nextRun.toISOString()}`);

    setTimeout(() => {
        exportAndSendToLogGroup(bot);
        setInterval(() => {
            exportAndSendToLogGroup(bot);
        }, WEEK_MS);
    }, Math.max(0, delay));
}

module.exports = {
    startWeeklyExportScheduler,
    exportAndSendToLogGroup,
};



