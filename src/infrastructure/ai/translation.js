const EchanApiClient = require('./echanApi.js');
const { API_KEY, API_ENDPOINT, TARGET_GROUP_IDS } = require('../../../config/config.js');

async function translateToEnglishIfTargetGroup(msg, bot) {
  if (!TARGET_GROUP_IDS.includes(String(msg.chat.id))) {
    return false;
  }

  const query = msg.text || msg.caption || '';
  const translationQuery = `translate ${query.trim()} to english, only output English.`;

  try {
    const client = new EchanApiClient(API_KEY, API_ENDPOINT);
    const data = await client.sendTextRequest(translationQuery, msg.from.id);
    const translatedText = data?.answer || '';
    await bot.sendMessage(msg.chat.id, `🔄 Translation: ${translatedText}`, {
      reply_to_message_id: msg.message_id,
    });
    return true;
  } catch (error) {
    console.error('Translation request failed:', error.message || error);
    return false;
  }
}

module.exports = {
  translateToEnglishIfTargetGroup,
};


