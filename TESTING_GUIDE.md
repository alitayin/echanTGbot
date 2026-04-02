# Telegram Bot Testing Best Practices

Based on industry research and professional Telegram bot development standards, here's what we should implement:

## Current Testing Status

✅ **What we have:**
- Unit tests for domain logic (policies, utils, formatting)
- Integration tests for storage layers
- Integration tests for command router
- Application layer tests (handlers, services)

❌ **What we're missing:**

### 1. **Mock Bot Testing**
Professional bots use mock Telegram API to test without real API calls:

```javascript
// Example: Mock bot for testing
class MockTelegramBot {
    constructor() {
        this.sentMessages = [];
        this.editedMessages = [];
        this.deletedMessages = [];
    }

    async sendMessage(chatId, text, options) {
        const msg = { chat: { id: chatId }, text, options, message_id: Date.now() };
        this.sentMessages.push(msg);
        return msg;
    }

    async editMessageText(text, options) {
        this.editedMessages.push({ text, options });
        return true;
    }

    async deleteMessage(chatId, messageId) {
        this.deletedMessages.push({ chatId, messageId });
        return true;
    }

    // Helper to verify bot behavior
    getLastSentMessage() {
        return this.sentMessages[this.sentMessages.length - 1];
    }

    clearHistory() {
        this.sentMessages = [];
        this.editedMessages = [];
        this.deletedMessages = [];
    }
}
```

### 2. **End-to-End Testing with Test Bot**
Create a separate test bot token for E2E testing:

```javascript
// tests/e2e/bot.e2e.test.js
describe('Bot E2E Tests', () => {
    let testBot;
    let testChatId;

    beforeAll(() => {
        testBot = new TelegramBot(process.env.TEST_BOT_TOKEN);
        testChatId = process.env.TEST_CHAT_ID;
    });

    it('should respond to /start command', async () => {
        const response = await testBot.sendMessage(testChatId, '/start');
        // Wait for bot response
        await new Promise(resolve => setTimeout(resolve, 1000));
        // Verify response
    });
});
```

### 3. **Webhook Testing**
Test webhook endpoints locally:

```javascript
// tests/integration/webhook.test.js
describe('Webhook Handler', () => {
    it('should process incoming updates', async () => {
        const mockUpdate = {
            update_id: 123,
            message: {
                message_id: 456,
                from: { id: 789, username: 'testuser' },
                chat: { id: 789, type: 'private' },
                text: '/start'
            }
        };

        const response = await request(app)
            .post('/webhook')
            .send(mockUpdate)
            .expect(200);
    });
});
```

### 4. **Command Handler Testing**
Test individual command handlers in isolation:

```javascript
// tests/unit/commands/price.test.js
describe('Price Command Handler', () => {
    it('should fetch and format price data', async () => {
        const mockMsg = {
            chat: { id: 123 },
            from: { id: 456, username: 'testuser' }
        };
        const mockBot = new MockTelegramBot();

        await handlePrice(mockMsg, mockBot);

        const sentMsg = mockBot.getLastSentMessage();
        expect(sentMsg.text).toContain('eCash (XEC) Price Update');
        expect(sentMsg.text).toMatch(/\$\d+\.\d+/); // Price format
    });
});
```

### 5. **Integration Testing with Real Storage**
Test with actual database operations:

```javascript
// tests/integration/signup.integration.test.js
describe('Signup Flow Integration', () => {
    beforeEach(async () => {
        await clearTestDatabase();
    });

    it('should register user and store address', async () => {
        const mockMsg = {
            text: '/signup ecash:qp123...',
            chat: { id: 123 },
            from: { id: 456, username: 'testuser' }
        };
        const mockBot = new MockTelegramBot();

        await handleSignup(mockMsg, mockBot);

        const user = await getUserAddress(456);
        expect(user.address).toBe('ecash:qp123...');
        expect(mockBot.getLastSentMessage().text).toContain('✅');
    });
});
```

### 6. **Spam Detection Testing**
Test anti-spam logic with various scenarios:

```javascript
// tests/integration/spam.integration.test.js
describe('Spam Detection', () => {
    it('should detect repeated messages as spam', async () => {
        const mockBot = new MockTelegramBot();
        const spamMsg = {
            text: 'Buy crypto now!',
            chat: { id: -100123, type: 'supergroup' },
            from: { id: 789, username: 'spammer' }
        };

        // Send same message 5 times
        for (let i = 0; i < 5; i++) {
            await processGroupMessage({ ...spamMsg, message_id: i }, mockBot, ports);
        }

        // Should trigger spam detection
        expect(mockBot.deletedMessages.length).toBeGreaterThan(0);
    });
});
```

### 7. **Performance Testing**
Test bot performance under load:

```javascript
// tests/performance/load.test.js
describe('Bot Performance', () => {
    it('should handle 100 concurrent requests', async () => {
        const requests = Array(100).fill().map((_, i) => ({
            message: {
                text: '/price',
                chat: { id: i },
                from: { id: i }
            }
        }));

        const start = Date.now();
        await Promise.all(requests.map(req => handleMessage(req)));
        const duration = Date.now() - start;

        expect(duration).toBeLessThan(5000); // Should complete in 5s
    });
});
```

## Recommended Testing Structure

```
tests/
├── unit/                          # Pure function tests
│   ├── domain/                    # Business logic
│   ├── utils/                     # Utilities
│   └── formatting/                # Formatters
├── integration/                   # Component integration
│   ├── commands/                  # Command handlers
│   ├── storage/                   # Database operations
│   └── middleware/                # Middleware chains
├── e2e/                          # End-to-end tests
│   ├── user-flows/               # Complete user journeys
│   └── admin-flows/              # Admin operations
└── performance/                   # Load and stress tests
    └── load.test.js
```

## Testing Tools We Should Add

1. **Mock Telegram Bot** - For unit testing without API calls
2. **Test Bot Token** - Separate bot for E2E testing
3. **Webhook Testing** - Local webhook endpoint testing
4. **Load Testing** - Performance benchmarks
5. **Coverage Reports** - Track test coverage

## Next Steps

1. Create `MockTelegramBot` class
2. Add command handler unit tests
3. Add E2E test suite with test bot
4. Add performance benchmarks
5. Set up CI/CD with automated testing

## Sources

Based on research from:
- [Telegram Bots Testing Documentation](https://rubenlagus.github.io/TelegramBotsDocumentation/bot-testing.html)
- [IgniterJS Testing Guide](https://igniterjs.com/docs/bots/testing)
- [Singapore GDS E2E Testing for Telegram Bots](https://medium.com/singapore-gds/end-to-end-testing-for-telegram-bot-4d6afd85fb55)
- [ElizaOS Telegram Testing Guide](https://docs.elizaos.ai/plugin-registry/platform/telegram/testing-guide)
- [Safe, Testable Command Handling in 2026](https://thelinuxcode.com/nodejs-telegram-bot-ontext-safe-testable-command-handling-in-2026/)
