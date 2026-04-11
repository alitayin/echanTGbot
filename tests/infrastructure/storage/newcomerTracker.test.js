import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../../src/infrastructure/storage/newcomerTracker.js';

function createTempTrackerPath() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'newcomer-tracker-'));
    return path.join(dir, 'db');
}

async function loadTrackerModule(dbPath) {
    process.env.NEWCOMER_TRACKER_DB_PATH = dbPath;
    vi.resetModules();
    const module = await import(MODULE_PATH);
    return module.default || module;
}

beforeEach(() => {
    vi.spyOn(global, 'setInterval').mockReturnValue(0);
});

afterEach(() => {
    delete process.env.NEWCOMER_TRACKER_DB_PATH;
});

describe('newcomerTracker', () => {
    it('treats a recorded join as restricted during the first hour', async () => {
        const dbPath = createTempTrackerPath();
        const tracker = await loadTrackerModule(dbPath);
        const joinedAt = Date.UTC(2026, 3, 12, 0, 0, 0);

        await tracker.recordNewcomerJoin('-1001', '42', joinedAt);

        expect(await tracker.isUserRestrictedNewcomer('-1001', '42', joinedAt + 30 * 60 * 1000)).toBe(true);
    });

    it('stops treating a user as restricted after the one-hour window', async () => {
        const dbPath = createTempTrackerPath();
        const tracker = await loadTrackerModule(dbPath);
        const joinedAt = Date.UTC(2026, 3, 12, 0, 0, 0);

        await tracker.recordNewcomerJoin('-1001', '42', joinedAt);

        expect(await tracker.isUserRestrictedNewcomer('-1001', '42', joinedAt + (60 * 60 * 1000) + 1)).toBe(false);
    });

    it('clears newcomer state when the member leaves', async () => {
        const dbPath = createTempTrackerPath();
        const tracker = await loadTrackerModule(dbPath);
        const joinedAt = Date.UTC(2026, 3, 12, 0, 0, 0);

        await tracker.recordNewcomerJoin('-1001', '42', joinedAt);
        await tracker.clearNewcomerJoin('-1001', '42');

        expect(await tracker.isUserRestrictedNewcomer('-1001', '42', joinedAt + 5 * 60 * 1000)).toBe(false);
    });
});
