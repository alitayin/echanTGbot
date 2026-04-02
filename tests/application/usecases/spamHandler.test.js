import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { processGroupMessage, buildCombinedAnalysisQuery } = require('../../../src/application/usecases/spamHandler.js');

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
