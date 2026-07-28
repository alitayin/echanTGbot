import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let router;

function makeBot() {
    return {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    };
}

function makeMessage(text, overrides = {}) {
    return {
        text,
        chat: { id: 1, type: 'private' },
        from: { id: 42, username: 'admin' },
        ...overrides,
    };
}

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'protection-commands-'));
    process.env.PROTECTION_STATE_DB_PATH = path.join(dir, 'db');
    vi.resetModules();

    const registryModule = await import('../../src/presentation/routes/commandRegistry.js');
    const registry = registryModule.default || registryModule;
    router = registry.createCommandRouter();
});

afterAll(() => {
    delete process.env.PROTECTION_STATE_DB_PATH;
});

describe('protection commands', () => {
    it('starts disabled', async () => {
        const bot = makeBot();
        await router.handleMessage(makeMessage('/protectionstatus'), bot);

        expect(bot.sendMessage).toHaveBeenCalledWith(
            1,
            expect.stringContaining('Protection is disabled.'),
            {}
        );
    });

    it('does not allow the command in a group', async () => {
        const bot = makeBot();
        const msg = makeMessage('/enableprotection', {
            chat: { id: -1001, type: 'supergroup' },
        });

        expect(await router.handleMessage(msg, bot)).toBe(true);
        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    it('rejects a non-admin in a private chat', async () => {
        const bot = makeBot();
        const msg = makeMessage('/enableprotection', {
            from: { id: 7, username: 'alice' },
        });

        expect(await router.handleMessage(msg, bot)).toBe(true);
        expect(bot.sendMessage).toHaveBeenCalledWith(
            1,
            '❌ This command is only available to administrators.',
            {}
        );
    });

    it('allows an allowlisted admin to enable and disable protection in a private chat', async () => {
        const bot = makeBot();

        await router.handleMessage(makeMessage('/enableprotection'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(
            1,
            'Protection enabled globally.',
            {}
        );

        await router.handleMessage(makeMessage('/disableprotection'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(
            1,
            'Protection disabled globally.',
            {}
        );
    });
});
