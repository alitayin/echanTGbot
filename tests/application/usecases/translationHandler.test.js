import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    handleTranslateCommand,
    handleTrustedAutoTranslation,
} from '../../../src/application/usecases/translationHandler.js';

let dependencies;

function makeMessage(overrides = {}) {
    return {
        message_id: 10,
        chat: { id: -1001, type: 'supergroup' },
        from: { id: 7, username: 'alice', is_bot: false },
        text: '你好，世界',
        ...overrides,
    };
}

beforeEach(() => {
    dependencies = {
        allowedUsers: ['admin'],
        targetGroupIds: ['-1001'],
        isUserTrusted: vi.fn().mockResolvedValue(false),
        detectNonEnglish: vi.fn(() => ({ shouldCheckWithApi: true })),
        translateToEnglishIfTargetGroup: vi.fn().mockResolvedValue(true),
        translateText: vi.fn().mockResolvedValue('hello'),
        recordTranslationLink: vi.fn().mockResolvedValue(true),
        sendPromptMessage: vi.fn().mockResolvedValue({ message_id: 90 }),
    };
});

describe('trusted translation', () => {
    it('does not auto-translate untrusted users', async () => {
        expect(await handleTrustedAutoTranslation(makeMessage(), {}, dependencies)).toBe(false);
        expect(dependencies.translateToEnglishIfTargetGroup).not.toHaveBeenCalled();
    });

    it('auto-translates trusted non-English messages independently of protection', async () => {
        dependencies.isUserTrusted.mockResolvedValue(true);
        const msg = makeMessage();
        const bot = {};

        expect(await handleTrustedAutoTranslation(msg, bot, dependencies)).toBe(true);
        expect(dependencies.translateToEnglishIfTargetGroup).toHaveBeenCalledWith(msg, bot);
    });

    it('does not auto-translate LLM mentions', async () => {
        dependencies.isUserTrusted.mockResolvedValue(true);
        const msg = makeMessage({ text: '@test_bot 你好' });

        expect(await handleTrustedAutoTranslation(msg, {}, dependencies)).toBe(false);
        expect(dependencies.translateToEnglishIfTargetGroup).not.toHaveBeenCalled();
    });

    it('allows an allowlisted admin to translate a replied message', async () => {
        const msg = makeMessage({
            chat: { id: 7, type: 'private' },
            from: { id: 1, username: 'admin', is_bot: false },
            text: '/translate Spanish',
            reply_to_message: { message_id: 5, text: 'hello' },
        });
        const bot = { sendMessage: vi.fn().mockResolvedValue({ message_id: 30 }) };

        expect(await handleTranslateCommand(msg, bot, dependencies)).toBe(true);
        expect(dependencies.translateText).toHaveBeenCalledWith('hello', 'Spanish', 1);
        expect(bot.sendMessage).toHaveBeenCalledWith(7, '🔄 Translation: hello', {
            reply_to_message_id: 5,
        });
        expect(dependencies.recordTranslationLink).toHaveBeenCalledWith(7, 5, 30);
    });
});
