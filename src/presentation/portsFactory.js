const { API_KEY, API_ENDPOINT, EXTERNAL_API_KEY } = require('../../config/config.js');
const EchanApiClient = require('../infrastructure/ai/echanApi.js');
const { fetchMessageAnalysis } = require('../infrastructure/ai/messageAnalysis.js');
const { performSecondarySpamCheck } = require('../infrastructure/ai/secondarySpamCheck.js');
const { translateToEnglishIfTargetGroup } = require('../infrastructure/ai/translation.js');

function createPorts(bot) {
  const chatClient = new EchanApiClient(API_KEY, API_ENDPOINT);
  const externalClient = new EchanApiClient(EXTERNAL_API_KEY || API_KEY, API_ENDPOINT);

  const chat = {
    sendText: (query, userId, conversationId = '') => chatClient.sendTextRequest(query, userId, conversationId),
    // Use external key for streaming requests which are used for external data fetching
    sendStreamingText: (query, userId, conversationId = '') => externalClient.sendStreamingTextRequest(query, userId, conversationId),
    sendImage: (imageUrl, query, userId, conversationId = '') => chatClient.sendImageRequest(imageUrl, query, userId, conversationId),
  };

  const analysis = {
    analyzeMessage: (query, userId) => fetchMessageAnalysis(query, userId),
  };

  const secondarySpam = {
    check: (query, userId) => performSecondarySpamCheck(query, userId),
  };

  const translation = {
    translateToEnglishIfTargetGroup: (msg, bot) => translateToEnglishIfTargetGroup(msg, bot),
  };

  const telegramGroup = {
    hasMember: async (chatId, userId) => {
      if (!bot) return false;
      try {
        const botInfo = await bot.getMe();
        const botMember = await bot.getChatMember(chatId, botInfo.id);
        const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);
        if (!isBotAdmin) {
          return false;
        }
        const member = await bot.getChatMember(chatId, userId);
        return member.status !== 'left' && member.status !== 'kicked';
      } catch (error) {
        if (typeof error?.message === 'string' && error.message.includes('CHAT_ADMIN_REQUIRED')) {
          return false;
        }
        return false;
      }
    },
  };

  return { chat, analysis, secondarySpam, translation, telegramGroup };
}

module.exports = { createPorts };


