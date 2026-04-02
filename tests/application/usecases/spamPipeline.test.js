/**
 * Comprehensive spam detection pipeline tests.
 *
 * Uses ESM imports so vi.mock factories are hoisted before module loading
 * and can intercept the internal require() calls inside spamHandler.js.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — hoisted before any import resolves
// ---------------------------------------------------------------------------

vi.mock('../../../src/infrastructure/ai/messageAnalysis.js', () => ({
    fetchMessageAnalysis: vi.fn(),
    fetchMessageAnalysisWithImage: vi.fn(),
}));

vi.mock('../../../src/infrastructure/ai/secondarySpamCheck.js', () => ({
    performSecondarySpamCheck: vi.fn(),
}));

vi.mock('../../../src/infrastructure/ai/translation.js', () => ({
    translateToEnglishIfTargetGroup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/infrastructure/storage/normalMessageTracker.js', () => ({
    isUserTrustedInGroup: vi.fn().mockResolvedValue(false),
    recordNormalMessageInGroup: vi.fn().mockResolvedValue(undefined),
    resetNormalMessageStreakInGroup: vi.fn().mockResolvedValue(undefined),
    NORMAL_STREAK_THRESHOLD: 3,
}));

vi.mock('../../../src/infrastructure/storage/whitelistKeywordStore.js', () => ({
    containsWhitelistKeyword: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../src/infrastructure/storage/spamMessageCache.js', () => ({
    isSimilarToSpam: vi.fn().mockReturnValue(false),
    addSpamMessage: vi.fn(),
}));

vi.mock('../../../src/infrastructure/storage/spamImageStore.js', () => ({
    isSpamImage: vi.fn().mockResolvedValue(false),
    addSpamImage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../src/infrastructure/storage/spamUserStore.js', () => ({
    updateSpamRecord: vi.fn().mockReturnValue({ count: 1 }),
}));

vi.mock('../../../src/infrastructure/telegram/adminActions.js', () => ({
    kickUser: vi.fn().mockResolvedValue(true),
    unbanUser: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    forwardMessage: vi.fn().mockResolvedValue(undefined),
    getIsAdmin: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../../src/infrastructure/telegram/mediaHelper.js', () => ({
    getImageUrls: vi.fn().mockResolvedValue([]),
    hasImageMedia: vi.fn().mockReturnValue(false),
    getImageFileId: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/application/usecases/spamModerationHandler.js', () => ({
    buildSpamModerationButtons: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/domain/utils/languageDetect.js', () => ({
    detectNonEnglish: vi.fn().mockReturnValue({ shouldCheckWithApi: false }),
}));

// ---------------------------------------------------------------------------
// ESM imports — resolved after mocks are applied
// ---------------------------------------------------------------------------

import { buildCombinedAnalysisQuery } from '../../../src/application/usecases/spamHandler.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMsg(text, overrides = {}) {
    return {
        message_id: 1,
        chat: { id: -100, type: 'supergroup', title: 'Test Group' },
        from: { id: 1001, username: 'alice', first_name: 'Alice', last_name: '', is_bot: false },
        text,
        date: Math.floor(Date.now() / 1000),
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// reply_to_message spam extraction (task 2)
// ---------------------------------------------------------------------------

describe('processGroupMessage — reply_to_message spam content', () => {
    it('buildCombinedAnalysisQuery includes reply_to_message content', () => {
        const msg = makeMsg('hi', {
            reply_to_message: {
                text: 'WIN FREE CRYPTO NOW LIMITED OFFER',
                from: { username: 'scam_bot', id: 777 },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Replying to @scam_bot]');
        expect(query).toContain('WIN FREE CRYPTO NOW');
    });

    it('buildCombinedAnalysisQuery keeps own text together with reply_to_message spam text', () => {
        const msg = makeMsg('hi', {
            reply_to_message: {
                text: 'WIN FREE CRYPTO! Send 0.1 ETH get 1 ETH back!',
                from: { username: 'pump_bot', id: 888 },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('hi');
        expect(query).toContain('WIN FREE CRYPTO');
    });
});

// ---------------------------------------------------------------------------
// external_reply spam extraction (task 2)
// ---------------------------------------------------------------------------

describe('processGroupMessage — external_reply spam content', () => {
    it('buildCombinedAnalysisQuery includes external_reply content', () => {
        const msg = makeMsg('check this', {
            external_reply: {
                origin: { chat: { title: 'Crypto Insider Channel' } },
                text: 'Exclusive alpha: buy now before it pumps 1000x',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[External quote from "Crypto Insider Channel"]');
        expect(query).toContain('Exclusive alpha');
    });

    it('buildCombinedAnalysisQuery keeps innocent user text together with external spam text', () => {
        const msg = makeMsg('看看这个', {
            external_reply: {
                origin: { chat: { title: 'Pump Signal Channel' } },
                text: 'Buy XYZ token now! 100x guaranteed, limited spots!',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('看看这个');
        expect(query).toContain('100x guaranteed');
    });

    it('includes channel name even when external_reply has no text body', () => {
        const msg = makeMsg('yo', {
            external_reply: {
                origin: { chat: { title: 'Shady Investment Group' } },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[External quote from "Shady Investment Group"]');
    });
});

// ---------------------------------------------------------------------------
// Channel sender spam
// ---------------------------------------------------------------------------

describe('processGroupMessage — channel sender spam', () => {
    it('buildCombinedAnalysisQuery includes channel sender metadata', () => {
        const msg = {
            message_id: 2,
            chat: { id: -100, type: 'supergroup', title: 'Test Group' },
            sender_chat: { id: -999, type: 'channel', title: 'Spam Channel', username: 'spamchan' },
            text: 'Channel spam message',
            date: Math.floor(Date.now() / 1000),
        };
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Channel]: Spam Channel');
        expect(query).toContain('Channel spam message');
    });
});

// ---------------------------------------------------------------------------
// buildCombinedAnalysisQuery — edge cases
// ---------------------------------------------------------------------------

describe('buildCombinedAnalysisQuery — edge cases', () => {
    it('returns a string for message with no text, caption, or image', () => {
        const result = buildCombinedAnalysisQuery({ from: { first_name: 'X', last_name: '' } });
        expect(typeof result).toBe('string');
    });

    it('does not include reply_to_message when text is whitespace only', () => {
        const msg = {
            text: 'hello',
            reply_to_message: { text: '   ', from: { username: 'x' } },
            from: { first_name: 'Y', last_name: '' },
        };
        expect(buildCombinedAnalysisQuery(msg)).not.toContain('[Replying to');
    });

    it('extracts external_reply caption as text fallback', () => {
        const msg = {
            text: 'fwd',
            external_reply: {
                origin: { chat: { title: 'Chan' } },
                caption: 'caption only content',
            },
            from: { first_name: 'Z', last_name: '' },
        };
        expect(buildCombinedAnalysisQuery(msg)).toContain('caption only content');
    });

    it('combines reply_to_message + external_reply + own text', () => {
        const msg = {
            text: 'hi',
            reply_to_message: {
                text: 'spam from reply',
                from: { username: 'user_a' },
            },
            external_reply: {
                origin: { chat: { title: 'Ext Channel' } },
                text: 'spam from external',
            },
            from: { first_name: 'Fred', last_name: '' },
        };
        const result = buildCombinedAnalysisQuery(msg);
        expect(result).toContain('hi');
        expect(result).toContain('spam from reply');
        expect(result).toContain('spam from external');
        expect(result).toContain('[Replying to @user_a]');
        expect(result).toContain('[External quote from "Ext Channel"]');
    });
});
