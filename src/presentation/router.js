const {
    BOT_USERNAME,
    ALLOWED_USERS,
    BLOCKED_USERS,
    DATA_KEYWORDS,
    ALITAYIN_USER_ID,
    KOUSH_USER_ID,
} = require('../../config/config.js');
const { isGroupWithAlitayin } = require('../infrastructure/telegram/groupUtils.js');
const {
    addMessageToGroup,
    addBotMessageToGroup,
    getFormattedContext,
    isGroupMessage
} = require('../infrastructure/storage/groupMessageStorage.js');

const { handleRequestIfAllowed, handlePhotoMessage } = require('../application/usecases/conversationHandler.js');
const { processGroupMessage } = require('../application/usecases/spamHandler.js');
const { prepareConversationQuery, injectNetworkDataIfKeyword } = require('../application/usecases/externalDataHandler.js');
const { createPorts } = require('./portsFactory.js');
const { checkImpersonation, handleImpersonation } = require('../application/usecases/antiImpersonationHandler.js');
const { processNewMemberUsername } = require('../application/usecases/newMemberUsernameHandler.js');
const { sendPromptMessage } = require('../infrastructure/telegram/promptMessenger.js');
const { handleChronikCommand } = require('../application/usecases/chronikHandler.js');
const { handleFloodShieldJoins } = require('../application/usecases/floodShieldHandler.js');
const { handleMissionCompletion } = require('../application/usecases/missionHandler.js');
const { handleStoredMessageCommand } = require('../application/usecases/messageHandler.js');
const { handleWhitelistCallback } = require('../application/usecases/whitelistHandler.js');
const { handleMessageCallback } = require('../application/usecases/messageHandler.js');
const { handleSpamModerationCallback } = require('../application/usecases/spamModerationHandler.js');
const { getHelpMenu, helpMenuData } = require('./views/helpMenuData.js');
const { createCommandRouter, LIMITED_MODE, FEATURE_DISABLED_MSGS } = require('./routes/commandRegistry.js');

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms))
    ]);
}

function pickDisabledMsg() {
    const i = Math.floor(Math.random() * FEATURE_DISABLED_MSGS.length);
    return FEATURE_DISABLED_MSGS[i];
}

function stripHtmlTags(text) {
    return text ? text.replace(/<[^>]+>/g, '') : '';
}

function buildHelpCommandsContext() {
    const commands = helpMenuData?.commands || {};
    const lines = Object.values(commands).map((cmd) => {
        if (!cmd || !cmd.text) return null;
        const cleaned = stripHtmlTags(cmd.text)
            .split('\n')
            .map((line) => line.trim())
            .find((line) => line.length > 0);
        return cleaned ? `- ${cleaned}` : null;
    }).filter(Boolean);
    return lines.length ? `Help menu commands:\n${lines.join('\n')}` : '';
}

function isWhitelistedDMUser(msg) {
    if (!msg || !msg.from || !msg.chat) return false;
    const isPrivate = msg.chat.type === "private";
    const fromId = String(msg.from.id);
    return isPrivate && (fromId === String(ALITAYIN_USER_ID) || fromId === String(KOUSH_USER_ID));
}

function isReplyToStandardBotReply(msg) {
    if (!msg.reply_to_message || !msg.reply_to_message.from) {
        return false;
    }

    if (msg.reply_to_message.from.username !== BOT_USERNAME) {
        return false;
    }

    const repliedText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
    if (!repliedText) {
        return false;
    }

    const standardPrefixes = [
        '🔄 Translation:',
        '✅ Mission created!',
        '📋 All Missions',
        '📋 No missions have been created yet.',
        '✅ Mission ',
        '📈 eCash (XEC) Price Update',
        '🗻 eCash Avalanche Network Update',
        '🌍 World Time',
        '✨ Address: ',
        '⏰ Repeating message scheduled:',
        '📚 Stored Messages (',
        '📭 No saved messages yet.',
        '📭 No scheduled repeating messages.',
        '⏰ Scheduled Repeating Messages (',
        '✅ Stopped repeating message:',
        '✅ Message saved with command:'
    ];

    return standardPrefixes.some(prefix => repliedText.startsWith(prefix));
}

