import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../../src/infrastructure/storage/translationLinkStore.js';
let loadedStore = null;

async function loadStore(dbPath) {
    process.env.TRANSLATION_LINK_DB_PATH = dbPath;
    vi.resetModules();
    const module = await import(MODULE_PATH);
    loadedStore = module.default || module;
    return loadedStore;
}

afterEach(async () => {
    if (loadedStore) {
        await loadedStore.closeTranslationLinkStore().catch(() => {});
        loadedStore = null;
    }
    delete process.env.TRANSLATION_LINK_DB_PATH;
});

describe('translationLinkStore', () => {
    it('deletes every translation linked to an original message', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-links-'));
        const store = await loadStore(path.join(dir, 'db'));
        const bot = { deleteMessage: vi.fn().mockResolvedValue(true) };

        await store.recordTranslationLink(-1001, 10, 20);
        await store.recordTranslationLink(-1001, 10, 21);

        expect(await store.deleteLinkedTranslations(bot, -1001, 10)).toBe(2);
        expect(bot.deleteMessage).toHaveBeenNthCalledWith(1, -1001, 20);
        expect(bot.deleteMessage).toHaveBeenNthCalledWith(2, -1001, 21);
        expect(await store.getLink(-1001, 10)).toBeNull();
    });

    it('does nothing when the original has no linked translation', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-links-'));
        const store = await loadStore(path.join(dir, 'db'));
        const bot = { deleteMessage: vi.fn() };

        expect(await store.deleteLinkedTranslations(bot, -1001, 999)).toBe(0);
        expect(bot.deleteMessage).not.toHaveBeenCalled();
    });

    it('prunes expired links', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'translation-links-'));
        const store = await loadStore(path.join(dir, 'db'));

        const now = Date.now();
        await store.recordTranslationLink(-1001, 1, 11);
        await store.recordTranslationLink(-1001, 2, 12);
        const ttlMs = 48 * 60 * 60 * 1000;
        const expiredAt = now + ttlMs + 60_000;
        vi.spyOn(Date, 'now').mockReturnValue(expiredAt);

        expect(await store.pruneExpiredLinks(expiredAt)).toBe(2);
        expect(await store.getLink(-1001, 1)).toBeNull();
        expect(await store.getLink(-1001, 2)).toBeNull();
    });
});
