import { describe, it, expect } from 'vitest';
import {
    escapeRegex,
    matchesAnyKeywordWordBoundary,
    simpleStem,
    stripEmoji,
    getUserDisplayName,
    extractUsername,
    getTextContent,
    truncate,
} from '../../../src/domain/utils/text.js';

describe('escapeRegex', () => {
    it('escapes regex special characters', () => {
        expect(escapeRegex('.')).toBe('\\.');
        expect(escapeRegex('*')).toBe('\\*');
        expect(escapeRegex('(hello)')).toBe('\\(hello\\)');
    });
    it('leaves plain text unchanged', () => {
        expect(escapeRegex('hello123')).toBe('hello123');
    });
});

describe('matchesAnyKeywordWordBoundary', () => {
    it('matches a whole word (case-insensitive)', () => {
        expect(matchesAnyKeywordWordBoundary('Buy XEC today', ['xec'])).toBe(true);
    });
    it('does not match partial word', () => {
        expect(matchesAnyKeywordWordBoundary('xectra', ['xec'])).toBe(false);
    });
    it('returns false for empty keywords', () => {
        expect(matchesAnyKeywordWordBoundary('hello', [])).toBe(false);
    });
    it('handles null/undefined text', () => {
        expect(matchesAnyKeywordWordBoundary(null, ['xec'])).toBe(false);
    });
});

describe('simpleStem', () => {
    it('strips -ing suffix', () => {
        expect(simpleStem('running')).toBe('runn');
    });
    it('strips -ed suffix', () => {
        expect(simpleStem('walked')).toBe('walk');
    });
    it('strips -es suffix', () => {
        expect(simpleStem('boxes')).toBe('box');
    });
    it('strips -s suffix', () => {
        expect(simpleStem('cats')).toBe('cat');
    });
    it('returns word unchanged if <= 3 chars', () => {
        expect(simpleStem('is')).toBe('is');
        expect(simpleStem('the')).toBe('the');
    });
    it('strips -es from goes correctly', () => {
        // 'goes' length=4 > 3, ends with 'es' → 'go'
        expect(simpleStem('goes')).toBe('go');
    });
});

describe('stripEmoji', () => {
    it('removes emoji from text', () => {
        expect(stripEmoji('hello 😀 world')).toBe('hello  world');
    });
    it('leaves plain text unchanged', () => {
        expect(stripEmoji('hello world')).toBe('hello world');
    });
    it('handles empty string', () => {
        expect(stripEmoji('')).toBe('');
    });
    it('handles undefined (default param)', () => {
        expect(stripEmoji()).toBe('');
    });
});

describe('getUserDisplayName', () => {
    it('returns full name when both first and last name present', () => {
        expect(getUserDisplayName({ first_name: 'Alice', last_name: 'Smith' })).toBe('Alice Smith');
    });
    it('returns first name only when no last name', () => {
        expect(getUserDisplayName({ first_name: 'Alice', last_name: '' })).toBe('Alice');
    });
    it('falls back to username when no name', () => {
        expect(getUserDisplayName({ first_name: '', last_name: '', username: 'alice123' })).toBe('alice123');
    });
    it('returns empty string when all fields missing', () => {
        expect(getUserDisplayName({ first_name: '', last_name: '', username: '' })).toBe('');
    });
});

describe('extractUsername', () => {
    it('extracts username with @ prefix', () => {
        expect(extractUsername('@alice')).toBe('alice');
    });
    it('extracts username without @ prefix', () => {
        expect(extractUsername('alice')).toBe('alice');
    });
    it('returns null for empty string', () => {
        expect(extractUsername('')).toBeNull();
    });
});

describe('getTextContent', () => {
    it('returns text when present', () => {
        expect(getTextContent({ text: 'hello' })).toBe('hello');
    });
    it('falls back to caption when no text', () => {
        expect(getTextContent({ caption: 'a photo' })).toBe('a photo');
    });
    it('returns empty string when no text or caption', () => {
        expect(getTextContent({})).toBe('');
    });
    it('prepends quoted text when both present', () => {
        const msg = { text: 'main', quote: { text: 'quoted' } };
        expect(getTextContent(msg)).toBe('[Quoted]: quoted\n\nmain');
    });
    it('returns only quote when no main content', () => {
        const msg = { quote: { text: 'quoted' } };
        expect(getTextContent(msg)).toBe('[Quoted]: quoted');
    });
});

describe('truncate', () => {
    it('includes the suffix within the maximum length', () => {
        expect(truncate('abcdefgh', 5)).toBe('ab...');
        expect(truncate('abc', 5)).toBe('abc');
    });

    it('does not split a surrogate pair and respects short limits', () => {
        expect(truncate('abc😀z', 5, '.')).toBe('abc.');
        expect(truncate('abcdef', 2, '...')).toBe('..');
    });
});