function shouldHandleRequest(msg) {
    let textContent = msg.text || msg.caption || '';
    const echanRegex = /\bechan\b/i;

    if (isReplyToStandardBotReply(msg)) {
        return false;
    }

    const hasTranslateCommand = textContent.includes('/translate');

    return (msg.reply_to_message && msg.reply_to_message.from.username === BOT_USERNAME) ||
           (textContent.includes(`@${BOT_USERNAME}`) || echanRegex.test(textContent)) ||
           (msg.chat.type === "private") ||
           hasTranslateCommand;
}

function registerRoutes(bot) {
    const ports = createPorts(bot);
    const commandRouter = createCommandRouter();

    // Listener 1: store group messages
    bot.on('message', (msg) => {
        if (isGroupMessage(msg)) {
            try {
                addMessageToGroup(msg.chat.id, msg);
            } catch (err) {
                console.error('addMessageToGroup failed:', err);
            }
        }
    });

    // Listener 2: command router - handles all /commands
    bot.on('message', async (msg) => {
        try {
            await commandRouter.handleMessage(msg, bot);
        } catch (error) {
            console.error('Command router error:', error);
        }
    });

    // Listener 3: chronik MCP command
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim();
        const lower = text.toLowerCase();
        const isChronikCommand = lower.startsWith('/chronik') || lower.startsWith(`/chronik@${BOT_USERNAME.toLowerCase()}`) ||
            lower.startsWith('/mcp') || lower.startsWith(`/mcp@${BOT_USERNAME.toLowerCase()}`);
        if (!isChronikCommand) {
            return;
        }
        if (LIMITED_MODE) {
            await sendPromptMessage(bot, msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing chronik MCP command ---');
        try {
            await handleChronikCommand(msg, bot, ports);
        } catch (error) {
            console.error('Chronik MCP command failed:', error);
            await sendPromptMessage(bot, msg.chat.id, '❌ MCP request failed. Please try again later.');
        }
    });

    // Listener 4: stored message commands (custom /commandname [time])
    bot.on('message', async (msg) => {
        if (!msg.text) return;

        if (!msg.text.startsWith('/')) {
            return;
        }

        const text = msg.text.trim();
        const allParts = text.split(/\s+/);
        const commandPart = allParts[0];
        const timeParam = allParts[1] ? allParts[1].trim() : null;

        let commandName = commandPart.substring(1);

        if (commandName.includes('@')) {
            commandName = commandName.split('@')[0];
        }

        const knownCommands = [
            'report', 'addlicense', 'removelicense', 'listlicenses',
            'signup', 'getaddress', 'listaddresses', 'send',
            'exportdata', 'importdata', 'whitelisting', 'listwhitelist',
            'removewhitelist', 'message', 'showmessage', 'deletemessage',
            'stopmessage', 'listscheduled', 'mission', 'showmission', 'deletemission',
            'start', 'help', 'price', 'ava', 'explorer', 'wallet', 'time', 'translate', 'chronik', 'mcp'
        ];

        if (knownCommands.includes(commandName.toLowerCase())) {
            return;
        }

        if (!commandName) {
            return;
        }

        if (LIMITED_MODE) {
            return;
        }

        console.log(`\n--- Checking for stored message command: ${commandName} ${timeParam ? `with time ${timeParam}` : ''} ---`);

        try {
            const handled = await handleStoredMessageCommand(msg, bot, commandName, timeParam);
            if (!handled) {
                console.log(`No stored message found for: ${commandName}`);
            }
        } catch (error) {
            console.error('Failed to handle stored message command:', error);
        }
    });

    // Listener 5: mission completion (✅ or "done" replies)
    bot.on('message', async (msg) => {
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
        if (!isGroup || !msg.reply_to_message) {
            return;
        }

        const text = (msg.text || '').trim().toLowerCase();
        if (text !== '✅' && text !== 'done') {
            return;
        }

        if (LIMITED_MODE) {
            return;
        }

        console.log('\n--- Checking for mission completion ---');
        try {
            await handleMissionCompletion(msg, bot);
        } catch (error) {
            console.error('Failed to process mission completion:', error);
        }
    });

    // Listener 6: main conversation handler
    bot.on('message', async (msg) => {
        if (!shouldHandleRequest(msg)) {
            return;
        }

        if (LIMITED_MODE && !isWhitelistedDMUser(msg)) {
            const isPrivate = msg.chat.type === "private";
            const lower = (msg.text || '').trim().toLowerCase();
            if (isPrivate) {
                if (!lower.startsWith('/explorer')) {
                    await sendPromptMessage(bot, msg.chat.id, pickDisabledMsg());
                }
            } else {
                await sendPromptMessage(bot, msg.chat.id, pickDisabledMsg());
            }
            return;
        }

        // Skip if it's a command (already handled by command router)
        if (msg.text?.startsWith('/')) {
            return;
        }

        console.log('\n--- Processing conversation request ---');

        const originalTextContent = msg.caption || msg.text || '';
        let query = originalTextContent;
        query = query
            .replace(`@${BOT_USERNAME}`, "")
            .trim();

        // Handle /translate command
        if (query.includes('/translate')) {
            query = query.replace(/\/translate/g, 'echan please translate(result only) to');

            if (msg.reply_to_message) {
                const repliedText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
                if (repliedText) {
                    const languageSpec = query.replace('echan please translate(result only) to', '').trim();
                    query = languageSpec
                        ? `echan please translate(result only) to ${languageSpec}: "${repliedText}"`
                        : `echan please translate(result only): "${repliedText}"`;
                }
            }
        }

        // Add username to query
        const userInfo = msg.from.username ? `[${msg.from.username}]: ` : '';
        query = userInfo + query;

        // Add help context if needed
        if (/\/help\b/i.test(originalTextContent)) {
            const helpContext = buildHelpCommandsContext();
            if (helpContext) {
                query = `${query}\n\n${helpContext}`;
            }
        }

        // Check mention flags
        const textContent = msg.text || msg.caption || '';
        const isDirectMention = textContent.includes(`@${BOT_USERNAME}`);
        const isEchanMention = /\bechan\b/i.test(textContent);

        if (isEchanMention || isDirectMention) {
            const prep = await prepareConversationQuery(ports, query, msg.from.id, isDirectMention);
            if (!prep.shouldRespond) {
                return;
            }
            query = prep.query;
        }

        // Add previous context (group) - skip if using /translate
        const isTranslateCommand = (msg.text || msg.caption || '').includes('/translate');
        if (isGroupMessage(msg) && !isTranslateCommand) {
            const context = getFormattedContext(msg.chat.id, msg.message_id, BOT_USERNAME);
            if (context) {
                query = `Previous context:\n${context}\n\nCurrent message:\n${query}`;
            }
        }

        // Inject network data if keyword
        query = await injectNetworkDataIfKeyword(query, DATA_KEYWORDS, 3000);

        // Handle different message types
        if (msg.photo && msg.photo.length > 0) {
            console.log('🖼️ Processing photo message');
            if (!query) {
                query = "Describe this image";
            }
            const photo = msg.photo[msg.photo.length - 1];
            handlePhotoMessage(msg, photo, query, bot, ALLOWED_USERS, BLOCKED_USERS, ports);
        } else if (msg.text) {
            console.log('💭 Processing text conversation');
            handleRequestIfAllowed(msg, query, bot, ALLOWED_USERS, BLOCKED_USERS, ports);
        }
    });

    // Listener 7: check new member usernames
    bot.on('message', async (msg) => {
        if (LIMITED_MODE) {
            return;
        }

        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup) {
            return;
        }

        if (msg.new_chat_members && msg.new_chat_members.length > 0) {
            console.log('\n--- New members joined ---');

            try {
                const botInfo = await bot.getMe();
                const botMember = await bot.getChatMember(msg.chat.id, botInfo.id);
                const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);

                if (!isBotAdmin) {
                    console.log('Bot is not admin, cannot check new members');
                    return;
                }

                const shieldHandled = await handleFloodShieldJoins(bot, msg.chat.id, msg.new_chat_members);
                if (shieldHandled) {
                    return;
                }

                for (const newMember of msg.new_chat_members) {
                    try {
                        await processNewMemberUsername(newMember, msg.chat.id, msg.message_id, bot);
                    } catch (error) {
                        console.error('Failed to check new member username:', error);
                    }
                }
            } catch (error) {
                console.error('Failed to check bot admin status:', error);
            }
        }
    });

    // Listener 8: group spam detection
    bot.on('message', async (msg) => {
        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup) {
            return;
        }

        if (!msg || (
            !msg.text &&
            !msg.caption &&
            !msg.reply_to_message &&
            !msg.photo &&
            !msg.sticker &&
            !msg.document &&
            !msg.animation
        )) {
            return;
        }

        if (msg.text?.startsWith('/')) {
            return;
        }

        await processGroupMessage(msg, bot, ports);
    });

    // Listener 9: anti-impersonation
    bot.on('message', async (msg) => {
        if (LIMITED_MODE) {
            return;
        }
        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup || !msg.from || msg.from.is_bot) {
            return;
        }

        if (msg.text?.startsWith('/')) {
            return;
        }

        const hasAlitayin = await isGroupWithAlitayin(msg.chat.id, bot);
        if (!hasAlitayin) {
            return;
        }

        const user = {
            id: msg.from.id,
            username: msg.from.username,
            first_name: msg.from.first_name,
            last_name: msg.from.last_name
        };

        const impersonationResult = await checkImpersonation(user, msg.chat.id, bot);
        if (impersonationResult.isImpersonation) {
            await handleImpersonation(msg, bot, impersonationResult);
        }
    });

    // Track bot-sent messages
    bot.on('send_message', async (chatId, text) => {
        addBotMessageToGroup(chatId, text, BOT_USERNAME);
    });

    // Listener 10: callback query handler
    bot.on('callback_query', async (query) => {
        try {
            if (query.data.startsWith('whitelist_')) {
                console.log('\n--- Processing whitelist callback ---');
                await handleWhitelistCallback(query, bot);
            } else if (query.data.startsWith('msg_')) {
                console.log('\n--- Processing message callback ---');
                await handleMessageCallback(query, bot);
            } else if (query.data.startsWith('spam_action:')) {
                console.log('\n--- Processing spam moderation callback ---');
                await handleSpamModerationCallback(query, bot);
            } else if (query.data.startsWith('help_') || query.data.startsWith('cmd_')) {
                console.log('\n--- Processing help menu callback ---');
                const isAdmin = ALLOWED_USERS.includes(query.from.username);
                const menuData = getHelpMenu(query.data, isAdmin);

                if (menuData) {
                    await withTimeout(bot.editMessageText(menuData.text, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: menuData.keyboard
                        }
                    }), 5000);
                    await bot.answerCallbackQuery(query.id);
                } else {
                    await bot.answerCallbackQuery(query.id, {
                        text: '❌ Menu not found',
                        show_alert: true
                    });
                }
            }
        } catch (error) {
            console.error('Failed to handle callback query:', error);
            await bot.answerCallbackQuery(query.id, {
                text: '❌ An error occurred. Please try again.',
                show_alert: true
            });
        }
    });
}

module.exports = {
    registerRoutes,
};
