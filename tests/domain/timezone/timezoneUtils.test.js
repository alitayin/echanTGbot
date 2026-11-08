import { describe, expect, it } from 'vitest';
import {
    formatTimeForTimezone,
    formatTimeForUTCOffset,
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
});

describe('time formatting', () => {
    it('renders midnight with 00 instead of 24', () => {
        const midnight = new Date('2026-01-01T00:00:00.000Z');

        expect(formatTimeForTimezone(midnight, 'UTC')).toContain('00:00');
        expect(formatTimeForUTCOffset(midnight, 0)).toContain('00:00');
    });
});
