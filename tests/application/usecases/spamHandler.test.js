import fs from 'fs';
import { createRequire } from 'module';
import os from 'os';
import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const trackerDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spam-handler-trackers-'));
process.env.NORMAL_MESSAGE_TRACKER_DB_PATH = path.join(trackerDir, 'normalMessageTracker');
process.env.NEWCOMER_TRACKER_DB_PATH = path.join(trackerDir, 'newcomerTracker');

const require = createRequire(import.meta.url);

const state = vi.hoisted(() => ({
    trusted: false,
    restrictedNewcomer: false,
    whitelistHit: null,
    spamRecords: new Map(),
    deleteMessage: vi.fn(async () => true),
    banUser: vi.fn(async () => true),
    handleKick: vi.fn(async () => true),
    handleUnban: vi.fn(async () => true),
    handleForward: vi.fn(async () => true),
    getIsAdmin: vi.fn(async () => false),
    hasImageMedia: vi.fn(() => false),
    getImageUrls: vi.fn(async () => []),
    getImageFileId: vi.fn(() => null),
    isSpamImage: vi.fn(async () => false),
    addSpamImage: vi.fn(async () => true),
    isSimilarToSpam: vi.fn(() => false),
    addSpamMessage: vi.fn(),
    fetchMessageAnalysis: vi.fn(async () => ({ is_english: true, spam: false, deviation: 0, suspicion: 0, inducement: 0 })),
    fetchMessageAnalysisWithImage: vi.fn(async () => ({ is_english: true, spam: false, deviation: 0, suspicion: 0, inducement: 0 })),
    performSecondarySpamCheck: vi.fn(async () => false),
    translateToEnglishIfTargetGroup: vi.fn(async () => true),
    isUserTrusted: vi.fn(async () => state.trusted),
    isUserRestrictedNewcomer: vi.fn(async () => state.restrictedNewcomer),
    recordNormalMessage: vi.fn(async () => true),
    resetNormalMessageStreak: vi.fn(async () => true),
}));

vi.mock('../../../src/utils/logger.js', () => ({
    default: { axiomOnly: vi.fn() },
}));

vi.mock('../../../src/infrastructure/ai/messageAnalysis.js', () => ({
    fetchMessageAnalysis: state.fetchMessageAnalysis,
    fetchMessageAnalysisWithImage: state.fetchMessageAnalysisWithImage,
}));

vi.mock('../../../src/infrastructure/ai/secondarySpamCheck.js', () => ({
    performSecondarySpamCheck: state.performSecondarySpamCheck,
}));

vi.mock('../../../src/infrastructure/ai/translation.js', () => ({
    translateToEnglishIfTargetGroup: state.translateToEnglishIfTargetGroup,
}));

vi.mock('../../../src/infrastructure/storage/spamUserStore.js', () => ({
    updateSpamRecord: vi.fn((userId) => {
        const existing = state.spamRecords.get(userId) || { count: 0, firstSpamTime: Date.now() };
        const next = { ...existing, count: existing.count + 1 };
        state.spamRecords.set(userId, next);
        return next;
    }),
}));

vi.mock('../../../src/infrastructure/storage/spamMessageCache.js', () => ({
    isSimilarToSpam: state.isSimilarToSpam,
    addSpamMessage: state.addSpamMessage,
}));

vi.mock('../../../src/infrastructure/storage/spamImageStore.js', () => ({
    addSpamImage: state.addSpamImage,
    isSpamImage: state.isSpamImage,
}));

vi.mock('../../../src/infrastructure/telegram/adminActions.js', () => ({
    banUser: state.banUser,
    kickUser: state.handleKick,
    unbanUser: state.handleUnban,
    deleteMessage: state.deleteMessage,
    forwardMessage: state.handleForward,
    getIsAdmin: state.getIsAdmin,
}));

vi.mock('../../../src/infrastructure/telegram/mediaHelper.js', () => ({
    getImageUrls: state.getImageUrls,
    hasImageMedia: state.hasImageMedia,
    getImageFileId: state.getImageFileId,
}));

