import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Module, { createRequire } from 'module';
import { MockTelegramBot } from '../../helpers/MockTelegramBot.js';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const commandHandlersPath = require.resolve('../../../src/presentation/routes/commandHandlers.js');
const timeHandlerPath = require.resolve('../../../src/application/usecases/timeHandler.js');

const timeHandlerMocks = vi.hoisted(() => ({
    handleTimeCommand: vi.fn(),
}));

let handleTime;

describe('time command route', () => {
    beforeEach(() => {
        Module._load = function patchedLoad(request, parent, isMain) {
            // Time routing does not use the other commands or their storage/network clients.
            if (parent?.filename === commandHandlersPath && (
                request.startsWith('../../application/usecases/') && request !== '../../application/usecases/timeHandler.js'
                || request === '../../infrastructure/storage/userAddressStore.js'
            )) return {};
            const resolved = Module._resolveFilename(request, parent, isMain);
            if (resolved === timeHandlerPath) return timeHandlerMocks;
            return originalLoad.call(this, request, parent, isMain);
        };

        delete require.cache[commandHandlersPath];
        ({ handleTime } = require(commandHandlersPath));
        vi.clearAllMocks();
    });

    afterEach(() => {
        Module._load = originalLoad;
        delete require.cache[commandHandlersPath];
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    function createBot() {
        const bot = new MockTelegramBot();
        bot.sendMessage = async (chatId, text, options = {}) => {
            bot.sentMessages.push({
                message_id: 0,
                chat: { id: chatId },
                text,
                ...options,
            });
            return { message_id: 0 };
        };
        return bot;
    }

    it('clears the request timeout after a successful time lookup', async () => {
        vi.useFakeTimers();
        timeHandlerMocks.handleTimeCommand.mockResolvedValue({
            times: [],
            unrecognizedInputs: [],
            standard: { utc: 'Thu, 01 Jan 2026 00:00:00 GMT', iso: '2026-01-01T00:00:00.000Z', timestamp: 1767225600 },
        });
        const bot = createBot();

        await handleTime({ chat: { id: 100 }, text: '/time' }, bot);

        expect(bot.getLastEditedMessage().text).toContain('World Time');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('shows a clear retry message when both attempts fail', async () => {
        vi.useFakeTimers();
        timeHandlerMocks.handleTimeCommand.mockRejectedValue(new Error('lookup failed'));
        const bot = createBot();

        await handleTime({ chat: { id: 100 }, text: '/time' }, bot);

        expect(bot.getLastEditedMessage().text).toContain('Could not get the world time');
        expect(vi.getTimerCount()).toBe(0);
    });
});
