/**
 * Tests for messageHandler.js — focusing on the overwrite bug fix (task 3)
 * and general command validation.
 *
 * Uses ESM imports (not createRequire) so that vi.mock can intercept the
 * internal require() calls that the handler makes at module load time.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.mock calls are hoisted by vitest before the imports below are resolved.

vi.mock('../../../src/infrastructure/storage/storedMessageStore.js', () => ({
    saveMessage: vi.fn().mockResolvedValue(true),
    deleteMessage: vi.fn().mockResolvedValue(true),
    getMessage: vi.fn().mockResolvedValue(null),
    getAllMessages: vi.fn().mockResolvedValue([]),
    messageExists: vi.fn().mockResolvedValue(false),
    saveScheduledMessage: vi.fn().mockResolvedValue(true),
    deleteScheduledMessageByName: vi.fn().mockResolvedValue(true),
    getAllScheduledMessages: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../../src/infrastructure/telegram/promptMessenger.js', () => ({
    sendPromptMessage: vi.fn().mockResolvedValue({ message_id: 99 }),
}));

vi.mock('../../../src/infrastructure/telegram/autoDeleteManager.js', () => ({
    resolveAutoDeleteDelayMs: vi.fn().mockReturnValue(30000),
    scheduleAutoDelete: vi.fn(),
}));

// --- Import the mocked modules so we can control them per-test ---
import * as store from '../../../src/infrastructure/storage/storedMessageStore.js';

// --- Import the module under test (gets mocked dependencies automatically) ---
import {
    handleMessageCommand,
    handleMessageCallback,
    handleDeleteMessageCommand,
} from '../../../src/application/usecases/messageHandler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBot() {
    return {
        sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
        deleteMessage: vi.fn().mockResolvedValue({}),
        editMessageText: vi.fn().mockResolvedValue({}),
        answerCallbackQuery: vi.fn().mockResolvedValue({}),
        getFileStream: vi.fn(),
    };
}

function makeMsg(text, overrides = {}) {
    return {
        text,
        chat: { id: -100, title: 'Test Group', type: 'supergroup' },
        from: { id: 42, username: 'testuser', first_name: 'Test' },
        message_id: 1,
        ...overrides,
    };
}

function makeReplyMsg(text, replyText, overrides = {}) {
    return makeMsg(text, {
        reply_to_message: {
            text: replyText,
            message_id: 55,
            ...(overrides.reply_to_message || {}),
        },
        ...overrides,
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    store.messageExists.mockResolvedValue(false);
    store.saveMessage.mockResolvedValue(true);
    store.deleteMessage.mockResolvedValue(true);
    store.getMessage.mockResolvedValue(null);
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('handleMessageCommand — validation', () => {
    it('requires a reply_to_message; sends usage hint when missing', async () => {
        const bot = makeBot();
        await handleMessageCommand(makeMsg('/message testcmd'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('reply to a message'), expect.anything());
    });

    it('requires a command name after /message', async () => {
        const bot = makeBot();
        const msg = makeReplyMsg('/message', 'some content');
        await handleMessageCommand(msg, bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('command name'), expect.anything());
    });

    it('rejects command names with special characters', async () => {
        const bot = makeBot();
        const msg = makeReplyMsg('/message bad-name!', 'content');
        await handleMessageCommand(msg, bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('letters, numbers, and underscores'), expect.anything());
    });

    it('rejects when reply_to_message has no text or caption', async () => {
        const bot = makeBot();
        const msg = makeMsg('/message testcmd', {
            reply_to_message: { message_id: 55 },
        });
        await handleMessageCommand(msg, bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('no content'), expect.anything());
    });
});

// ---------------------------------------------------------------------------
// Save new command (no existing)
// ---------------------------------------------------------------------------

describe('handleMessageCommand — save new command', () => {
    it('confirms success when command does not exist', async () => {
        const bot = makeBot();
        const msg = makeReplyMsg('/message greet', 'Hello everyone!');
        await handleMessageCommand(msg, bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('greet'), expect.anything());
    });

    it('responds when command name is uppercase', async () => {
        const bot = makeBot();
        const msg = makeReplyMsg('/message SHOUT', 'content');
        await handleMessageCommand(msg, bot);
        expect(bot.sendMessage).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Overwrite confirmation flow (bug fix, task 3)
// ---------------------------------------------------------------------------

describe('handleMessageCommand — overwrite confirmation flow', () => {
    it('shows overwrite confirmation when command already exists', async () => {
        store.messageExists.mockResolvedValue(true);
        const bot = makeBot();
        const msg = makeReplyMsg('/message greet', 'New greeting');
        await handleMessageCommand(msg, bot);

        // Should NOT save yet
        expect(store.saveMessage).not.toHaveBeenCalled();

        // Should show inline keyboard confirmation
        expect(bot.sendMessage).toHaveBeenCalledWith(
            -100,
            expect.stringContaining('already exists'),
            expect.objectContaining({
                reply_markup: expect.objectContaining({
                    inline_keyboard: expect.any(Array),
                }),
            })
        );
    });

    it('actually saves when user confirms overwrite via callback', async () => {
        store.messageExists.mockResolvedValue(true);
        const chatId = -100;
        const userId = 42;
        const commandName = 'greet';
        const bot = makeBot();
        const msg = makeReplyMsg(`/message ${commandName}`, 'Updated greeting');

        // Step 1: trigger overwrite prompt (populates pendingOverwrites)
        await handleMessageCommand(msg, bot);

        // Step 2: simulate user clicking "Yes, overwrite"
        const callbackData = `msg_overwrite__${chatId}__${userId}__${commandName}`;
        const callbackQuery = {
            id: 'cb1',
            data: callbackData,
            message: { chat: { id: chatId }, message_id: 99 },
        };
        await handleMessageCallback(callbackQuery, bot);

        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('overwritten'),
            expect.objectContaining({ chat_id: chatId, message_id: 99 })
        );
    });

    it('reports expiry when pending data is absent on overwrite callback', async () => {
        const bot = makeBot();
        const callbackQuery = {
            id: 'cb2',
            data: 'msg_overwrite__-100__42__nonexistent',
            message: { chat: { id: -100 }, message_id: 99 },
        };
        await handleMessageCallback(callbackQuery, bot);

        expect(store.saveMessage).not.toHaveBeenCalled();
        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringMatching(/expired|again/i),
            expect.anything()
        );
    });

    it('expires a real pending overwrite after 5 minutes', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-02T10:00:00Z'));

        store.messageExists.mockResolvedValue(true);
        const bot = makeBot();
        const chatId = -100;
        const userId = 42;
        const commandName = 'timed';

        await handleMessageCommand(
            makeReplyMsg(`/message ${commandName}`, 'This should expire'),
            bot
        );

        vi.advanceTimersByTime(5 * 60 * 1000 + 1);

        await handleMessageCallback(
            {
                id: 'cb-expire-real',
                data: `msg_overwrite__${chatId}__${userId}__${commandName}`,
                message: { chat: { id: chatId }, message_id: 123 },
            },
            bot
        );

        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringMatching(/expired|again/i),
            expect.objectContaining({ chat_id: chatId, message_id: 123 })
        );
    });

    it('handles command names with underscores correctly', async () => {
        store.messageExists.mockResolvedValue(true);
        const bot = makeBot();
        const commandName = 'hello_world';
        const msg = makeMsg(`/message ${commandName}`, {
            from: { id: 7, username: 'admin', first_name: 'Admin' },
            chat: { id: -200, title: 'G', type: 'supergroup' },
            reply_to_message: { text: 'underscored content', message_id: 55 },
        });
        await handleMessageCommand(msg, bot);

        const callbackData = `msg_overwrite__-200__7__${commandName}`;
        const callbackQuery = {
            id: 'cb3',
            data: callbackData,
            message: { chat: { id: -200 }, message_id: 10 },
        };
        await handleMessageCallback(callbackQuery, bot);

        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('overwritten'),
            expect.objectContaining({ chat_id: -200, message_id: 10 })
        );
    });
});

// ---------------------------------------------------------------------------
// Cancel callback
// ---------------------------------------------------------------------------

describe('handleMessageCallback — cancel', () => {
    it('edits message to cancelled on msg_cancel', async () => {
        const bot = makeBot();
        const query = {
            id: 'q1',
            data: 'msg_cancel',
            message: { chat: { id: -100 }, message_id: 5 },
        };
        await handleMessageCallback(query, bot);
        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('cancelled'),
            expect.objectContaining({ chat_id: -100, message_id: 5 })
        );
        expect(bot.answerCallbackQuery).toHaveBeenCalledWith('q1');
    });
});

// ---------------------------------------------------------------------------
// Delete callback
// ---------------------------------------------------------------------------

describe('handleMessageCallback — delete', () => {
    it('confirms on msg_delete_', async () => {
        const bot = makeBot();
        const query = {
            id: 'q2',
            data: 'msg_delete_greet',
            message: { chat: { id: -100 }, message_id: 6 },
        };
        await handleMessageCallback(query, bot);
        expect(bot.editMessageText).toHaveBeenCalledWith(
            expect.stringContaining('"greet"'),
            expect.anything()
        );
    });
});

// ---------------------------------------------------------------------------
// handleDeleteMessageCommand
// ---------------------------------------------------------------------------

describe('handleDeleteMessageCommand', () => {
    it('sends usage hint when no command name provided', async () => {
        const bot = makeBot();
        await handleDeleteMessageCommand(makeMsg('/deletemessage'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('Usage'), expect.anything());
    });

    it('shows not-found message when command does not exist', async () => {
        store.getMessage.mockResolvedValue(null);
        const bot = makeBot();
        await handleDeleteMessageCommand(makeMsg('/deletemessage nokey'), bot);
        expect(bot.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('No message found'), expect.anything());
    });

    it('shows a response when deleting a named command', async () => {
        const bot = makeBot();
        await handleDeleteMessageCommand(makeMsg('/deletemessage greet'), bot);
        expect(bot.sendMessage).toHaveBeenCalled();
    });
});
