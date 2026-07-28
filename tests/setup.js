// Test setup file - runs before all tests
import { afterEach, beforeEach, vi } from 'vitest';

const TEST_ENV_DEFAULTS = {
    API_KEY: 'test-api-key',
    API_ENDPOINT: 'https://example.test/v1/chat-messages',
    TELEGRAM_TOKEN: 'test-telegram-token',
    BOT_USERNAME: 'test_bot',
    TARGET_GROUP_IDS: '-1001',
    NOTIFICATION_GROUP_ID: '-2001',
    SPAM_THRESHOLD: '5',
    ADDITIONAL_API_KEY: 'test-analysis-key',
    SECONDARY_SPAM_API_KEY: 'test-secondary-key',
    ALITAYIN_USER_ID: '42',
    ALLOWED_USERS: 'admin',
};

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
    if (!process.env[key]) process.env[key] = value;
}

const LEVEL_TEARDOWN_PATTERNS = [
    'LEVEL_DATABASE_NOT_OPEN',
    'LEVEL_LOCKED',
    'Database is not open',
];

function isIgnorableLevelTeardownError(reason) {
    const reasonStr = String(reason);
    return LEVEL_TEARDOWN_PATTERNS.some(pattern => reasonStr.includes(pattern));
}

process.on('unhandledRejection', (reason) => {
    // Ignore LevelDB cleanup errors - they're harmless race conditions in test teardown
    if (isIgnorableLevelTeardownError(reason)) {
        return;
    }
    // Re-throw other unhandled rejections
    throw reason;
});

beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});