vi.mock('../../../src/infrastructure/storage/whitelistKeywordStore.js', () => ({
    containsWhitelistKeyword: vi.fn(async () => state.whitelistHit),
}));

vi.mock('../../../src/application/usecases/spamModerationHandler.js', () => ({
    buildSpamModerationButtons: vi.fn(() => ({})),
}));

vi.mock('../../../src/domain/utils/englishHighFreq.js', () => ({
    HIGH_FREQ_WORDS: [],
}));

vi.mock('../../../src/domain/utils/messageContext.js', () => ({
    extractReplyMarkupSummary: vi.fn(() => []),
}));

vi.mock('../../../src/domain/utils/languageDetect.js', () => ({
    detectNonEnglish: vi.fn(() => ({ shouldCheckWithApi: false, reasons: [], durationMs: 0 })),
}));

vi.mock('../../../src/domain/utils/text.js', () => ({
    truncate: vi.fn((value) => value),
}));

vi.mock('../../../src/infrastructure/telegram/promptMessenger.js', () => ({
    sendPromptMessage: vi.fn(async (bot, chatId, text, options = {}) => bot.sendMessage(chatId, text, options)),
}));

const { processGroupMessage, buildCombinedAnalysisQuery } = require('../../../src/application/usecases/spamHandler.js');
const { markUserTrusted, resetNormalMessageStreak } = require('../../../src/infrastructure/storage/normalMessageTracker.js');
const { recordNewcomerJoin, clearNewcomerJoin } = require('../../../src/infrastructure/storage/newcomerTracker.js');

describe('spamHandler module exports', () => {
    it('exports processGroupMessage', () => {
        expect(typeof processGroupMessage).toBe('function');
    });
    it('exports buildCombinedAnalysisQuery', () => {
        expect(typeof buildCombinedAnalysisQuery).toBe('function');
    });
});

