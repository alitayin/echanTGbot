// Secondary spam check via echan text API with key rotation and retry.
const EchanApiClient = require('./echanApi.js');
const { withKeyRotation } = require('./withKeyRotation.js');
const {
  API_ENDPOINT,
  SECONDARY_SPAM_API_KEY,
  SECONDARY_SPAM_API_KEY_BACKUP,
} = require('../../../config/config.js');

function makeClients() {
  return [SECONDARY_SPAM_API_KEY, SECONDARY_SPAM_API_KEY_BACKUP]
    .filter((key) => typeof key === 'string' && key.trim())
    .map((key) => new EchanApiClient(key.trim(), API_ENDPOINT));
}

const CLIENTS = makeClients();

async function performSecondarySpamCheck(query, userId, imageUrls = null) {
  try {
    const answer = await withKeyRotation(
      CLIENTS,
      async (client) => {
        let data;
        if (imageUrls && imageUrls.length > 0) {
          console.log(`Secondary spam check with ${imageUrls.length} image(s)`);
          data = await client.sendImageRequest(imageUrls, query, userId);
        } else {
          data = await client.sendTextRequest(query, userId);
        }
        let result;
        try {
          result = JSON.parse(data.answer);
        } catch {
          throw new Error('Invalid JSON: ' + String(data.answer).slice(0, 80));
        }
        if (typeof result.spam !== 'boolean') {
          throw new Error('Unexpected response shape: spam field missing');
        }
        return result.spam;
      }
    );
    return answer;
  } catch (error) {
    console.warn('Secondary spam check failed, returning false', error.message);
    return false;
  }
}

module.exports = {
  performSecondarySpamCheck,
};
