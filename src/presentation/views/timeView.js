const { truncate } = require('../../domain/utils/text.js');

const MAX_TELEGRAM_MESSAGE_LENGTH = 4096;

function renderTimeMessage(timeData) {
    const { times, standard, unrecognizedInputs } = timeData;

    let message = '🌍 World Time\n\n';

    if (standard) {
        message += '⏱ Standard Times:\n';
        message += `  UTC: ${standard.utc}\n`;
        message += `  ISO 8601: ${standard.iso}\n`;
        message += `  Unix: ${standard.timestamp}\n`;
    }

    if (times && times.length > 0) {
        message += '\n🌐 Locations:\n';
        for (const item of times) {
            message += `📍 ${item.name}: ${item.time}\n`;
        }
    }

    if (unrecognizedInputs && unrecognizedInputs.length > 0) {
        message += `\n⚠️ Unrecognized locations: ${unrecognizedInputs.join(', ')}\n`;
    }

    return truncate(message, MAX_TELEGRAM_MESSAGE_LENGTH);
}

module.exports = { renderTimeMessage };

