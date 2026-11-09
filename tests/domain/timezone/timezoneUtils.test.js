import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
    formatTimeForTimezone,
    formatTimeForUTCOffset,
    findCountry,
    parseUTCOffset,
} from '../../../src/domain/timezone/timezoneUtils.js';

describe('parseUTCOffset', () => {
    it('parses valid offsets and ignores surrounding whitespace', () => {
        expect(parseUTCOffset('UTC+8')).toBe(8);
        expect(parseUTCOffset(' utc-3.5 ')).toBe(-3.5);
    });

    it('returns null for invalid values', () => {
        expect(parseUTCOffset(null)).toBeNull();
        expect(parseUTCOffset(8)).toBeNull();
        expect(parseUTCOffset('UTC+15')).toBeNull();
        expect(parseUTCOffset('UTC+8hours')).toBeNull();
    });

    it('accepts hours and minutes without treating minutes as decimal hours', () => {
        expect(parseUTCOffset('UTC+05:30')).toBe(5.5);
        expect(parseUTCOffset('utc+5:45')).toBe(5.75);
        expect(parseUTCOffset('UTC-03:30')).toBe(-3.5);
        expect(parseUTCOffset('UTC+05:60')).toBeNull();
        expect(parseUTCOffset('UTC+14:01')).toBeNull();
        expect(parseUTCOffset('UTC-12:01')).toBeNull();
    });
});

describe('findCountry', () => {
    it('returns null for empty or non-string queries', () => {
        expect(findCountry('')).toBeNull();
        expect(findCountry(null)).toBeNull();
        expect(findCountry({})).toBeNull();
    });

    it('matches multi-word country names exactly', () => {
        expect(findCountry('South Africa').name).toBe('South Africa');
    });

    it('resolves cities to their actual timezone instead of a country default', () => {
        expect(findCountry('Los Angeles').tz).toBe('America/Los_Angeles');
        expect(findCountry('Vancouver').tz).toBe('America/Vancouver');
        expect(findCountry('Perth').tz).toBe('Australia/Perth');
        expect(findCountry('USA').tz).toBe('America/New_York');
    });

    it('skips fuzzy matching for inputs too long to match any known location', () => {
        expect(findCountry('x'.repeat(10000))).toBeNull();
        expect(findCountry('New Yrok').name).toBe('USA');
    });
});

describe('time formatting', () => {
    it('renders midnight with 00 instead of 24', () => {
        const midnight = new Date('2026-01-01T00:00:00.000Z');

        expect(formatTimeForTimezone(midnight, 'UTC')).toContain('00:00');
        expect(formatTimeForUTCOffset(midnight, 0)).toContain('00:00');
    });

    it('returns null for invalid dates and out-of-range UTC offsets', () => {
        expect(formatTimeForUTCOffset(new Date(NaN), 0)).toBeNull();
        expect(formatTimeForUTCOffset(new Date(), Infinity)).toBeNull();
        expect(formatTimeForUTCOffset(new Date(), 15)).toBeNull();
        expect(formatTimeForUTCOffset(new Date(8640000000000000), 14)).toBeNull();
    });

    it('keeps fixed offsets independent of server timezone across DST changes', () => {
        const moduleUrl = new URL('../../../src/domain/timezone/timezoneUtils.js', import.meta.url);
        const script = `const { formatTimeForUTCOffset } = require(${JSON.stringify(moduleUrl.pathname)});
            console.log(formatTimeForUTCOffset(new Date('2026-03-08T06:30:00Z'), 8));`;
        const results = ['UTC', 'Asia/Shanghai', 'America/New_York'].map(TZ =>
            execFileSync(process.execPath, ['-e', script], {
                encoding: 'utf8', env: { ...process.env, TZ },
            }).trim()
        );

        expect(new Set(results).size).toBe(1);
        expect(results[0]).toContain('14:30');
    });
});
