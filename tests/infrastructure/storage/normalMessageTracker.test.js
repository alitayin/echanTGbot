import fs from 'fs';
import os from 'os';
import path from 'path';
import { Level } from 'level';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../../src/infrastructure/storage/normalMessageTracker.js';

function createTempTrackerPath() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'normal-message-tracker-'));
    return path.join(dir, 'db');
}

async function loadTrackerModule(dbPath) {
    process.env.NORMAL_MESSAGE_TRACKER_DB_PATH = dbPath;
    vi.resetModules();
    const module = await import(MODULE_PATH);
    return module.default || module;
}

beforeEach(() => {
    vi.spyOn(global, 'setInterval').mockReturnValue(0);
});

afterEach(() => {
    delete process.env.NORMAL_MESSAGE_TRACKER_DB_PATH;
});

describe('normalMessageTracker', () => {
    it('migrates legacy group-scoped records into global trusted state when loading', async () => {
        const dbPath = createTempTrackerPath();
        const db = new Level(dbPath, { valueEncoding: 'json' });

        await db.put('-1001:42', { streak: 1, trusted: false, lastUpdated: 10 });
        await db.put('-1002:42', { streak: 3, trusted: true, lastUpdated: 20 });
        await db.put('-1003:99', { streak: 2, trusted: false, lastUpdated: 30 });
        await db.close();

        const tracker = await loadTrackerModule(dbPath);

        expect(await tracker.isUserTrusted('42')).toBe(true);
        expect(await tracker.isUserTrusted('99')).toBe(false);

        const exported = await tracker.exportTrustedRecords();
        expect(exported).toEqual(expect.arrayContaining([
            { userId: '42', streak: 3, trusted: true, lastUpdated: 20 },
            { userId: '99', streak: 2, trusted: false, lastUpdated: 30 },
        ]));
    });

    it('marks a user globally trusted after reaching the normal streak threshold', async () => {
        const dbPath = createTempTrackerPath();
        const tracker = await loadTrackerModule(dbPath);

        await tracker.recordNormalMessage('777');
        await tracker.recordNormalMessage('777');
        expect(await tracker.isUserTrusted('777')).toBe(false);

        const record = await tracker.recordNormalMessage('777');
        expect(record).toMatchObject({ streak: 3, trusted: true });
        expect(await tracker.isUserTrusted('777')).toBe(true);

        const exported = await tracker.exportTrustedRecords();
        expect(exported).toEqual(expect.arrayContaining([
            { userId: '777', streak: 3, trusted: true, lastUpdated: record.lastUpdated },
        ]));
    });

    it('imports legacy group-scoped backups and aggregates them into one global record per user', async () => {
        const dbPath = createTempTrackerPath();
        const tracker = await loadTrackerModule(dbPath);

        const result = await tracker.importTrustedRecords([
            { chatId: '-1001', userId: 'alice', streak: 1, trusted: false, lastUpdated: 10 },
            { chatId: '-1002', userId: 'alice', streak: 4, trusted: true, lastUpdated: 40 },
            { userId: 'bob', streak: 2, trusted: false, lastUpdated: 25 },
        ]);

        expect(result).toEqual({ success: 2, failed: 0, errors: [] });
        expect(await tracker.isUserTrusted('alice')).toBe(true);
        expect(await tracker.isUserTrusted('bob')).toBe(false);

        const exported = await tracker.exportTrustedRecords();
        expect(exported).toEqual(expect.arrayContaining([
            { userId: 'alice', streak: 4, trusted: true, lastUpdated: 40 },
            { userId: 'bob', streak: 2, trusted: false, lastUpdated: 25 },
        ]));
    });
});
