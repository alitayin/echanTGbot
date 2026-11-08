// Pure time formatting and timezone lookup utilities.
// No I/O, no side effects.

const { calculateStringSimilarity } = require('../utils/similarity.js');
const { COUNTRIES, CITY_TO_COUNTRY } = require('./timezoneData.js');

/** Format a Date for a given IANA timezone string. Returns null if invalid. */
function formatTimeForTimezone(date, timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hourCycle: 'h23',
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

/** Parse a "UTC+X" / "UTC-X" string into a numeric hour offset, or null. */
function parseUTCOffset(input) {
    if (typeof input !== 'string') return null;

    const match = input.trim().match(/^utc([+-]?\d+(?:\.\d+)?)$/i);
    if (match) {
        const offset = parseFloat(match[1]);
        if (offset >= -12 && offset <= 14) {
            return offset;
        }
    }
    return null;
}

/** Format a Date using a numeric UTC hour offset. Returns null for invalid input. */
function formatTimeForUTCOffset(date, offset) {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return null;
    if (!Number.isFinite(offset) || offset < -12 || offset > 14) return null;

    const utcTime = date.getTime() + date.getTimezoneOffset() * 60000;
    const targetTime = new Date(utcTime + offset * 3600000);
    const formatter = new Intl.DateTimeFormat('en-US', {
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
    return formatter.format(targetTime);
}

/**
 * Find a country/timezone entry by city name, country name, or fuzzy match.
 * Returns a { name, tz } object or null.
 */
function findCountry(input) {
    if (typeof input !== 'string' || !input.trim()) return null;

    const normalized = input.toLowerCase().trim().replace(/[\s-]/g, '');

    if (Object.prototype.hasOwnProperty.call(CITY_TO_COUNTRY, normalized)) {
        const countryName = CITY_TO_COUNTRY[normalized];
        const country = COUNTRIES.find(c => c.name === countryName);
        if (country) {
            console.log(`[Time] City match: "${input}" -> ${country.name}`);
            return country;
        }
    }

    const bestMatch = COUNTRIES.find(country =>
        country.name.toLowerCase().replace(/[\s-]/g, '') === normalized
    );

    if (bestMatch) {
        console.log(`[Time] Country match: "${input}" -> ${bestMatch.name}`);
        return bestMatch;
    }

    let maxSimilarity = 0;
    let fuzzyMatch = null;
    let matchType = null;

    for (const [cityName, countryName] of Object.entries(CITY_TO_COUNTRY)) {
        const similarity = calculateStringSimilarity(normalized, cityName);
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
        if (similarity > maxSimilarity && similarity >= 60) {
            maxSimilarity = similarity;
            fuzzyMatch = country;
            matchType = 'country';
        }
    }

    if (fuzzyMatch) {
        console.log(`[Time] Fuzzy match (${matchType}): "${input}" -> ${fuzzyMatch.name}`);
    } else {
        console.log(`[Time] No match: "${input}"`);
    }

    return fuzzyMatch;
}

module.exports = {
    formatTimeForTimezone,
    parseUTCOffset,
    formatTimeForUTCOffset,
    findCountry,
};
