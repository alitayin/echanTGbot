import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let bot;
let handlers;

beforeAll(async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'protection-routing-'));
    process.env.PROTECTION_STATE_DB_PATH = path.join(dir, 'db');
    vi.resetModules();

    handlers = new Map();
    bot = {
        on: vi.fn((event, handler) => {
            if (!handlers.has(event)) handlers.set(event, []);
            handlers.get(event).push(handler);
        }),
        sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
        getMe: vi.fn().mockResolvedValue({ id: 999, username: 'test_bot' }),
        getChatMember: vi.fn().mockResolvedValue({ status: 'administrator' }),
        deleteMessage: vi.fn().mockResolvedValue(true),
        banChatMember: vi.fn().mockResolvedValue(true),
        unbanChatMember: vi.fn().mockResolvedValue(true),
        emit: vi.fn(),
        async simulateMessage(msg) {
            for (const handler of handlers.get('message') || []) {
                await handler(msg);
            }
        },
    };

    const routerModule = await import('../../src/presentation/router.js');
    const { registerRoutes } = routerModule.default || routerModule;
    registerRoutes(bot);
});

afterAll(() => {
    delete process.env.PROTECTION_STATE_DB_PATH;
});

describe('default-disabled protection routing', () => {
    it('registers one sequential listener for ordinary messages', () => {
        expect(handlers.get('message')).toHaveLength(1);
    });

    it('does not invoke Telegram moderation APIs for an ordinary group message', async () => {
        await bot.simulateMessage({
            message_id: 10,
            date: Math.floor(Date.now() / 1000),
            chat: { id: -1001, type: 'supergroup', title: 'Test Group' },
            from: { id: 7, username: 'alice', first_name: 'Alice', is_bot: false },
            text: 'hello everyone',
        });

        expect(bot.getMe).not.toHaveBeenCalled();
        expect(bot.getChatMember).not.toHaveBeenCalled();
        expect(bot.deleteMessage).not.toHaveBeenCalled();
        expect(bot.banChatMember).not.toHaveBeenCalled();
        expect(bot.unbanChatMember).not.toHaveBeenCalled();
    });
});
