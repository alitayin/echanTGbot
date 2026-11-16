const EchanApiClient = require('./echanApi.js');
const { API_KEY, API_ENDPOINT, TARGET_GROUP_IDS } = require('../../../config/config.js');
const { recordTranslationLink } = require('../storage/translationLinkStore.js');

const client = new EchanApiClient(API_KEY, API_ENDPOINT);

async function translateText(text, targetLanguage, userId) {
  const language = String(targetLanguage || 'English').trim() || 'English';
  const query = String(text || '').trim();
  if (!query) return '';

  const translationQuery = `Translate the following text to ${language}. Output only the translation:\n\n${query}`;
  const data = await client.sendTextRequest(translationQuery, userId, '');
  return String(data?.answer || '').trim();
}

async function translateToEnglishIfTargetGroup(msg, bot) {
  if (!TARGET_GROUP_IDS.includes(String(msg.chat.id))) {
    return false;
  }

  
  // Strip URLs and ignore if nothing meaningful is left
  const raw = (msg.text || msg.caption || '').trim();
  const stripped = raw.replace(/https?:\/\/\S+/g, '').trim();
  if (!stripped || stripped.length < 5) {
    return false;
  }


  try {
    const translatedText = await translateText(stripped, 'English', msg.from.id);
    if (!translatedText) return false;
    const sent = await bot.sendMessage(msg.chat.id, `🔄 Translation: ${translatedText}`, {
      reply_to_message_id: msg.message_id,
    });
    await recordTranslationLink(msg.chat.id, msg.message_id, sent?.message_id);
    return true;
  } catch (error) {
    console.error('Translation request failed:', error.message || error);
    return false;
  }
}

module.exports = {
  translateText,
  translateToEnglishIfTargetGroup,
};

