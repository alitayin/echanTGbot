/**
 * Comprehensive spam detection tests covering various spam patterns
 * Tests forwarded messages, channel posts, external replies, and combinations
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/infrastructure/ai/messageAnalysis.js', () => ({
    fetchMessageAnalysis: vi.fn(),
    fetchMessageAnalysisWithImage: vi.fn(),
}));

vi.mock('../../../src/infrastructure/telegram/mediaHelper.js', () => ({
    getImageUrls: vi.fn().mockResolvedValue([]),
    hasImageMedia: vi.fn().mockReturnValue(false),
    getImageFileId: vi.fn().mockReturnValue(null),
}));

vi.mock('../../../src/domain/utils/messageContext.js', () => ({
    extractReplyMarkupSummary: vi.fn().mockReturnValue([]),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { buildCombinedAnalysisQuery } from '../../../src/application/usecases/spamHandler.js';

// ---------------------------------------------------------------------------
// Test helpers
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
// Forwarded message spam patterns
// ---------------------------------------------------------------------------

describe('Spam Detection - Forwarded Messages', () => {
    it('detects spam forwarded from user', () => {
        const msg = makeMsg('🔥 WIN FREE CRYPTO! Click here now!', {
            forward_from: { id: 999, username: 'scammer', first_name: 'Scammer' },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Forwarded from @scammer]');
        expect(query).toContain('WIN FREE CRYPTO');
    });

    it('detects spam forwarded from channel', () => {
        const msg = makeMsg('💰 Exclusive investment opportunity! 1000x returns guaranteed!', {
            forward_from_chat: { id: -1001234567890, type: 'channel', title: 'Pump Signals' },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Forwarded from Pump Signals]');
        expect(query).toContain('1000x returns guaranteed');
    });

    it('detects spam forwarded from hidden user', () => {
        const msg = makeMsg('Send 1 ETH get 10 ETH back!', {
            forward_sender_name: 'Anonymous Whale',
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Forwarded from Anonymous Whale]');
        expect(query).toContain('Send 1 ETH');
    });

    it('detects forwarded message with caption instead of text', () => {
        const msg = makeMsg('', {
            caption: '🚀 Join our pump group! Limited spots!',
            forward_from: { id: 888, username: 'pump_admin' },
            photo: [{ file_id: 'photo123' }],
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Forwarded from @pump_admin]');
        expect(query).toContain('pump group');
    });
});

// ---------------------------------------------------------------------------
// Channel sender spam patterns
// ---------------------------------------------------------------------------

describe('Spam Detection - Channel Senders', () => {
    it('detects spam from channel posted to group', () => {
        const msg = {
            message_id: 2,
            chat: { id: -100, type: 'supergroup', title: 'Test Group' },
            sender_chat: { id: -999, type: 'channel', title: 'Crypto Scam Channel', username: 'scamchannel' },
            text: '💎 Buy our token now! Presale ending soon!',
            date: Math.floor(Date.now() / 1000),
        };
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Channel]: Crypto Scam Channel');
        expect(query).toContain('Buy our token now');
    });

    it('detects channel with username only', () => {
        const msg = {
            message_id: 3,
            chat: { id: -100, type: 'supergroup', title: 'Test Group' },
            sender_chat: { id: -888, type: 'channel', username: 'spambot' },
            text: 'Click link for free money',
            date: Math.floor(Date.now() / 1000),
        };
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Channel]: spambot');
    });
});

// ---------------------------------------------------------------------------
// External reply spam patterns (quoting from other channels)
// ---------------------------------------------------------------------------

describe('Spam Detection - External Replies', () => {
    it('detects spam when user quotes external channel message', () => {
        const msg = makeMsg('Check this out', {
            external_reply: {
                origin: {
                    type: 'channel',
                    chat: { title: 'Insider Trading Signals', username: 'insidertrades' }
                },
                text: '🔥 SOL SPIN is here! First Spin free! You can win SOL tokens, exclusive rewards, special bonuses',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[External quote from "Insider Trading Signals"]');
        expect(query).toContain('SOL SPIN');
        expect(query).toContain('Check this out');
    });

    it('detects external reply with caption instead of text', () => {
        const msg = makeMsg('看看这个', {
            external_reply: {
                origin: { chat: { title: 'Pump Channel' } },
                caption: 'Buy XYZ token! 100x guaranteed!',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[External quote from "Pump Channel"]');
        expect(query).toContain('100x guaranteed');
    });

    it('detects external reply with only channel name (no text)', () => {
        const msg = makeMsg('interesting', {
            external_reply: {
                origin: { chat: { title: 'Suspicious Investment Group' } },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[External quote from "Suspicious Investment Group"]');
    });

    it('detects external reply from user (not channel)', () => {
        const msg = makeMsg('lol', {
            external_reply: {
                origin: { sender_user_name: 'crypto_whale_2024' },
                text: 'Send me crypto and I will double it',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('Send me crypto');
    });
});

// ---------------------------------------------------------------------------
// Reply to message spam patterns
// ---------------------------------------------------------------------------

describe('Spam Detection - Reply to Message', () => {
    it('detects spam in replied message', () => {
        const msg = makeMsg('Is this legit?', {
            reply_to_message: {
                text: '💰 AIRDROP ALERT! Claim 1000 USDT now! Limited time!',
                from: { username: 'airdrop_bot', id: 777 },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Replying to @airdrop_bot]');
        expect(query).toContain('AIRDROP ALERT');
        expect(query).toContain('Is this legit');
    });

    it('detects spam in replied message with caption', () => {
        const msg = makeMsg('what is this', {
            reply_to_message: {
                caption: 'Join our Telegram for free signals!',
                from: { username: 'signal_provider' },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Replying to @signal_provider]');
        expect(query).toContain('free signals');
    });

    it('handles reply to forwarded message', () => {
        const msg = makeMsg('scam?', {
            reply_to_message: {
                text: 'Double your Bitcoin in 24 hours!',
                forward_sender_name: 'Bitcoin Doubler',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Replying to @Bitcoin Doubler]');
        expect(query).toContain('Double your Bitcoin');
    });
});

// ---------------------------------------------------------------------------
// Combined spam patterns (multiple vectors)
// ---------------------------------------------------------------------------

describe('Spam Detection - Combined Patterns', () => {
    it('detects spam with both reply_to_message and external_reply', () => {
        const msg = makeMsg('wow', {
            reply_to_message: {
                text: 'First spam vector',
                from: { username: 'user1' },
            },
            external_reply: {
                origin: { chat: { title: 'Spam Channel' } },
                text: 'Second spam vector',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Replying to @user1]');
        expect(query).toContain('First spam vector');
        expect(query).toContain('[External quote from "Spam Channel"]');
        expect(query).toContain('Second spam vector');
        expect(query).toContain('wow');
    });

    it('detects forwarded message with external reply', () => {
        const msg = makeMsg('Check this opportunity', {
            forward_from: { username: 'promoter' },
            external_reply: {
                origin: { chat: { title: 'Investment Scam' } },
                text: 'Guaranteed returns! No risk!',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Forwarded from @promoter]');
        expect(query).toContain('[External quote from "Investment Scam"]');
        expect(query).toContain('Guaranteed returns');
    });

    it('detects channel sender with external reply', () => {
        const msg = {
            message_id: 5,
            chat: { id: -100, type: 'supergroup' },
            sender_chat: { id: -777, type: 'channel', title: 'Promo Channel' },
            text: 'Amazing deal',
            external_reply: {
                origin: { chat: { title: 'Partner Scam' } },
                text: 'Limited offer! Act now!',
            },
            date: Math.floor(Date.now() / 1000),
        };
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Channel]: Promo Channel');
        expect(query).toContain('[External quote from "Partner Scam"]');
        expect(query).toContain('Limited offer');
    });
});

// ---------------------------------------------------------------------------
// Long username spam patterns
// ---------------------------------------------------------------------------

describe('Spam Detection - Long Usernames', () => {
    it('detects spam from user with very long name', () => {
        const msg = makeMsg('Hi', {
            from: {
                id: 1234,
                first_name: 'BUY_CRYPTO_NOW_BEST_PRICES_GUARANTEED_CONTACT_ME',
                last_name: '',
                username: 'spammer',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Sender Name]: BUY_CRYPTO_NOW_BEST_PRICES_GUARANTEED_CONTACT_ME');
    });

    it('detects spam from user with long first + last name', () => {
        const msg = makeMsg('Hello', {
            from: {
                id: 5678,
                first_name: 'CRYPTO_INVESTMENT_EXPERT',
                last_name: 'GUARANTEED_PROFITS_DM_ME',
                username: 'user',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Sender Name]: CRYPTO_INVESTMENT_EXPERT GUARANTEED_PROFITS_DM_ME');
    });
});

// ---------------------------------------------------------------------------
// Other spam vectors
// ---------------------------------------------------------------------------

describe('Spam Detection - Other Vectors', () => {
    it('detects contact sharing spam', () => {
        const msg = makeMsg('', {
            contact: {
                first_name: 'Crypto',
                last_name: 'Expert',
                phone_number: '+1234567890',
                user_id: 9999,
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Contact]: Crypto Expert +1234567890 uid:9999');
    });

    it('detects poll spam', () => {
        const msg = makeMsg('', {
            poll: {
                question: 'Want to earn 1000 USDT daily? Vote yes!',
                options: [
                    { text: 'Yes, send me the link!' },
                    { text: 'No thanks' },
                ],
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Poll]: Want to earn 1000 USDT daily');
        expect(query).toContain('[Poll Options]: Yes, send me the link! | No thanks');
    });

    it('detects location spam', () => {
        const msg = makeMsg('Meet here for crypto exchange', {
            location: {
                latitude: 40.7128,
                longitude: -74.0060,
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Location]: 40.7128, -74.006');
        expect(query).toContain('Meet here for crypto exchange');
    });

    it('detects venue spam', () => {
        const msg = makeMsg('Crypto meetup', {
            venue: {
                title: 'Secret Investment Meeting',
                address: '123 Scam Street',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Venue]: Secret Investment Meeting - 123 Scam Street');
    });
});

// ---------------------------------------------------------------------------
// Real-world spam examples
// ---------------------------------------------------------------------------

describe('Spam Detection - Real World Examples', () => {
    it('detects SOL SPIN bot spam pattern', () => {
        const msg = makeMsg('', {
            external_reply: {
                origin: {
                    type: 'channel',
                    chat: { title: 'SOL Promotions', username: 'solpromos' }
                },
                text: '🔥SOL SPIN is here!\n\n🤯First Spin free!\n\n⚡️You can win:\n⚫️ SOL tokens\n⚫️ Exclusive rewards\n⚫️ Special bonuses\n\n🔗@getsolspinbot',
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('SOL SPIN');
        expect(query).toContain('getsolspinbot');
        expect(query).toContain('[External quote from "SOL Promotions"]');
    });

    it('detects airdrop scam pattern', () => {
        const msg = makeMsg('Free money!', {
            forward_from_chat: { title: 'Official Airdrop Channel', type: 'channel' },
            text: '🎁 CLAIM YOUR AIRDROP NOW!\n\n✅ 1000 USDT for first 100 users\n✅ No KYC required\n✅ Instant withdrawal\n\n👉 Click: https://scam-site.com',
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Forwarded from Official Airdrop Channel]');
        expect(query).toContain('CLAIM YOUR AIRDROP');
        expect(query).toContain('scam-site.com');
    });

    it('detects pump and dump signal pattern', () => {
        const msg = makeMsg('🚀🚀🚀', {
            reply_to_message: {
                text: '📊 SIGNAL ALERT 📊\n\nCoin: XYZ\nEntry: NOW\nTarget: 1000%\nStop Loss: None\n\n⚡️ BUY NOW BEFORE PUMP! ⚡️',
                from: { username: 'pump_signals_vip' },
            },
        });
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Replying to @pump_signals_vip]');
        expect(query).toContain('SIGNAL ALERT');
        expect(query).toContain('Target: 1000%');
    });

    it('detects investment scam with testimonial', () => {
        const msg = {
            message_id: 10,
            chat: { id: -100, type: 'supergroup' },
            sender_chat: { id: -555, type: 'channel', title: 'Investment Guru' },
            text: '💰 I made $50,000 in one week!\n\n✅ Proven strategy\n✅ 100% success rate\n✅ DM me to learn how\n\n⚠️ Limited spots available!',
            date: Math.floor(Date.now() / 1000),
        };
        const query = buildCombinedAnalysisQuery(msg);
        expect(query).toContain('[Channel]: Investment Guru');
        expect(query).toContain('$50,000 in one week');
        expect(query).toContain('100% success rate');
    });
});
