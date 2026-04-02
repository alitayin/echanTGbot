/**
 * Command router - handles command registration and execution with middleware support
 */
class CommandRouter {
    constructor() {
        this.commands = new Map();
        this.globalMiddleware = [];
    }

    /**
     * Register global middleware that runs for all commands
     */
    use(middleware) {
        this.globalMiddleware.push(middleware);
    }

    /**
     * Register a command handler
     */
    command(pattern, ...handlers) {
        const middleware = handlers.slice(0, -1);
        const handler = handlers[handlers.length - 1];

        this.commands.set(pattern, {
            pattern,
            middleware,
            handler
        });
    }

    /**
     * Execute middleware chain
     */
    async executeMiddleware(middlewareList, msg, bot, finalHandler) {
        let index = 0;

        const next = async () => {
            if (index >= middlewareList.length) {
                return finalHandler(msg, bot);
            }

            const middleware = middlewareList[index++];
            return middleware(msg, bot, next);
        };

        return next();
    }

    /**
     * Match and execute command
     */
    async handleMessage(msg, bot) {
        if (!msg.text) return false;

        const text = msg.text.trim();

        for (const [pattern, config] of this.commands) {
            let matched = false;
            let extractedParams = null;

            // String pattern - exact match or startsWith
            if (typeof pattern === 'string') {
                if (pattern.includes('*')) {
                    // Wildcard pattern like "/command*"
                    const prefix = pattern.replace('*', '');
                    matched = text.toLowerCase().startsWith(prefix.toLowerCase());
                } else {
                    matched = text.toLowerCase() === pattern.toLowerCase();
                }
            }
            // RegExp pattern
            else if (pattern instanceof RegExp) {
                const match = text.match(pattern);
                if (match) {
                    matched = true;
                    extractedParams = match;
                }
            }
            // Function pattern
            else if (typeof pattern === 'function') {
                matched = pattern(msg);
            }

            if (matched) {
                const allMiddleware = [...this.globalMiddleware, ...config.middleware];

                try {
                    await this.executeMiddleware(allMiddleware, msg, bot, async (msg, bot) => {
                        return config.handler(msg, bot, extractedParams);
                    });
                    return true;
                } catch (error) {
                    console.error(`Command handler error for pattern ${pattern}:`, error);
                    throw error;
                }
            }
        }

        return false;
    }
}

module.exports = { CommandRouter };
