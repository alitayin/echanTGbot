const { getMissingProtectionConfig } = require('../../../config/config.js');
const {
  getProtectionState,
  setProtectionEnabled,
} = require('../../infrastructure/storage/protectionState.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

function getActor(msg) {
  return msg?.from?.username || msg?.from?.id || 'unknown';
}

async function handleEnableProtection(msg, bot, dependencies = {}) {
  dependencies = dependencies || {};
  const getMissingConfig = dependencies.getMissingProtectionConfig || getMissingProtectionConfig;
  const getState = dependencies.getProtectionState || getProtectionState;
  const setEnabled = dependencies.setProtectionEnabled || setProtectionEnabled;
  const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
  const missing = getMissingConfig();
  if (missing.length > 0) {
    await sendPrompt(
      bot,
      msg.chat.id,
      `Protection cannot be enabled. Missing configuration: ${missing.join(', ')}`,
      { disableAutoDelete: true }
    );
    return false;
  }

  const current = await getState();
  if (current.enabled) {
    await sendPrompt(bot, msg.chat.id, 'Protection is already enabled.', {
      disableAutoDelete: true,
    });
    return true;
  }

  await setEnabled(true, getActor(msg));
  await sendPrompt(bot, msg.chat.id, 'Protection enabled globally.', {
    disableAutoDelete: true,
  });
  return true;
}

async function handleDisableProtection(msg, bot, dependencies = {}) {
  dependencies = dependencies || {};
  const getState = dependencies.getProtectionState || getProtectionState;
  const setEnabled = dependencies.setProtectionEnabled || setProtectionEnabled;
  const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
  const current = await getState();
  if (!current.enabled) {
    await sendPrompt(bot, msg.chat.id, 'Protection is already disabled.', {
      disableAutoDelete: true,
    });
    return true;
  }

  await setEnabled(false, getActor(msg));
  await sendPrompt(bot, msg.chat.id, 'Protection disabled globally.', {
    disableAutoDelete: true,
  });
  return true;
}

async function handleProtectionStatus(msg, bot, dependencies = {}) {
  dependencies = dependencies || {};
  const getState = dependencies.getProtectionState || getProtectionState;
  const sendPrompt = dependencies.sendPromptMessage || sendPromptMessage;
  const state = await getState();
  const status = state.enabled ? 'enabled' : 'disabled';
  const details = state.updatedAt
    ? `\nLast changed by ${state.updatedBy || 'unknown'} at ${new Date(state.updatedAt).toISOString()}.`
    : '\nNo manual change has been recorded.';
  await sendPrompt(bot, msg.chat.id, `Protection is ${status}.${details}`, {
    disableAutoDelete: true,
  });
  return state;
}

module.exports = {
  handleEnableProtection,
  handleDisableProtection,
  handleProtectionStatus,
};
