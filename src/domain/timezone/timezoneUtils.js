// Pure time formatting and timezone lookup utilities.
// No I/O, no side effects.

const { calculateStringSimilarity } = require('../utils/similarity.js');
const { COUNTRIES, CITY_TO_COUNTRY, CITY_TIMEZONES } = require('./timezoneData.js');
const MIN_LOCATION_SIMILARITY = 60;
const MAX_FUZZY_LOCATION_LENGTH = Math.max(
    ...Object.keys(CITY_TO_COUNTRY).map(name => name.length),
    ...COUNTRIES.map(country => country.name.length)
);
// The length difference alone makes longer queries unable to reach the threshold.
const MAX_FUZZY_QUERY_LENGTH = Math.floor(MAX_FUZZY_LOCATION_LENGTH * 100 / MIN_LOCATION_SIMILARITY);

function findExactLocation(input) {
    if (typeof input !== 'string' || !input.trim()) return null;
    const normalized = input.toLowerCase().trim().replace(/[\s-]/g, '');
    if (Object.prototype.hasOwnProperty.call(CITY_TIMEZONES, normalized)) {
        return CITY_TIMEZONES[normalized];
    }
    if (Object.prototype.hasOwnProperty.call(CITY_TO_COUNTRY, normalized)) {
        return COUNTRIES.find(country => country.name === CITY_TO_COUNTRY[normalized]) || null;
    }
    return COUNTRIES.find(country => country.name.toLowerCase().replace(/[\s-]/g, '') === normalized) || null;
}

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

/** Parse a decimal or HH:MM UTC offset into hours, or return null. */
function parseUTCOffset(input) {
    if (typeof input !== 'string') return null;

    const clockOffset = input.trim().match(/^utc([+-])(\d{1,2}):(\d{2})$/i);
    if (clockOffset) {
        const minutes = Number(clockOffset[3]);
        if (minutes >= 60) return null;
        const offset = (Number(clockOffset[2]) + minutes / 60) * (clockOffset[1] === '-' ? -1 : 1);
        return offset >= -12 && offset <= 14 ? offset : null;
    }

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

    const targetTime = new Date(date.getTime() + offset * 3600000);
    if (!Number.isFinite(targetTime.getTime())) return null;
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
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
    const logInput = input.length > 80 ? `${input.slice(0, 77)}...` : input;

    const bestMatch = findExactLocation(input);

    if (bestMatch) {
        console.log(`[Time] Country match: "${logInput}" -> ${bestMatch.name}`);
        return bestMatch;
    }

    if (normalized.length > MAX_FUZZY_QUERY_LENGTH) {
        console.log(`[Time] No match: "${logInput}"`);
        return null;
    }

    let maxSimilarity = 0;
    let fuzzyMatch = null;
    let matchType = null;

    for (const cityName of Object.keys(CITY_TO_COUNTRY)) {
        const similarity = calculateStringSimilarity(normalized, cityName);
        if (similarity > maxSimilarity && similarity >= MIN_LOCATION_SIMILARITY) {
            maxSimilarity = similarity;
            const country = findExactLocation(cityName);
            if (country) {
                fuzzyMatch = country;
                matchType = 'city';
            }
        }
    }

    for (const country of COUNTRIES) {
        const similarity = calculateStringSimilarity(normalized, country.name.toLowerCase());
        if (similarity > maxSimilarity && similarity >= MIN_LOCATION_SIMILARITY) {
            maxSimilarity = similarity;
            fuzzyMatch = country;
            matchType = 'country';
        }
    }

    if (fuzzyMatch) {
        console.log(`[Time] Fuzzy match (${matchType}): "${logInput}" -> ${fuzzyMatch.name}`);
    } else {
        console.log(`[Time] No match: "${logInput}"`);
    }

    return fuzzyMatch;
}

module.exports = {
    findExactLocation,
    formatTimeForTimezone,
    parseUTCOffset,
    formatTimeForUTCOffset,
    findCountry,
};
