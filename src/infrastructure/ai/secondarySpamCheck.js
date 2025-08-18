// Secondary spam check via echan text API with key rotation and retry.
const EchanApiClient = require('./echanApi.js');
const { 
  API_ENDPOINT,
  SECONDARY_SPAM_API_KEY,
  SECONDARY_SPAM_API_KEY_BACKUP,
} = require('../../../config/config.js');

async function performSecondarySpamCheck(query, userId) {
  const maxRetriesPerKey = 3;
  const maxTotalAttempts = 6;
  let attemptWithCurrentKey = 0;
  let totalAttempts = 0;
  let currentKey = SECONDARY_SPAM_API_KEY;

  const primaryClient = new EchanApiClient(SECONDARY_SPAM_API_KEY, API_ENDPOINT);
  const backupClient = new EchanApiClient(SECONDARY_SPAM_API_KEY_BACKUP, API_ENDPOINT);

  while (attemptWithCurrentKey < maxRetriesPerKey && totalAttempts < maxTotalAttempts) {
    try {
      attemptWithCurrentKey += 1;
      totalAttempts += 1;
      const client = currentKey === SECONDARY_SPAM_API_KEY ? primaryClient : backupClient;
      const data = await client.sendTextRequest(query, userId);
      const answer = JSON.parse(data.answer);
      if (typeof answer.spam === 'boolean') {
        return answer.spam;
      }
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`Secondary spam check failed, attempt ${totalAttempts}/${maxTotalAttempts}`);
      } else {
        console.error(`Attempt ${totalAttempts}/${maxTotalAttempts}: Failed to process additional spam detection:`, error.message || error);
      }

      if ((error.response?.status === 400 || attemptWithCurrentKey === maxRetriesPerKey) &&
          currentKey === SECONDARY_SPAM_API_KEY &&
          totalAttempts < maxTotalAttempts) {
        currentKey = SECONDARY_SPAM_API_KEY_BACKUP;
        attemptWithCurrentKey = 0;
        console.log('Switching to backup secondary spam API key');
      } else if (totalAttempts >= maxTotalAttempts) {
        break;
      }
    }
  }
  return false;
}

module.exports = {
  performSecondarySpamCheck,
};


