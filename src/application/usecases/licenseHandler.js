const fs = require('fs').promises;
const path = require('path');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

const MODS_FILE = path.join(__dirname, '../../../config/mods.json');

async function loadModsConfig() {
  try {
    const content = await fs.readFile(MODS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to load mods config:', error);
    return { reporters: [] };
  }
}

async function saveModsConfig(config) {
  try {
    await fs.writeFile(MODS_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save mods config:', error);
    return false;
  }
}

function extractUsername(text) {
  const match = text.match(/@?(\w+)/);
  return match ? match[1] : null;
}

async function handleAddLicense(msg, bot) {
  const parts = msg.text.trim().split(/\s+/);
  
  if (parts.length < 2) {
    await sendPromptMessage(bot, msg.chat.id, '❌ Usage: /addlicense @username');
    return;
  }

  const username = extractUsername(parts[1]);
  if (!username) {
    await sendPromptMessage(bot, msg.chat.id, '❌ Invalid username format. Use: /addlicense @username');
    return;
  }

  const config = await loadModsConfig();
  
  if (config.reporters.includes(username)) {
    await sendPromptMessage(bot, msg.chat.id, `⚠️ @${username} already has report license.`);
    return;
  }

  config.reporters.push(username);
  
  const success = await saveModsConfig(config);
  
  if (success) {
    await sendPromptMessage(bot, msg.chat.id, `✅ License added for @${username}. They can now use /report command.`);
    console.log(`License added: @${username} by @${msg.from.username}`);
  } else {
    await sendPromptMessage(bot, msg.chat.id, '❌ Failed to save license. Please try again.');
  }
}

async function handleRemoveLicense(msg, bot) {
  const parts = msg.text.trim().split(/\s+/);
  
  if (parts.length < 2) {
    await sendPromptMessage(bot, msg.chat.id, '❌ Usage: /removelicense @username');
    return;
  }

  const username = extractUsername(parts[1]);
  if (!username) {
    await sendPromptMessage(bot, msg.chat.id, '❌ Invalid username format. Use: /removelicense @username');
    return;
  }

  const config = await loadModsConfig();
  
  if (!config.reporters.includes(username)) {
    await sendPromptMessage(bot, msg.chat.id, `⚠️ @${username} doesn't have report license.`);
    return;
  }

  config.reporters = config.reporters.filter(r => r !== username);
  
  const success = await saveModsConfig(config);
  
  if (success) {
    await sendPromptMessage(bot, msg.chat.id, `✅ License removed from @${username}. They can no longer use /report command.`);
    console.log(`License removed: @${username} by @${msg.from.username}`);
  } else {
    await sendPromptMessage(bot, msg.chat.id, '❌ Failed to save changes. Please try again.');
  }
}

async function handleListLicenses(msg, bot) {
  const config = await loadModsConfig();
  
  if (config.reporters.length === 0) {
    await sendPromptMessage(bot, msg.chat.id, '📋 No users have report licenses.');
    return;
  }

  const list = config.reporters.map((username, index) => `${index + 1}. \`@${username}\``).join('\n');
  const message = `📋 Users with report license (${config.reporters.length}):\n\n${list}`;
  
  await sendPromptMessage(bot, msg.chat.id, message, { parse_mode: 'Markdown' });
}

async function getReporters() {
  const config = await loadModsConfig();
  return config.reporters || [];
}

module.exports = {
  handleAddLicense,
  handleRemoveLicense,
  handleListLicenses,
  getReporters,
};

