import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockTelegramBot } from '../../helpers/MockTelegramBot.js';

const timeHandlerMocks = vi.hoisted(() => ({
    handleTimeCommand: vi.fn(),
}));

vi.mock('../../../src/application/usecases/timeHandler.js', () => timeHandlerMocks);

import { handleTime } from '../../../src/presentation/routes/commandHandlers.js';

describe('time command route', () => {
    afterEach(() => {
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
