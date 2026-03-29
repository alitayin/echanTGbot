/**
 * Retry an AI API call with primary/backup key rotation.
 *
 * @param {object[]} clients  - Ordered array of EchanApiClient instances (primary first).
 * @param {function}  fn      - async (client) => result. Throw on failure.
 * @param {object}   [opts]
 * @param {number}   [opts.maxRetriesPerKey=3]  - Max attempts before switching key.
 * @param {number}   [opts.maxTotalAttempts=6]  - Hard cap across all keys.
 * @returns {Promise<*>} Resolves with the first successful result, or rejects when
 *                       all attempts are exhausted.
 */
async function withKeyRotation(clients, fn, opts = {}) {
  if (!clients || clients.length === 0) {
    throw new Error('withKeyRotation: clients array must not be empty');
  }
  const maxRetriesPerKey = opts.maxRetriesPerKey ?? 3;
  const maxTotalAttempts = opts.maxTotalAttempts ?? clients.length * maxRetriesPerKey;

  let clientIndex = 0;
  let attemptsOnCurrentClient = 0;
  let totalAttempts = 0;

  while (totalAttempts < maxTotalAttempts && clientIndex < clients.length) {
    const client = clients[clientIndex];
    try {
      attemptsOnCurrentClient++;
      totalAttempts++;
      return await fn(client);
    } catch (error) {
      const is400 = error.response?.status === 400;
      if (is400) {
        console.log(`API key rotation: got 400 on attempt ${totalAttempts}/${maxTotalAttempts}, switching key`);
      } else {
        console.error(`API call failed (attempt ${totalAttempts}/${maxTotalAttempts}):`, error.message || error);
      }

      const exhaustedCurrentKey =
        is400 || attemptsOnCurrentClient >= maxRetriesPerKey;

      if (exhaustedCurrentKey && clientIndex < clients.length - 1) {
        clientIndex++;
        attemptsOnCurrentClient = 0;
        console.log(`Switching to API client #${clientIndex + 1}`);
      } else if (totalAttempts >= maxTotalAttempts || attemptsOnCurrentClient >= maxRetriesPerKey) {
        break;
      }
    }
  }

  throw new Error('withKeyRotation: all attempts exhausted');
}

module.exports = { withKeyRotation };
