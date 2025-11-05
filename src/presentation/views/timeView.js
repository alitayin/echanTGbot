function renderTimeMessage(timeData) {
    const { times, standard } = timeData;
    
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
    
    return message;
}

module.exports = { renderTimeMessage };

