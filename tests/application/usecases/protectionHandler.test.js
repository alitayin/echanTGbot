import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    handleDisableProtection,
    handleEnableProtection,
} from '../../../src/application/usecases/protectionHandler.js';

const msg = {
    chat: { id: 1, type: 'private' },
    from: { id: 42, username: 'admin' },
};
const bot = {};
let dependencies;

beforeEach(() => {
    dependencies = {
        getMissingProtectionConfig: vi.fn(() => []),
        getProtectionState: vi.fn().mockResolvedValue({ enabled: false }),
        setProtectionEnabled: vi.fn().mockResolvedValue({ enabled: true }),
        sendPromptMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
    };
});

describe('protectionHandler', () => {
    it('enables protection after validating configuration', async () => {
        expect(await handleEnableProtection(msg, bot, dependencies)).toBe(true);
        expect(dependencies.setProtectionEnabled).toHaveBeenCalledWith(true, 'admin');
    });

    it('refuses to enable protection when protection config is incomplete', async () => {
        dependencies.getMissingProtectionConfig.mockReturnValue(['SECONDARY_SPAM_API_KEY']);

        expect(await handleEnableProtection(msg, bot, dependencies)).toBe(false);
        expect(dependencies.setProtectionEnabled).not.toHaveBeenCalled();
        expect(dependencies.sendPromptMessage).toHaveBeenCalledWith(
            bot,
            1,
            expect.stringContaining('SECONDARY_SPAM_API_KEY'),
            { disableAutoDelete: true }
        );
    });

    it('disables protection persistently', async () => {
        dependencies.getProtectionState.mockResolvedValue({ enabled: true });

        expect(await handleDisableProtection(msg, bot, dependencies)).toBe(true);
        expect(dependencies.setProtectionEnabled).toHaveBeenCalledWith(false, 'admin');
    });
});
