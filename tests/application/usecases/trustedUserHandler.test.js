import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    handleTrustUser,
    handleUntrustUser,
    handleTrustStatus,
} from '../../../src/application/usecases/trustedUserHandler.js';

function makeMessage(text) {
    return { text, chat: { id: 1, type: 'private' }, from: { id: 42 } };
}

describe('trusted user commands', () => {
    let bot;
    let dependencies;

    beforeEach(() => {
        vi.clearAllMocks();
        bot = { sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }) };
        dependencies = {
            markUserTrusted: vi.fn(),
            untrustUser: vi.fn(),
            getUserTrustRecord: vi.fn(),
            sendPromptMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
        };
    });

    it('trusts and untrusts a numeric Telegram user ID', async () => {
        await handleTrustUser(makeMessage('/trustuser 12345'), bot, dependencies);
        expect(dependencies.markUserTrusted).toHaveBeenCalledWith('12345', 'admin:42');

        await handleUntrustUser(makeMessage('/untrustuser 12345'), bot, dependencies);
        expect(dependencies.untrustUser).toHaveBeenCalledWith('12345', 'admin:42');
    });

    it('rejects an invalid user ID', async () => {
        await handleTrustUser(makeMessage('/trustuser @alice'), bot, dependencies);
        expect(dependencies.markUserTrusted).not.toHaveBeenCalled();
        expect(dependencies.sendPromptMessage).toHaveBeenCalledWith(bot, 1, expect.stringContaining('Usage:'));
    });

    it('shows the current trust record', async () => {
        dependencies.getUserTrustRecord.mockResolvedValue({ trusted: true, streak: 3 });
        await handleTrustStatus(makeMessage('/truststatus 12345'), bot, dependencies);
        expect(dependencies.sendPromptMessage).toHaveBeenCalledWith(
            bot,
            1,
            'User 12345: trusted (normal streak: 3).'
        );
    });
});
