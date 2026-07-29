// Test setup file - runs before all tests
import fs from 'fs';
import os from 'os';
import path from 'path';
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
    LOCAL_LOG_ENABLED: 'false',
    LOG_PROCESS_ERRORS: 'false',
};

for (const [key, value] of Object.entries(TEST_ENV_DEFAULTS)) {
    if (!process.env[key]) process.env[key] = value;
}

if (!process.env.DATA_DIR) {
    process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), `echan-vitest-${process.pid}-`));
}

beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
});

afterEach(() => {
    vi.useRealTimers();
});
