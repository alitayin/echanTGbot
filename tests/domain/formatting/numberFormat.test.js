import { describe, expect, it } from 'vitest';
import {
    formatCurrencyValue,
    formatLargeNumber,
    formatPercentage,
    formatPrice,
    formatStake,
} from '../../../src/domain/formatting/numberFormat.js';

describe('number formatting', () => {
    it('uses stable placeholders for non-finite and non-number values', () => {
        expect(formatPrice(Infinity)).toBe('0.0000');
        expect(formatPercentage(NaN)).toBe('0.00%');
        expect(formatLargeNumber(-Infinity)).toBe('$0');
        expect(formatStake(null)).toBe('0');
        expect(formatCurrencyValue('1000')).toBe('$0');
    });

    it('places a negative sign before the currency symbol', () => {
        expect(formatLargeNumber(-12000)).toBe('-$12.0K');
        expect(formatCurrencyValue(-1200)).toBe('-$1.2K');
    });
});
