require('dotenv').config();

module.exports = {
  API_KEY: process.env.API_KEY,
  ADDITIONAL_API_KEY: process.env.ADDITIONAL_API_KEY,
  API_ENDPOINT: process.env.API_ENDPOINT,
  TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
  BOT_USERNAME: process.env.BOT_USERNAME,
  
  // 用户配置
  ALLOWED_USERS: process.env.ALLOWED_USERS ? process.env.ALLOWED_USERS.split(',') : [],
  BLOCKED_USERS: process.env.BLOCKED_USERS ? process.env.BLOCKED_USERS.split(',') : [],

  // 群组和用户ID配置
  TARGET_GROUP_IDS: process.env.TARGET_GROUP_IDS.split(','),
  KOUSH_USER_ID: process.env.KOUSH_USER_ID,
  ALITAYIN_USER_ID: process.env.ALITAYIN_USER_ID,

  // 垃圾检测配置
  SPAM_THRESHOLD: parseInt(process.env.SPAM_THRESHOLD),
  SECONDARY_SPAM_API_KEY: process.env.SECONDARY_SPAM_API_KEY,
  ADDITIONAL_API_KEY_BACKUP: process.env.ADDITIONAL_API_KEY_BACKUP,
  SECONDARY_SPAM_API_KEY_BACKUP: process.env.SECONDARY_SPAM_API_KEY_BACKUP,
// 外部调用专用API
  EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY,

  // 限流/并发配置（支持环境变量覆盖，提供合理默认值）
  GLOBAL_CONCURRENCY: parseInt(process.env.GLOBAL_CONCURRENCY || '20'),
  REQUEST_INTERVAL_MS: parseInt(process.env.REQUEST_INTERVAL_MS || String(10 * 1000)),
  DAILY_LIMIT: parseInt(process.env.DAILY_LIMIT || '10'),
  DAILY_WINDOW_MS: parseInt(process.env.DAILY_WINDOW_MS || String(24 * 60 * 60 * 1000)),

  // CoinGecko API配置
  COINGECKO_API_KEY: process.env.COINGECKO_API_KEY,
  CMC_API_KEY: process.env.CMC_API_KEY,

  // 关键词配置
  RELEVANT_KEYWORDS: process.env.RELEVANT_KEYWORDS ? process.env.RELEVANT_KEYWORDS.split(',') : [],
  
  // 数据相关关键词
  DATA_KEYWORDS: process.env.DATA_KEYWORDS ? process.env.DATA_KEYWORDS.split(',') : [],

  // Chronik 配置（可通过环境变量覆盖）
  CHRONIK_URLS: (process.env.CHRONIK_URLS || 'https://chronik1.alitayin.com')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
  CHRONIK_TIMEOUT_MS: parseInt(process.env.CHRONIK_TIMEOUT_MS || '8000')
};
