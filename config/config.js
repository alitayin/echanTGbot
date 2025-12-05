require('dotenv').config();

module.exports = {
  API_KEY: process.env.API_KEY,
  ADDITIONAL_API_KEY: process.env.ADDITIONAL_API_KEY,
  API_ENDPOINT: process.env.API_ENDPOINT,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  
  // User configuration
  ALLOWED_USERS: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : [],
  BLOCKED_USERS: process.env.BLOCKED_USERS ? process.env.BLOCKED_USERS.split(',') : [],

  // Group and user ID configuration
  TARGET_GROUP_IDS: process.env.TARGET_GROUP_IDS.split(','),
  KOUSH_USER_ID: process.env.KOUSH_USER_ID,
  ALITAYIN_USER_ID: process.env.ALITAYIN_USER_ID,
  NOTIFICATION_GROUP_ID: process.env.NOTIFICATION_GROUP_ID,
  // I keep this in hardcode, because i don't think it is neccesary to be putted into env.
  ECASH_ARMY_GROUP_ID: '-1001533588498',

  // Spam detection configuration
  SPAM_THRESHOLD: parseInt(process.env.SPAM_THRESHOLD),
  USERNAME_LENGTH_THRESHOLD: parseInt(process.env.USERNAME_LENGTH_THRESHOLD || '30'),
  NORMAL_STREAK_THRESHOLD: parseInt(process.env.NORMAL_STREAK_THRESHOLD || '5'),
  SECONDARY_SPAM_API_KEY: process.env.SECONDARY_SPAM_API_KEY,
  ADDITIONAL_API_KEY_BACKUP: process.env.ADDITIONAL_API_KEY_BACKUP,
  SECONDARY_SPAM_API_KEY_BACKUP: process.env.SECONDARY_SPAM_API_KEY_BACKUP,
  // External API
  EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY,

  // Rate limiting/concurrency configuration (supports env var override with reasonable defaults)
  GLOBAL_CONCURRENCY: parseInt(process.env.GLOBAL_CONCURRENCY || '20'),
  REQUEST_INTERVAL_MS: parseInt(process.env.REQUEST_INTERVAL_MS || String(10 * 1000)),
  DAILY_LIMIT: parseInt(process.env.DAILY_LIMIT || '10'),
  DAILY_WINDOW_MS: parseInt(process.env.DAILY_WINDOW_MS || String(24 * 60 * 60 * 1000)),

  // CoinGecko API configuration
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  CMC_API_KEY: process.env.CMC_API_KEY,

  // Keyword configuration
  RELEVANT_KEYWORDS: process.env.RELEVANT_KEYWORDS ? process.env.RELEVANT_KEYWORDS.split(',') : [],
  
  // Data-related keywords
  DATA_KEYWORDS: process.env.DATA_KEYWORDS ? process.env.DATA_KEYWORDS.split(',') : [],

  // Chronik configuration (can be overridden by env vars)
  CHRONIK_URLS: (process.env.CHRONIK_URLS || 'https://chronik1.alitayin.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  CHRONIK_TIMEOUT_MS: parseInt(process.env.CHRONIK_TIMEOUT_MS || '8000')
};
