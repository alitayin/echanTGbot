import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

vi.mock('axios');

const axios = require('axios');
const { GithubVersionChecker, isRemoteNewer } = require('../../../src/application/services/githubVersionChecker.js');

// ---------------------------------------------------------------------------
// isRemoteNewer — pure version comparison
// ---------------------------------------------------------------------------

describe('isRemoteNewer', () => {
    it('returns true when remote major is higher', () => {
        expect(isRemoteNewer('1.0.0', '2.0.0')).toBe(true);
    });

    it('returns true when remote minor is higher (same major)', () => {
        expect(isRemoteNewer('1.2.0', '1.3.0')).toBe(true);
    });

    it('returns true when remote patch is higher (same major.minor)', () => {
        expect(isRemoteNewer('1.2.3', '1.2.4')).toBe(true);
    });

    it('returns false when versions are equal', () => {
        expect(isRemoteNewer('2.8.3', '2.8.3')).toBe(false);
    });

    it('returns false when remote is older (major)', () => {
        expect(isRemoteNewer('3.0.0', '2.9.9')).toBe(false);
    });

    it('returns false when remote is older (minor)', () => {
        expect(isRemoteNewer('1.5.0', '1.4.9')).toBe(false);
    });

    it('returns false when remote is older (patch)', () => {
        expect(isRemoteNewer('1.2.5', '1.2.4')).toBe(false);
    });

    it('handles missing patch segment gracefully', () => {
        expect(isRemoteNewer('1.0', '1.1')).toBe(true);
        expect(isRemoteNewer('1.1', '1.0')).toBe(false);
    });

    it('handles completely missing version string', () => {
        expect(isRemoteNewer('0.0.0', '0.0.1')).toBe(true);
        expect(isRemoteNewer(undefined, '1.0.0')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// GithubVersionChecker.check()
// ---------------------------------------------------------------------------

describe('GithubVersionChecker.check()', () => {
    let bot;
    let checker;

    beforeEach(() => {
        bot = { sendMessage: vi.fn().mockResolvedValue({}) };
        checker = new GithubVersionChecker(bot);
        vi.clearAllMocks();
    });

    afterEach(() => {
        checker.stop();
    });

    it('sends a notification when remote version is newer', async () => {
        axios.get = vi.fn().mockResolvedValue({ data: { version: '99.0.0' } });

        await checker.check();

        expect(bot.sendMessage).toHaveBeenCalledOnce();
        const [, message] = bot.sendMessage.mock.calls[0];
        expect(message).toContain('v99.0.0');
        expect(message).toContain('github.com/alitayin/echanTGbot');
    });

    it('does NOT send a notification when remote version equals local', async () => {
        const localVersion = require('../../../package.json').version;
        axios.get = vi.fn().mockResolvedValue({ data: { version: localVersion } });

        await checker.check();

        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    it('does NOT send a notification when remote version is older', async () => {
        axios.get = vi.fn().mockResolvedValue({ data: { version: '0.0.1' } });

        await checker.check();

        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    it('does NOT send duplicate notifications for the same new version', async () => {
        axios.get = vi.fn().mockResolvedValue({ data: { version: '99.0.0' } });

        await checker.check();
        await checker.check();

        // Only notified once even though check ran twice
        expect(bot.sendMessage).toHaveBeenCalledOnce();
    });

    it('sends again if remote version bumps to an even newer release', async () => {
        axios.get = vi.fn()
            .mockResolvedValueOnce({ data: { version: '99.0.0' } })
            .mockResolvedValueOnce({ data: { version: '100.0.0' } });

        await checker.check();
        await checker.check();

        expect(bot.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('handles network errors without throwing', async () => {
        axios.get = vi.fn().mockRejectedValue(new Error('network failure'));

        // Should resolve without throwing
        await expect(checker.check()).resolves.toBeUndefined();
        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    it('handles malformed remote response without throwing', async () => {
        axios.get = vi.fn().mockResolvedValue({ data: {} });

        await expect(checker.check()).resolves.toBeUndefined();
        expect(bot.sendMessage).not.toHaveBeenCalled();
    });

    it('handles null response data without throwing', async () => {
        axios.get = vi.fn().mockResolvedValue({ data: null });

        await expect(checker.check()).resolves.toBeUndefined();
        expect(bot.sendMessage).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// GithubVersionChecker.start() / stop()
// ---------------------------------------------------------------------------

describe('GithubVersionChecker lifecycle', () => {
    it('start() calls check() immediately', async () => {
        const bot = { sendMessage: vi.fn() };
        const checker = new GithubVersionChecker(bot);
        const checkSpy = vi.spyOn(checker, 'check').mockResolvedValue();

        checker.start();
        expect(checkSpy).toHaveBeenCalledOnce();
        checker.stop();
    });

    it('stop() clears the interval so no further calls happen', async () => {
        vi.useFakeTimers();
        const bot = { sendMessage: vi.fn() };
        const checker = new GithubVersionChecker(bot);
        const checkSpy = vi.spyOn(checker, 'check').mockResolvedValue();

        checker.start();
        checker.stop();

        vi.advanceTimersByTime(10 * 60 * 60 * 1000); // advance 10 hours
        // Should only have the initial call, not any interval calls
        expect(checkSpy).toHaveBeenCalledOnce();
        vi.useRealTimers();
    });

    it('calling start() twice does not create duplicate intervals', async () => {
        const bot = { sendMessage: vi.fn() };
        const checker = new GithubVersionChecker(bot);
        vi.spyOn(checker, 'check').mockResolvedValue();

        checker.start();
        const intervalIdBefore = checker.intervalId;
        checker.start(); // second call should be a no-op
        const intervalIdAfter = checker.intervalId;

        expect(intervalIdBefore).toBe(intervalIdAfter);
        checker.stop();
    });
});
