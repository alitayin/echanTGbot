import { describe, it, expect, vi } from 'vitest';
import { withTimeout } from '../../../src/domain/utils/async.js';

describe('withTimeout', () => {
    it('resolves with task result when task finishes in time', async () => {
        const result = await withTimeout(() => Promise.resolve(42), 1000);
        expect(result).toBe(42);
    });
    it('clears the timer when the task finishes first', async () => {
        vi.useFakeTimers();
        try {
            await expect(withTimeout(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
            expect(vi.getTimerCount()).toBe(0);
        } finally {
            vi.useRealTimers();
        }
    });
    it('accepts a promise directly (not just a function)', async () => {
        const result = await withTimeout(Promise.resolve('ok'), 1000);
        expect(result).toBe('ok');
    });
    it('rejects with default message when task times out', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 500));
        await expect(withTimeout(slow, 10)).rejects.toThrow('Timeout');
    });
    it('rejects with custom message when task times out', async () => {
        const slow = new Promise(resolve => setTimeout(resolve, 500));
        await expect(withTimeout(slow, 10, 'Too slow')).rejects.toThrow('Too slow');
    });
    it('rejects with task error if task throws before timeout', async () => {
        const failing = () => Promise.reject(new Error('task error'));
        await expect(withTimeout(failing, 1000)).rejects.toThrow('task error');
    });
});
