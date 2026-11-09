import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleHelpMenuCallback } from '../../../src/presentation/routes/helpMenuCallback.js';

const query = {
    id: 'callback-1',
    message: { chat: { id: 123 }, message_id: 456 },
};
const menuData = { text: 'Help', keyboard: [[{ text: 'Back', callback_data: 'help_main' }]] };

describe('help menu callback', () => {
    beforeEach(() => vi.useFakeTimers());

    it('updates the menu and clears its timeout before acknowledging the click', async () => {
        const bot = {
            editMessageText: vi.fn().mockResolvedValue(true),
            answerCallbackQuery: vi.fn().mockResolvedValue(true),
        };

        await handleHelpMenuCallback(query, bot, menuData);

        expect(bot.editMessageText).toHaveBeenCalledWith('Help', {
            chat_id: 123, message_id: 456, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: menuData.keyboard },
        });
        expect(bot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
        'Bad Request: message is not modified',
        'Bad Request: message is not modified: specified new message content and reply markup are exactly the same as a current content and reply markup of the message',
    ])('acknowledges a repeated click for Telegram response: %s', async description => {
        const bot = {
            editMessageText: vi.fn().mockRejectedValue(Object.assign(new Error(
                `ETELEGRAM: 400 ${description}`
            ), {
                response: { body: { error_code: 400, description } },
            })),
            answerCallbackQuery: vi.fn().mockResolvedValue(true),
        };

        await expect(handleHelpMenuCallback(query, bot, menuData)).resolves.toBeUndefined();
        expect(bot.answerCallbackQuery).toHaveBeenCalledWith('callback-1');
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
        'ETELEGRAM: 400 Bad Request: message not found',
        'ETELEGRAM: 403 Forbidden: bot was blocked by the user',
        'Network request failed while handling message is not modified',
    ])('still propagates other errors: %s', async message => {
        const bot = {
            editMessageText: vi.fn().mockRejectedValue(new Error(message)),
            answerCallbackQuery: vi.fn(),
        };

        await expect(handleHelpMenuCallback(query, bot, menuData)).rejects.toThrow(message);
        expect(bot.answerCallbackQuery).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('times out stalled edits so the router can report a retryable error', async () => {
        const bot = {
            editMessageText: vi.fn(() => new Promise(() => {})),
            answerCallbackQuery: vi.fn(),
        };

        const result = expect(handleHelpMenuCallback(query, bot, menuData)).rejects.toThrow('Help menu update timed out');
        await vi.advanceTimersByTimeAsync(5000);
        await result;
        expect(bot.answerCallbackQuery).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });
});
