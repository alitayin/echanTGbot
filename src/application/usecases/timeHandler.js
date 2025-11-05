const { calculateStringSimilarity } = require('../../domain/utils/similarity.js');
const { COUNTRIES, CITY_TO_COUNTRY } = require('../../domain/timezone/timezoneData.js');

function formatTimeForTimezone(date, timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        
        return formatter.format(date);
    } catch (error) {
        return null;
    }
}

function parseUTCOffset(input) {
    const match = input.match(/^utc([+-]?\d+(?:\.\d+)?)$/i);
    if (match) {
        const offset = parseFloat(match[1]);
        if (offset >= -12 && offset <= 14) {
            return offset;
        }
    }
    return null;
}

function formatTimeForUTCOffset(date, offset) {
    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const targetTime = new Date(utcTime + offset * 3600000);
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC'
    });
    
    const formatted = formatter.format(targetTime);
    return `${formatted} (UTC${offset >= 0 ? '+' : ''}${offset})`;
}

function findCountry(input) {
    const normalized = input.toLowerCase().trim().replace(/[\s-]/g, '');
    
    if (CITY_TO_COUNTRY[normalized]) {
        const countryName = CITY_TO_COUNTRY[normalized];
        const country = COUNTRIES.find(c => c.name === countryName);
        if (country) {
            console.log(`[Time] City exact match: "${input}" -> ${country.name}`);
            return country;
        }
    }
    
    let bestMatch = COUNTRIES.find(country => 
        country.name.toLowerCase() === normalized
    );
    
    if (bestMatch) {
        console.log(`[Time] Country exact match: "${input}" -> ${bestMatch.name}`);
        return bestMatch;
    }
    
    let maxSimilarity = 0;
    let fuzzyMatch = null;
    let matchType = null;
    
    console.log(`[Time] Fuzzy matching for: "${input}"`);
    
    for (const [cityName, countryName] of Object.entries(CITY_TO_COUNTRY)) {
        const similarity = calculateStringSimilarity(normalized, cityName);
        console.log(`  - ${cityName} (${countryName}): ${similarity.toFixed(2)}% similarity`);
        
        if (similarity > maxSimilarity && similarity >= 60) {
            maxSimilarity = similarity;
            const country = COUNTRIES.find(c => c.name === countryName);
            if (country) {
                fuzzyMatch = country;
                matchType = 'city';
            }
        }
    }
    
    for (const country of COUNTRIES) {
        const similarity = calculateStringSimilarity(normalized, country.name.toLowerCase());
        console.log(`  - ${country.name}: ${similarity.toFixed(2)}% similarity`);
        
        if (similarity > maxSimilarity && similarity >= 60) {
            maxSimilarity = similarity;
            fuzzyMatch = country;
            matchType = 'country';
        }
    }
    
    if (fuzzyMatch) {
        console.log(`[Time] Best match (${matchType}): "${input}" -> ${fuzzyMatch.name} (${maxSimilarity.toFixed(2)}%)`);
    } else {
        console.log(`[Time] No match found for: "${input}"`);
    }
    
    return fuzzyMatch;
}

async function handleTimeCommand(inputs = []) {
    try {
        const now = new Date();
        const results = [];
        
        if (inputs.length > 0) {
            for (const input of inputs) {
                const utcOffset = parseUTCOffset(input);
                if (utcOffset !== null) {
                    const formatted = formatTimeForUTCOffset(now, utcOffset);
                    results.push({
                        name: `UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`,
                        time: formatted
                    });
                    console.log(`[Time] UTC offset: "${input}" -> UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`);
                } else {
                    const country = findCountry(input);
                    if (country && !results.find(c => c.name === country.name)) {
                        const formatted = formatTimeForTimezone(now, country.tz);
                        if (formatted) {
                            results.push({
                                name: country.name,
                                time: formatted
                            });
                        }
                    }
                }
            }
        }
        
        const standardTimes = {
            utc: now.toUTCString(),
            iso: now.toISOString(),
            timestamp: Math.floor(now.getTime() / 1000)
        };
        
        return { 
            times: results,
            standard: standardTimes
        };
    } catch (error) {
        console.error('Failed to handle time command:', error);
        throw error;
    }
}

module.exports = {
    handleTimeCommand
};
