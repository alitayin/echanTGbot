import { describe, it, expect, vi } from 'vitest';
import { withKeyRotation } from '../../../src/infrastructure/ai/withKeyRotation.js';

const makeClient = (id) => ({ id });

describe('withKeyRotation', () => {
    it('resolves immediately on first success', async () => {
        const clients = [makeClient(1)];
        const fn = vi.fn().mockResolvedValue('ok');
        const result = await withKeyRotation(clients, fn);
        expect(result).toBe('ok');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('throws when clients array is empty', async () => {
        await expect(withKeyRotation([], vi.fn())).rejects.toThrow('clients array must not be empty');
    });

    it('throws when clients is null', async () => {
        await expect(withKeyRotation(null, vi.fn())).rejects.toThrow('clients array must not be empty');
    });

    it('does not retry or rotate on a 400 application error', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const error = { response: { status: 400, data: { code: 'invalid_param', message: 'Bad workflow input' } } };
        const fn = vi.fn().mockRejectedValue(error);

        await expect(withKeyRotation(clients, fn)).rejects.toBe(error);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('rotates to backup key immediately on 401', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn()
            .mockRejectedValueOnce({ response: { status: 401 } })
            .mockResolvedValue('ok from backup');

        await expect(withKeyRotation(clients, fn)).resolves.toBe('ok from backup');
        expect(fn.mock.calls.map(([client]) => client)).toEqual(clients);
    });

    it('retries network errors up to maxRetriesPerKey', async () => {
        const clients = [makeClient(1)];
        const fn = vi.fn()
            .mockRejectedValueOnce({ request: {}, code: 'ECONNRESET', message: 'flaky' })
            .mockRejectedValueOnce({ request: {}, code: 'ECONNRESET', message: 'flaky' })
            .mockResolvedValue('recovered');
        const result = await withKeyRotation(clients, fn, { maxRetriesPerKey: 3 });
        expect(result).toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('retries 429 responses when no backup key exists', async () => {
        const fn = vi.fn()
            .mockRejectedValueOnce({ response: { status: 429 }, message: 'rate limited' })
            .mockResolvedValue('recovered');

        await expect(withKeyRotation([makeClient(1)], fn)).resolves.toBe('recovered');
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('throws after all attempts exhausted', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn().mockRejectedValue({ response: { status: 503 }, message: 'always fails' });
        await expect(
            withKeyRotation(clients, fn, { maxRetriesPerKey: 2, maxTotalAttempts: 4 })
        ).rejects.toThrow('all attempts exhausted');
    });

    it('respects maxTotalAttempts hard cap', async () => {
        const clients = [makeClient(1), makeClient(2)];
        const fn = vi.fn().mockRejectedValue({ response: { status: 503 }, message: 'fail' });
        await expect(
            withKeyRotation(clients, fn, { maxRetriesPerKey: 10, maxTotalAttempts: 3 })
        ).rejects.toThrow('all attempts exhausted');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('logs a sanitized Dify error summary', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = {
            response: {
                status: 400,
                data: {
                    code: 'model_not_found',
                    message: 'Authorization: Bearer secret-token api_key=also-secret',
                },
            },
        };

        await expect(withKeyRotation([makeClient(1)], vi.fn().mockRejectedValue(error))).rejects.toBe(error);
        const logged = JSON.stringify(warn.mock.calls);
        expect(logged).toContain('model_not_found');
        expect(logged).not.toContain('secret-token');
        expect(logged).not.toContain('also-secret');
    });
});
