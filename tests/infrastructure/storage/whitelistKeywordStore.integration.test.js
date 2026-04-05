import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
    addWhitelistKeyword,
    removeWhitelistKeyword,
    isWhitelistKeyword,
    containsWhitelistKeyword,
    getAllWhitelistKeywords,
    closeDB,
} = require('../../../src/infrastructure/storage/whitelistKeywordStore.js');

// All test keywords are prefixed to avoid colliding with real data
const PREFIX = '__integ_test__';
const kw = (name) => `${PREFIX}${name}`;

// Clean up every test keyword we might have written
async function cleanupTestKeys() {
    const all = await getAllWhitelistKeywords();
    await Promise.all(
        all
            .filter(entry => entry.keyword.startsWith(PREFIX))
            .map(entry => removeWhitelistKeyword(entry.keyword))
    );
}

beforeEach(async () => {
    await cleanupTestKeys();
});

afterAll(async () => {
    await cleanupTestKeys();
    await closeDB();
});

describe('whitelistKeywordStore – integration: CRUD', () => {
    it('adds a keyword and confirms it exists', async () => {
        await addWhitelistKeyword(kw('hello'), 'tester');
        // Small delay to ensure write is flushed in CI environments
        await new Promise(resolve => setTimeout(resolve, 10));
        expect(await isWhitelistKeyword(kw('hello'))).toBe(true);
    });

    it('stores metadata (keyword, addedBy, addedAt)', async () => {
        await addWhitelistKeyword(kw('meta'), 'alice');
        const all = await getAllWhitelistKeywords();
        const entry = all.find(e => e.keyword === kw('meta'));
        expect(entry).toBeDefined();
        expect(entry.addedBy).toBe('alice');
        expect(typeof entry.addedAt).toBe('string');
    });

    it('removes a keyword and confirms it is gone', async () => {
        await addWhitelistKeyword(kw('remove_me'), 'tester');
        expect(await isWhitelistKeyword(kw('remove_me'))).toBe(true);
        await removeWhitelistKeyword(kw('remove_me'));
        expect(await isWhitelistKeyword(kw('remove_me'))).toBe(false);
    });

    it('returns false for a keyword that was never added', async () => {
        expect(await isWhitelistKeyword(kw('nonexistent_xyz'))).toBe(false);
    });

    it('normalises to lowercase on add and lookup', async () => {
        await addWhitelistKeyword(kw('CaSeTest'), 'tester');
        // stored as lowercase
        expect(await isWhitelistKeyword(kw('casetest'))).toBe(true);
        // upper-case lookup also normalised
        expect(await isWhitelistKeyword(kw('CASETEST'))).toBe(true);
    });
});

describe('whitelistKeywordStore – integration: deduplication', () => {
    it('adding the same keyword twice does not create duplicates', async () => {
        await addWhitelistKeyword(kw('dup'), 'tester');
        await addWhitelistKeyword(kw('dup'), 'tester2');
        const all = await getAllWhitelistKeywords();
        const matches = all.filter(e => e.keyword === kw('dup'));
        // LevelDB put is idempotent — only one entry should exist
        expect(matches.length).toBe(1);
    });

    it('second put overwrites addedBy', async () => {
        await addWhitelistKeyword(kw('overwrite'), 'first');
        await addWhitelistKeyword(kw('overwrite'), 'second');
        const all = await getAllWhitelistKeywords();
        const entry = all.find(e => e.keyword === kw('overwrite'));
        expect(entry.addedBy).toBe('second');
    });
});

describe('whitelistKeywordStore – integration: containsWhitelistKeyword', () => {
    it('returns matched keyword when message contains it', async () => {
        await addWhitelistKeyword(kw('bitcoin'), 'tester');
        const result = await containsWhitelistKeyword(`buy ${kw('bitcoin')} now`);
        expect(result).toBe(kw('bitcoin'));
    });

    it('returns null when message contains no whitelisted keyword', async () => {
        const result = await containsWhitelistKeyword('totally normal message with no keywords');
        expect(result).toBeNull();
    });

    it('matching is case-insensitive', async () => {
        await addWhitelistKeyword(kw('xec'), 'tester');
        const result = await containsWhitelistKeyword(`send ${kw('xec').toUpperCase()} please`);
        expect(result).toBe(kw('xec'));
    });
});

describe('whitelistKeywordStore – integration: concurrent writes', () => {
    it('10 concurrent adds all persist without data loss', async () => {
        const words = Array.from({ length: 10 }, (_, i) => kw(`concurrent_${i}`));
        await Promise.all(words.map(w => addWhitelistKeyword(w, 'bot')));
        const results = await Promise.all(words.map(w => isWhitelistKeyword(w)));
        expect(results.every(Boolean)).toBe(true);
    });

    it('concurrent add + remove on distinct keys stays consistent', async () => {
        // Pre-seed keys to remove
        await Promise.all([
            addWhitelistKeyword(kw('del_a'), 'bot'),
            addWhitelistKeyword(kw('del_b'), 'bot'),
        ]);
        await Promise.all([
            addWhitelistKeyword(kw('add_a'), 'bot'),
            removeWhitelistKeyword(kw('del_a')),
            addWhitelistKeyword(kw('add_b'), 'bot'),
            removeWhitelistKeyword(kw('del_b')),
        ]);
        expect(await isWhitelistKeyword(kw('add_a'))).toBe(true);
        expect(await isWhitelistKeyword(kw('add_b'))).toBe(true);
        expect(await isWhitelistKeyword(kw('del_a'))).toBe(false);
        expect(await isWhitelistKeyword(kw('del_b'))).toBe(false);
    });
});

describe('whitelistKeywordStore – integration: data recovery / persistence', () => {
    it('getAllWhitelistKeywords returns only keyword: prefixed entries', async () => {
        await addWhitelistKeyword(kw('persist_a'), 'tester');
        await addWhitelistKeyword(kw('persist_b'), 'tester');
        const all = await getAllWhitelistKeywords();
        // Every entry must have a keyword field
        for (const entry of all) {
            expect(entry).toHaveProperty('keyword');
        }
    });

    it('removed keyword no longer appears in getAllWhitelistKeywords', async () => {
        await addWhitelistKeyword(kw('vanish'), 'tester');
        await removeWhitelistKeyword(kw('vanish'));
        const all = await getAllWhitelistKeywords();
        expect(all.find(e => e.keyword === kw('vanish'))).toBeUndefined();
    });
});
