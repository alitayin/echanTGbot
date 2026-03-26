require('dotenv').config();

// --- Required env vars (bot cannot start without these) ---
const REQUIRED = [
  'API_KEY',
  'API_ENDPOINT',
  'TELEGRAM_TOKEN',
  'BOT_USERNAME',
  'TARGET_GROUP_IDS',
  'NOTIFICATION_GROUP_ID',
  'SPAM_THRESHOLD',
  'ADDITIONAL_API_KEY',
  'SECONDARY_SPAM_API_KEY',
];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `[config] Missing required environment variables: ${missing.join(', ')}\n` +
    'Please check your .env file.'
  );
}

module.exports = {
  // --- AI / API ---
  API_KEY: process.env.API_KEY,
  ADDITIONAL_API_KEY: process.env.ADDITIONAL_API_KEY,
  ADDITIONAL_API_KEY_BACKUP: process.env.ADDITIONAL_API_KEY_BACKUP,
  API_ENDPOINT: process.env.API_ENDPOINT,
  SECONDARY_SPAM_API_KEY: process.env.SECONDARY_SPAM_API_KEY,
  SECONDARY_SPAM_API_KEY_BACKUP: process.env.SECONDARY_SPAM_API_KEY_BACKUP,
  EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY,

  // --- Telegram ---
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  TARGET_GROUP_IDS: process.env.TARGET_GROUP_IDS.split(','),
  KOUSH_USER_ID: process.env.KOUSH_USER_ID,
  ALITAYIN_USER_ID: process.env.ALITAYIN_USER_ID,
  NOTIFICATION_GROUP_ID: process.env.NOTIFICATION_GROUP_ID,
  // Kept as hardcode — not expected to change between deployments.
  ECASH_ARMY_GROUP_ID: '-1001533588498',

  // --- User lists ---
  ALLOWED_USERS: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : [],
  BLOCKED_USERS: process.env.BLOCKED_USERS ? process.env.BLOCKED_USERS.split(',') : [],

  // --- Spam detection ---
  SPAM_THRESHOLD: parseInt(process.env.SPAM_THRESHOLD),
  USERNAME_LENGTH_THRESHOLD: parseInt(process.env.USERNAME_LENGTH_THRESHOLD || '30'),
  NORMAL_STREAK_THRESHOLD: parseInt(process.env.NORMAL_STREAK_THRESHOLD || '3'),

  // --- Rate limiting / concurrency ---
  GLOBAL_CONCURRENCY: parseInt(process.env.GLOBAL_CONCURRENCY || '20'),
  REQUEST_INTERVAL_MS: parseInt(process.env.REQUEST_INTERVAL_MS || String(10 * 1000)),
  DAILY_LIMIT: parseInt(process.env.DAILY_LIMIT || '10'),
  DAILY_WINDOW_MS: parseInt(process.env.DAILY_WINDOW_MS || String(24 * 60 * 60 * 1000)),

  // --- Price data APIs ---
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  CMC_API_KEY: process.env.CMC_API_KEY,

  // --- Keyword config ---
  RELEVANT_KEYWORDS: process.env.RELEVANT_KEYWORDS ? process.env.RELEVANT_KEYWORDS.split(',') : [],
  DATA_KEYWORDS: process.env.DATA_KEYWORDS ? process.env.DATA_KEYWORDS.split(',') : [],

  // --- Chronik ---
  CHRONIK_URLS: (process.env.CHRONIK_URLS || 'https://chronik.e.cash')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  CHRONIK_TIMEOUT_MS: parseInt(process.env.CHRONIK_TIMEOUT_MS || '8000'),

  // --- MCP ---
  MCP_ECASH_URL: process.env.MCP_ECASH_URL || 'https://teamsocket.net/mcp',
  MCP_TIMEOUT_MS: parseInt(process.env.MCP_TIMEOUT_MS || '15000'),

  // --- Auto-delete ---
  AUTO_DELETE_PROMPT_MS: parseInt(process.env.AUTO_DELETE_PROMPT_MS || String(30 * 1000)),
};