describe('buildCombinedAnalysisQuery', () => {
    it('returns plain text message content', () => {
        const msg = { text: 'buy crypto now', from: { first_name: 'Bob', last_name: '' } };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('buy crypto now');
    });

    it('falls back to caption when no text', () => {
        const msg = { caption: 'photo caption', from: { first_name: 'A', last_name: '' } };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('photo caption');
    });

    it('includes [Forwarded from] prefix for forwarded messages', () => {
        const msg = {
            text: 'forwarded text',
            forward_from: { username: 'spammer' },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Forwarded from @spammer]');
    });

    it('includes poll question', () => {
        const msg = {
            poll: { question: 'Win free XEC?', options: [{ text: 'Yes' }, { text: 'No' }] },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Poll]: Win free XEC?');
        expect(result).toContain('Yes | No');
    });

    it('includes contact info', () => {
        const msg = {
            contact: { first_name: 'Eve', last_name: 'Smith', phone_number: '+1234' },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Contact]: Eve Smith +1234');
    });

    it('includes location coordinates', () => {
        const msg = {
            location: { latitude: 1.23, longitude: 4.56 },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Location]: 1.23, 4.56');
    });

    it('includes inline keyboard button text', () => {
        const msg = {
            text: 'click me',
            reply_markup: { inline_keyboard: [[{ text: 'Claim reward', url: 'http://spam.com' }]] },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Button]: Claim reward');
    });

    it('includes channel name for channel messages', () => {
        const msg = {
            text: 'channel post',
            sender_chat: { title: 'Crypto Pump Channel' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Channel]: Crypto Pump Channel');
    });

    it('includes quoted text', () => {
        const msg = {
            text: 'reply',
            quote: { text: 'original message' },
            from: { first_name: 'A', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Quoted]: original message');
    });

    it('returns empty string for empty message', () => {
        const result = buildCombinedAnalysisQuery({});
        expect(typeof result).toBe('string');
    });

    it('returns empty string for null input', () => {
        const result = buildCombinedAnalysisQuery(null);
        expect(result).toBe('');
    });

    // --- reply_to_message extraction (task 2) ---

    it('includes reply_to_message text with sender username', () => {
        const msg = {
            text: 'hi',
            reply_to_message: {
                text: 'Win 100 BTC click here now!',
                from: { username: 'spammer123' },
            },
            from: { first_name: 'Alice', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Replying to @spammer123]');
        expect(result).toContain('Win 100 BTC click here now!');
        expect(result).toContain('hi');
    });

    it('includes reply_to_message caption when no text', () => {
        const msg = {
            text: 'check this',
            reply_to_message: {
                caption: 'Earn 1000x guaranteed',
                from: { username: 'bot_spam' },
            },
            from: { first_name: 'Bob', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('Earn 1000x guaranteed');
    });

    it('falls back to "unknown" when reply_to_message has no username', () => {
        const msg = {
            text: 'ok',
            reply_to_message: {
                text: 'spam content here',
                from: {},
            },
            from: { first_name: 'Carol', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Replying to @unknown]');
        expect(result).toContain('spam content here');
    });

    it('ignores reply_to_message when its text is empty', () => {
        const msg = {
            text: 'hello',
            reply_to_message: { text: '', from: { username: 'someone' } },
            from: { first_name: 'Dave', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).not.toContain('[Replying to');
    });

    it('a short innocent message includes full spam from reply_to_message', () => {
        const msg = {
            text: '好的',
            reply_to_message: {
                text: 'FREE CRYPTO GIVEAWAY! Send 0.1 ETH get 1 ETH back! Limited time only!',
                from: { username: 'giveaway_scam' },
            },
            from: { first_name: 'Eve', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('FREE CRYPTO GIVEAWAY');
        expect(result).toContain('[Replying to @giveaway_scam]');
    });

    // --- external_reply extraction (task 2) ---

    it('includes external_reply text with channel title', () => {
        const msg = {
            text: 'see above',
            external_reply: {
                origin: { chat: { title: 'Crypto Pump Group' } },
                text: 'Send BTC and get 10x returns immediately',
            },
            from: { first_name: 'Alice', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[External quote from "Crypto Pump Group"]');
        expect(result).toContain('Send BTC and get 10x returns immediately');
    });

    it('includes external_reply origin title even when text is absent', () => {
        const msg = {
            text: 'check this out',
            external_reply: {
                origin: { chat: { title: 'Shady Channel' } },
            },
            from: { first_name: 'Bob', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[External quote from "Shady Channel"]');
    });

    it('uses sender_user_name as fallback when no chat title in external_reply', () => {
        const msg = {
            text: 'fwd',
            external_reply: {
                origin: { sender_user_name: 'some_channel' },
                text: 'Buy crypto now at discount',
            },
            from: { first_name: 'Carol', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[External quote from "some_channel"]');
        expect(result).toContain('Buy crypto now at discount');
    });

    it('ignores external_reply when origin has no title and no text', () => {
        const msg = {
            text: 'hi',
            external_reply: { origin: {} },
            from: { first_name: 'Dave', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).not.toContain('[External quote');
    });

    it('combines user text + reply_to_message + external_reply in a single query', () => {
        const msg = {
            text: 'hi',
            reply_to_message: {
                text: 'spam from reply',
                from: { username: 'user_a' },
            },
            external_reply: {
                origin: { chat: { title: 'External Channel' } },
                text: 'spam from external',
            },
            from: { first_name: 'Fred', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('hi');
        expect(result).toContain('spam from reply');
        expect(result).toContain('spam from external');
        expect(result).toContain('[Replying to @user_a]');
        expect(result).toContain('[External quote from "External Channel"]');
    });

    it('uses forwarded caption when forwarded message has no text', () => {
        const msg = {
            caption: 'forwarded caption spam',
            forward_from_chat: { title: 'Spam News' },
            from: { first_name: 'Alice', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Forwarded from Spam News] forwarded caption spam');
    });

    it('keeps forwarded, quoted, reply_to_message, and external_reply content together', () => {
        const msg = {
            text: 'hi',
            forward_from: { username: 'origin_spammer' },
            quote: { text: 'quoted scam fragment' },
            reply_to_message: {
                caption: 'reply caption scam fragment',
                from: { username: 'reply_user' },
            },
            external_reply: {
                origin: { chat: { title: 'External Scam Channel' } },
                caption: 'external caption scam fragment',
            },
            from: { first_name: 'Mix', last_name: 'User' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('[Forwarded from @origin_spammer] hi');
        expect(result).toContain('[Quoted]: quoted scam fragment');
        expect(result).toContain('[Replying to @reply_user]: reply caption scam fragment');
        expect(result).toContain('[External quote from "External Scam Channel"]: external caption scam fragment');
    });
});

describe('processGroupMessage policy integration', () => {
    beforeEach(async () => {
        state.trusted = false;
        state.restrictedNewcomer = false;
        state.whitelistHit = null;
        state.spamRecords = new Map();
        state.addSpamImage.mockClear();
        state.banUser.mockClear();
        state.handleKick.mockClear();
        state.handleUnban.mockClear();
        state.handleForward.mockClear();
        state.getIsAdmin.mockClear();
        state.hasImageMedia.mockClear();
        state.hasImageMedia.mockImplementation(() => false);
        state.getImageUrls.mockClear();
        state.getImageUrls.mockImplementation(async () => []);
        state.getImageFileId.mockClear();
        state.getImageFileId.mockImplementation(() => null);
        state.isSpamImage.mockClear();
        state.isSpamImage.mockImplementation(async () => false);
        state.addSpamImage.mockClear();
        state.isSimilarToSpam.mockClear();
        state.isSimilarToSpam.mockImplementation(() => false);
        state.addSpamMessage.mockClear();
        state.fetchMessageAnalysis.mockClear();
        state.fetchMessageAnalysis.mockImplementation(async () => ({ is_english: true, spam: false, deviation: 0, suspicion: 0, inducement: 0 }));
        state.fetchMessageAnalysisWithImage.mockClear();
        state.fetchMessageAnalysisWithImage.mockImplementation(async () => ({ is_english: true, spam: false, deviation: 0, suspicion: 0, inducement: 0 }));
        state.performSecondarySpamCheck.mockClear();
        state.performSecondarySpamCheck.mockImplementation(async () => false);
        state.translateToEnglishIfTargetGroup.mockClear();
        state.isUserTrusted.mockClear();
        state.isUserTrusted.mockImplementation(async () => state.trusted);
        state.isUserRestrictedNewcomer.mockClear();
        state.isUserRestrictedNewcomer.mockImplementation(async () => state.restrictedNewcomer);
        state.recordNormalMessage.mockClear();
        state.resetNormalMessageStreak.mockClear();

        await clearNewcomerJoin('-1001', '123');
        await resetNormalMessageStreak('123');
    });

    function createBot() {
        return {
            getMe: vi.fn(async () => ({ id: 999 })),
            getChatMember: vi.fn(async (chatId, userId) => ({ status: userId === 999 ? 'administrator' : 'member' })),
            sendMessage: vi.fn(async () => ({ message_id: 500 })),
            deleteMessage: vi.fn(async () => true),
            forwardMessage: vi.fn(async () => true),
            banChatMember: vi.fn(async () => true),
            unbanChatMember: vi.fn(async () => true),
            banChatSenderChat: vi.fn(async () => true),
        };
    }

    function createPorts() {
        return {
            telegramGroup: {
                hasMember: vi.fn(async () => true),
            },
        };
    }

    function createMessage(overrides = {}) {
        return {
            chat: { id: -1001, type: 'supergroup', title: 'Test Group' },
            message_id: 42,
            text: 'hello world',
            from: { id: 123, first_name: 'Alice', username: 'alice' },
            ...overrides,
        };
    }

    it('warns on first forwarded-channel violation for restricted newcomers', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({
            text: 'forwarded content',
            forward_from_chat: { id: -2000, type: 'channel', title: 'Origin Channel' },
        });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).toHaveBeenCalledWith(msg.chat.id, msg.message_id);
        expect(bot.forwardMessage).toHaveBeenCalledWith(expect.anything(), msg.chat.id, msg.message_id);
        expect(bot.sendMessage).toHaveBeenCalledWith(
            msg.chat.id,
            '@alice I removed your message because new members cannot forward messages from channels or other groups, send non-whitelisted links, or post inline buttons during their first hour in this group.',
            { parse_mode: 'HTML' }
        );
        expect(bot.banChatMember).not.toHaveBeenCalled();
    });

    it('escalates repeat newcomer policy violations within 30 minutes via spam deletion path', async () => {
        const bot = createBot();
        const ports = createPorts();
        const first = createMessage({ text: 'visit https://spam.example', message_id: 100 });
        const second = createMessage({ text: 'another https://spam.example', message_id: 101 });
        await recordNewcomerJoin(first.chat.id, first.from.id, Date.now());

        await processGroupMessage(first, bot, ports);
        await processGroupMessage(second, bot, ports);

        expect(bot.deleteMessage).toHaveBeenCalledWith(second.chat.id, second.message_id);
        expect(bot.banChatMember).toHaveBeenCalledWith(second.chat.id, second.from.id);
        expect(bot.forwardMessage).toHaveBeenCalledWith(expect.anything(), second.chat.id, second.message_id);
    });

    it('allows ordinary reply_to_message for restricted newcomers', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({
            text: 'thanks',
            reply_to_message: {
                text: 'ordinary prior message',
                from: { username: 'bob' },
            },
        });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).not.toHaveBeenCalled();
    });

    it('allows quoted messages for restricted newcomers', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({
            text: 'see above',
            quote: {
                text: 'quoted message',
                origin: {
                    type: 'channel',
                    chat: { username: 'harmless_channel', title: 'Harmless Channel' },
                },
            },
        });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).not.toHaveBeenCalled();
    });

    it('blocks non-whitelisted links for restricted newcomers', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({ text: 'https://x.com/random_user/status/99' });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).toHaveBeenCalledWith(msg.chat.id, msg.message_id);
    });

    it('blocks inline keyboard buttons for restricted newcomers', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({
            text: 'claim now',
            reply_markup: {
                inline_keyboard: [[{ text: 'Open', url: 'https://spam.example' }]],
            },
        });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).toHaveBeenCalledWith(msg.chat.id, msg.message_id);
    });

    it('trusted users can post links even if they are newly joined', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({ text: 'https://x.com/alitayin/status/1' });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());
        await markUserTrusted(msg.from.id, 'test');

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).not.toHaveBeenCalled();
    });

    it('does not apply newcomer link restrictions when join time is unknown or expired', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({ text: 'https://x.com/random_user/status/99' });

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).not.toHaveBeenCalled();
    });

    it('allows statically whitelisted links for restricted newcomers', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({ text: 'https://e.cash/build' });
        await recordNewcomerJoin(msg.chat.id, msg.from.id, Date.now());

        await processGroupMessage(msg, bot, ports);

        expect(bot.deleteMessage).not.toHaveBeenCalled();
    });

    it('keeps existing blacklisted channel quote behavior', async () => {
        const bot = createBot();
        const ports = createPorts();
        const msg = createMessage({
            text: 'look',
            external_reply: {
                origin: {
                    type: 'channel',
                    chat: { username: 'Insider_SOL_Trades', title: 'Insider SOL Trades' },
                },
                text: 'spam content',
            },
        });

        await processGroupMessage(msg, bot, ports);

        expect(bot.forwardMessage).toHaveBeenCalledWith(expect.anything(), msg.chat.id, msg.message_id);
        expect(bot.banChatMember).toHaveBeenCalledWith(msg.chat.id, msg.from.id);
    });
});
