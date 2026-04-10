import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const store = require('../../../src/infrastructure/storage/whitelistKeywordStore.js');
const handler = require('../../../src/application/usecases/whitelistHandler.js');

const {
    handleWhitelistingCommand,
    handleListWhitelistCommand,
    handleRemoveWhitelistCommand,
    handleWhitelistCallback,
} = handler;

function makeBot() {
    return {
        sendMessage: jestLikeFn(async () => ({ message_id: 1 })),
        editMessageText: jestLikeFn(async () => ({})),
        answerCallbackQuery: jestLikeFn(async () => ({})),
    };
}

function jestLikeFn(impl) {
    const calls = [];
    const fn = async (...args) => {
        calls.push(args);
        return impl(...args);
    };
    fn.calls = calls;
    return fn;
}

function makeMsg(text, overrides = {}) {
    return {
        text,
        chat: { id: -100, title: 'Test Group' },
        from: { id: 1, username: 'admin' },
        message_id: 1,
        ...overrides,
    };
}

function calledWith(fn, ...expected) {
    return fn.calls.some(args => expected.every((matcher, index) => matcher(args[index])));
}

describe('whitelistHandler', () => {
    it('sends usage hint when no keyword provided', async () => {
        const bot = makeBot();
        await handleWhitelistingCommand(makeMsg('/whitelisting'), bot);
        expect(calledWith(bot.sendMessage, value => value === -100, value => String(value).includes('Usage'))).toBe(true);
    });

    it('sends confirmation when keyword provided', async () => {
        const bot = makeBot();
        await handleWhitelistingCommand(makeMsg('/whitelisting ecash'), bot);
        expect(calledWith(bot.sendMessage, value => value === -100, value => String(value).includes('ecash'))).toBe(true);
        expect(calledWith(bot.sendMessage, () => true, value => String(value).includes('Whitelist Keyword Request'))).toBe(true);
    });

    it('handles multi-word keywords', async () => {
        const bot = makeBot();
        await handleWhitelistingCommand(makeMsg('/whitelisting buy xec now'), bot);
        expect(calledWith(bot.sendMessage, value => value === -100, value => String(value).includes('buy xec now'))).toBe(true);
    });

    it('approves whitelist callback', async () => {
        const bot = makeBot();
        const before = await store.getAllWhitelistKeywords();
        const query = {
            id: 'q1',
            message: { chat: { id: -999 }, message_id: 10, text: 'req' },
            data: 'whitelist_approve:ecash:admin',
            from: { username: 'superadmin' },
        };
        await handleWhitelistCallback(query, bot);
        const after = await store.getAllWhitelistKeywords();
        expect(after.some(entry => entry.keyword === 'ecash' && entry.addedBy === 'admin')).toBe(true);
        expect(bot.editMessageText.calls.length).toBeGreaterThan(0);
        expect(calledWith(bot.answerCallbackQuery, value => value === 'q1')).toBe(true);
        await store.removeWhitelistKeyword('ecash');
        for (const entry of before) {
            if (entry.keyword === 'ecash') {
                await store.addWhitelistKeyword(entry.keyword, entry.addedBy);
            }
        }
    });

    it('rejects whitelist callback', async () => {
        const bot = makeBot();
        const query = {
            id: 'q3',
            message: { chat: { id: -999 }, message_id: 10, text: 'req' },
            data: 'whitelist_reject:ecash:admin',
            from: { username: 'superadmin' },
        };
        await handleWhitelistCallback(query, bot);
        expect(bot.editMessageText.calls.length).toBeGreaterThan(0);
        expect(calledWith(bot.answerCallbackQuery, value => value === 'q3')).toBe(true);
    });

    it('shows an empty or populated whitelist response deterministically', async () => {
        const bot = makeBot();
        await handleListWhitelistCommand(makeMsg('/listwhitelist'), bot);
        expect(bot.sendMessage.calls.length).toBeGreaterThan(0);
        const text = String(bot.sendMessage.calls[0][1]);
        expect(text.includes('Whitelisted Keywords') || text.includes('No whitelisted keywords found.')).toBe(true);
    });

    it('shows remove usage when no keyword provided', async () => {
        const bot = makeBot();
        await handleRemoveWhitelistCommand(makeMsg('/removewhitelist'), bot);
        expect(calledWith(bot.sendMessage, value => value === -100, value => String(value).includes('Usage'))).toBe(true);
    });

    it('removes whitelist keyword', async () => {
        await store.addWhitelistKeyword('ecash', 'admin');
        const bot = makeBot();
        await handleRemoveWhitelistCommand(makeMsg('/removewhitelist ecash'), bot);
        expect(await store.isWhitelistKeyword('ecash')).toBe(false);
        expect(calledWith(bot.sendMessage, value => value === -100, value => /ecash/i.test(String(value)))).toBe(true);
    });
});
