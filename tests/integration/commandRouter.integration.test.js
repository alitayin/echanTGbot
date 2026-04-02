import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommandRouter } from '../../src/presentation/middleware/commandRouter.js';

describe('CommandRouter Integration', () => {
    let router;
    let mockBot;
    let mockMsg;

    beforeEach(() => {
        router = new CommandRouter();
        mockBot = {
            sendMessage: vi.fn(),
            getChatMember: vi.fn()
        };
        mockMsg = {
            chat: { id: 123, type: 'private' },
            from: { id: 456, username: 'testuser' },
            text: '/test'
        };
    });

    describe('command registration and execution', () => {
        it('should register and execute a simple command', async () => {
            const handler = vi.fn();
            router.command('/test', handler);

            mockMsg.text = '/test';
            const result = await router.handleMessage(mockMsg, mockBot);

            expect(result).toBe(true);
            expect(handler).toHaveBeenCalledWith(mockMsg, mockBot, null);
        });

        it('should execute middleware chain correctly', async () => {
            const executionOrder = [];
            const middleware1 = vi.fn((msg, bot, next) => {
                executionOrder.push('middleware1');
                return next();
            });
            const middleware2 = vi.fn((msg, bot, next) => {
                executionOrder.push('middleware2');
                return next();
            });
            const handler = vi.fn(() => {
                executionOrder.push('handler');
            });

            router.command('/test', middleware1, middleware2, handler);
            mockMsg.text = '/test';
            await router.handleMessage(mockMsg, mockBot);

            expect(executionOrder).toEqual(['middleware1', 'middleware2', 'handler']);
        });

        it('should stop execution if middleware does not call next', async () => {
            const middleware = vi.fn(() => {
                // Does not call next()
            });
            const handler = vi.fn();

            router.command('/test', middleware, handler);
            mockMsg.text = '/test';
            await router.handleMessage(mockMsg, mockBot);

            expect(middleware).toHaveBeenCalled();
            expect(handler).not.toHaveBeenCalled();
        });

        it('should match wildcard patterns', async () => {
            const handler = vi.fn();
            router.command('/test*', handler);

            mockMsg.text = '/test arg1 arg2';
            const result = await router.handleMessage(mockMsg, mockBot);

            expect(result).toBe(true);
            expect(handler).toHaveBeenCalled();
        });

        it('should match regex patterns and extract params', async () => {
            const handler = vi.fn();
            router.command(/^\/test\s+(\w+)/, handler);

            mockMsg.text = '/test hello';
            const result = await router.handleMessage(mockMsg, mockBot);

            expect(result).toBe(true);
            expect(handler).toHaveBeenCalled();
            const params = handler.mock.calls[0][2];
            expect(params[1]).toBe('hello');
        });

        it('should be case insensitive for string patterns', async () => {
            const handler = vi.fn();
            router.command('/test', handler);

            mockMsg.text = '/TEST';
            const result = await router.handleMessage(mockMsg, mockBot);

            expect(result).toBe(true);
            expect(handler).toHaveBeenCalled();
        });

        it('should return false for unmatched commands', async () => {
            const handler = vi.fn();
            router.command('/test', handler);

            mockMsg.text = '/other';
            const result = await router.handleMessage(mockMsg, mockBot);

            expect(result).toBe(false);
            expect(handler).not.toHaveBeenCalled();
        });

        it('should return false for messages without text', async () => {
            const handler = vi.fn();
            router.command('/test', handler);

            mockMsg.text = null;
            const result = await router.handleMessage(mockMsg, mockBot);

            expect(result).toBe(false);
            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('global middleware', () => {
        it('should execute global middleware for all commands', async () => {
            const globalMiddleware = vi.fn((msg, bot, next) => next());
            const handler = vi.fn();

            router.use(globalMiddleware);
            router.command('/test', handler);

            mockMsg.text = '/test';
            await router.handleMessage(mockMsg, mockBot);

            expect(globalMiddleware).toHaveBeenCalled();
            expect(handler).toHaveBeenCalled();
        });

        it('should execute global middleware before command middleware', async () => {
            const executionOrder = [];
            const globalMiddleware = vi.fn((msg, bot, next) => {
                executionOrder.push('global');
                return next();
            });
            const commandMiddleware = vi.fn((msg, bot, next) => {
                executionOrder.push('command');
                return next();
            });
            const handler = vi.fn(() => {
                executionOrder.push('handler');
            });

            router.use(globalMiddleware);
            router.command('/test', commandMiddleware, handler);

            mockMsg.text = '/test';
            await router.handleMessage(mockMsg, mockBot);

            expect(executionOrder).toEqual(['global', 'command', 'handler']);
        });
    });

    describe('error handling', () => {
        it('should catch and rethrow handler errors', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            const handler = vi.fn(() => {
                throw new Error('Handler error');
            });

            router.command('/test', handler);
            mockMsg.text = '/test';

            await expect(router.handleMessage(mockMsg, mockBot)).rejects.toThrow('Handler error');
            expect(consoleError).toHaveBeenCalled();

            consoleError.mockRestore();
        });

        it('should catch and rethrow middleware errors', async () => {
            const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
            const middleware = vi.fn(() => {
                throw new Error('Middleware error');
            });
            const handler = vi.fn();

            router.command('/test', middleware, handler);
            mockMsg.text = '/test';

            await expect(router.handleMessage(mockMsg, mockBot)).rejects.toThrow('Middleware error');
            expect(consoleError).toHaveBeenCalled();
            expect(handler).not.toHaveBeenCalled();

            consoleError.mockRestore();
        });
    });
});
