// In-memory store for tracking users' spam offenses within a rolling window.
// Infrastructure layer: stateful storage with internal cleanup.

const TRACKING_WINDOW_MS = 3 * 60 * 60 * 1000; // 3 hours

const spamUserTracker = new Map();

function updateSpamRecord(userId) {
  const now = Date.now();
  const existing = spamUserTracker.get(userId) || { count: 0, firstSpamTime: now };

  if (now - existing.firstSpamTime > TRACKING_WINDOW_MS) {
    existing.count = 1;
    existing.firstSpamTime = now;
  } else {
    existing.count += 1;
  }

  spamUserTracker.set(userId, existing);
  return existing;
}

function getSpamRecord(userId) {
  return spamUserTracker.get(userId) || null;
}

function resetSpamRecord(userId) {
  spamUserTracker.delete(userId);
}

// Periodic cleanup of expired records
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [userId, record] of spamUserTracker.entries()) {
    if (now - record.firstSpamTime > TRACKING_WINDOW_MS) {
      spamUserTracker.delete(userId);
    }
  }
}, 10 * 60 * 1000); // every 10 minutes
cleanupTimer.unref?.();

module.exports = {
  updateSpamRecord,
  getSpamRecord,
  resetSpamRecord,
  TRACKING_WINDOW_MS,
};


