const Async = require('async');

/**
 * Create a rate limiter with per-user cooldown/quota and a global queue.
 */
function createRateLimiter(options) {
  const config = {
    concurrency: options?.concurrency,
    requestIntervalMs: options?.requestIntervalMs,
    dailyLimit: options?.dailyLimit,
    dailyWindowMs: options?.dailyWindowMs,
  };

  function validateConfig(cfg) {
    for (const [name, value] of Object.entries(cfg)) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new Error(`rateLimiter: invalid ${name}=${value}`);
      }
    }
  }
  validateConfig(config);

  const lastRequestAtByUser = new Map();
  const userTimestamps = new Map();

  const queue = Async.queue(async (job, done) => {
    try {
      const result = await job.run();
      job.resolve(result);
    } catch (error) {
      job.reject(error);
    }
    done();
  }, config.concurrency);

  function cleanupOldTimestamps(now, timestamps) {
    if (!Array.isArray(timestamps) || timestamps.length === 0) return [];
    const startIndex = timestamps.findIndex((t) => now - t < config.dailyWindowMs);
    if (startIndex === -1) return [];
    return timestamps.slice(startIndex);
  }

  function checkAndConsume({ userId, username, bypass = false }) {
    const now = Date.now();
    if (bypass) {
      return { allowed: true };
    }

    const last = lastRequestAtByUser.get(userId) || 0;
    const delta = now - last;
    if (delta < config.requestIntervalMs) {
      const secondsLeft = Math.ceil((config.requestIntervalMs - delta) / 1000);
      return { allowed: false, reason: 'cooldown', secondsLeft };
    }

    const list = cleanupOldTimestamps(now, userTimestamps.get(userId) || []);
    if (list.length >= config.dailyLimit) {
      const oldest = list[0];
      const msUntilReset = oldest + config.dailyWindowMs - now;
      userTimestamps.set(userId, list);
      return { allowed: false, reason: 'quota', msUntilReset };
    }

    list.push(now);
    userTimestamps.set(userId, list);
    lastRequestAtByUser.set(userId, now);
    return { allowed: true, remaining: Math.max(config.dailyLimit - list.length, 0) };
  }

  function enqueue(run) {
    return new Promise((resolve, reject) => {
      queue.push({ run, resolve, reject });
    });
  }

  function getQueueSize() {
    return queue.length();
  }

  function clearUser(userId) {
    lastRequestAtByUser.delete(userId);
    userTimestamps.delete(userId);
  }

  function getConfig() {
    return { ...config };
  }

  return {
    checkAndConsume,
    enqueue,
    getQueueSize,
    clearUser,
    getConfig,
  };
}

module.exports = { createRateLimiter };


