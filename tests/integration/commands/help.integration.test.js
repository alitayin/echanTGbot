import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockTelegramBot } from '../../helpers/MockTelegramBot.js';
import { handleHelp } from '../../../src/presentation/routes/commandHandlers.js';

describe('Help Command Integration', () => {
    let mockBot;
    let mockMsg;

    beforeEach(() => {
        mockBot = new MockTelegramBot();
        mockMsg = {
            chat: { id: 123, type: 'private' },
            from: { id: 456, username: 'testuser' },
            text: '/help'
        };
        mockBot.clearHistory();
    });

    it('should send help menu when /help is called', async () => {
        await handleHelp(mockMsg, mockBot);

        const sentMsg = mockBot.getLastSentMessage();
        expect(sentMsg).toBeDefined();
        expect(sentMsg.chat.id).toBe(123);
        expect(sentMsg.text).toBeDefined();
        expect(sentMsg.parse_mode).toBe('HTML');
    });

    it('should include inline keyboard with help menu', async () => {
        await handleHelp(mockMsg, mockBot);

        const sentMsg = mockBot.getLastSentMessage();
        expect(sentMsg.reply_markup).toBeDefined();
        expect(sentMsg.reply_markup.inline_keyboard).toBeDefined();
        expect(sentMsg.reply_markup.inline_keyboard.length).toBeGreaterThan(0);
    });

    it('should show different menu for admin users', async () => {
        // Mock admin user
        mockMsg.from.username = 'admin1'; // Assuming admin1 is in ALLOWED_USERS

        await handleHelp(mockMsg, mockBot);

        const sentMsg = mockBot.getLastSentMessage();
        expect(sentMsg).toBeDefined();
        // Admin menu should have more options
    });

    it('should show limited menu for regular users', async () => {
        mockMsg.from.username = 'regularuser';

        await handleHelp(mockMsg, mockBot);

        const sentMsg = mockBot.getLastSentMessage();
        expect(sentMsg).toBeDefined();
        // Regular user menu should have fewer options
    });
});
