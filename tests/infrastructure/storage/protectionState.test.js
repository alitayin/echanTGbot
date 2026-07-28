import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const MODULE_PATH = '../../../src/infrastructure/storage/protectionState.js';
let loadedState = null;

async function loadState(dbPath) {
    process.env.PROTECTION_STATE_DB_PATH = dbPath;
    vi.resetModules();
    const module = await import(MODULE_PATH);
    loadedState = module.default || module;
    return loadedState;
}

afterEach(async () => {
    if (loadedState) {
        await loadedState.closeProtectionState().catch(() => {});
        loadedState = null;
    }
    delete process.env.PROTECTION_STATE_DB_PATH;
});

describe('protectionState', () => {
    it('defaults to disabled when no state has been stored', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'protection-state-'));
        const state = await loadState(path.join(dir, 'db'));

        expect(state.DEFAULT_PROTECTION_ENABLED).toBe(false);
        expect(await state.isProtectionEnabled()).toBe(false);
        expect(await state.getProtectionState()).toEqual({
            enabled: false,
            updatedAt: null,
            updatedBy: null,
        });
    });

    it('persists a manual change across module reloads', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'protection-state-'));
        const dbPath = path.join(dir, 'db');
        let state = await loadState(dbPath);

        await state.setProtectionEnabled(true, 'admin');
        expect(await state.isProtectionEnabled()).toBe(true);
        await state.closeProtectionState();
        loadedState = null;

        state = await loadState(dbPath);
        expect(await state.getProtectionState()).toMatchObject({
            enabled: true,
            updatedBy: 'admin',
        });
    });
});
