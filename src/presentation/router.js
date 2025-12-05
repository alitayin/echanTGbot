const {
    BOT_USERNAME,
    ALLOWED_USERS,
    BLOCKED_USERS,
    DATA_KEYWORDS,
    ALITAYIN_USER_ID,
    KOUSH_USER_ID,
    ECASH_ARMY_GROUP_ID,
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
const { handlePriceCommand } = require('../application/usecases/priceHandler.js');
const { renderPriceMessage } = require('./views/priceView.js');
const { handleReportCommand } = require('../application/usecases/reportHandler.js');
const { handleAvalancheCommand } = require('../application/usecases/avalancheHandler.js');
const { renderAvalancheMessage } = require('./views/avalancheView.js');
const { handleExplorerAddress } = require('../application/usecases/explorerHandler.js');
const { 
    handleAddLicense, 
    handleRemoveLicense, 
    handleListLicenses,
    getReporters 
} = require('../application/usecases/licenseHandler.js');
const { 
    handleSignup, 
    handleGetAddress, 
    handleListAddresses,
    handleExportData,
    handleImportData
} = require('../application/usecases/signupHandler.js');
const { handleSendCommand } = require('../application/usecases/sendHandler.js');
const { 
    handleWhitelistingCommand, 
    handleWhitelistCallback, 
    handleListWhitelistCommand,
    handleRemoveWhitelistCommand
} = require('../application/usecases/whitelistHandler.js');
const { handleTimeCommand } = require('../application/usecases/timeHandler.js');
const { renderTimeMessage } = require('./views/timeView.js');
const { 
    handleMessageCommand, 
    handleShowMessageCommand, 
    handleDeleteMessageCommand,
    handleMessageCallback,
    handleStoredMessageCommand,
    handleStopMessageCommand,
    handleListScheduledCommand
} = require('../application/usecases/messageHandler.js');
const {
    handleMissionCommand,
    handleMissionCompletion,
    handleShowMissionCommand,
    handleDeleteMissionCommand
} = require('../application/usecases/missionHandler.js');

const LIMITED_MODE = false; 
const FEATURE_DISABLED_MSGS = [
    'I’m resting. When I wake up, will the Earth be any different?',
    'I can’t talk to you for now; the Earth’s signal is too weak..',
    'I’m listening to the silence; your voice is somewhere behind the static.',
    'I tried to reach you, but the signal dissolved into the void.',
    'I can’t answer right now; the cosmos is louder than your words.'
];
function pickDisabledMsg() {
    const i = Math.floor(Math.random() * FEATURE_DISABLED_MSGS.length);
    return FEATURE_DISABLED_MSGS[i];
}
function isWhitelistedDMUser(msg) {
    if (!msg || !msg.from || !msg.chat) return false;
    const isPrivate = msg.chat.type === "private";
    const fromId = String(msg.from.id);
    return isPrivate && (fromId === String(ALITAYIN_USER_ID) || fromId === String(KOUSH_USER_ID));
}

// Help menu data structure
const helpMenuData = {
    main: {
        user: {
            text: '🤖 <b>alitayinGPTbot</b>\n\nWelcome! Click on a command to see details:',
            keyboard: [
                [{ text: '📝 /signup - Register Address', callback_data: 'cmd_signup' }],
                [{ text: '💵 /price - Price Query', callback_data: 'cmd_price' }],
                [{ text: '🔍 /explorer - Address Query', callback_data: 'cmd_explorer' }],
                [{ text: '⏰ /time - World Time', callback_data: 'cmd_time' }],
                [{ text: '🌐 /translate - Translation', callback_data: 'cmd_translate' }],
                [{ text: '✅ /whitelisting - Keyword Whitelist', callback_data: 'cmd_whitelisting' }]
            ]
        },
        admin: {
            text: '👑 <b>Admin Control Panel</b>\n\nSelect a category:',
            keyboard: [
                [{ text: '👮 Mods Add & Remove', callback_data: 'help_mods' }],
                [{ text: '👥 Community User Management', callback_data: 'help_users' }],
                [{ text: '💸 Send XEC/SLP/ALP', callback_data: 'help_send' }],
                [{ text: '📦 User Data Import/Export', callback_data: 'help_data' }],
                [{ text: '🛡️ Whitelist Keywords', callback_data: 'help_whitelist' }],
                [{ text: '🎯 Community Missions', callback_data: 'help_missions' }],
                [{ text: '💾 Message Templates & Scheduling', callback_data: 'help_messages' }]
            ]
        }
    },
    categories: {
        help_mods: {
            text: '👮 <b>Mods Add & Remove</b>\n\nManage moderator permissions:',
            keyboard: [
                [{ text: '➕ /addlicense - Add Mod', callback_data: 'cmd_addlicense' }],
                [{ text: '➖ /removelicense - Remove Mod', callback_data: 'cmd_removelicense' }],
                [{ text: '📋 /listlicenses - List Mods', callback_data: 'cmd_listlicenses' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        },
        help_users: {
            text: '👥 <b>Community User Management</b>\n\nManage community user addresses:',
            keyboard: [
                [{ text: '🔍 /getaddress - Get User Address', callback_data: 'cmd_getaddress' }],
                [{ text: '📋 /listaddresses - List All Addresses', callback_data: 'cmd_listaddresses' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        },
        help_send: {
            text: '💸 <b>Send XEC/SLP/ALP</b>\n\nSend tokens to users:',
            keyboard: [
                [{ text: '💰 /send - Send Tokens', callback_data: 'cmd_send' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        },
        help_data: {
            text: '📦 <b>User Data Import/Export</b>\n\nBackup and restore user data:',
            keyboard: [
                [{ text: '📤 /exportdata - Export Data', callback_data: 'cmd_exportdata' }],
                [{ text: '📥 /importdata - Import Data', callback_data: 'cmd_importdata' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        },
        help_whitelist: {
            text: '🛡️ <b>Whitelist Keywords</b>\n\nManage spam filter whitelist:',
            keyboard: [
                [{ text: '📋 /listwhitelist - List Keywords', callback_data: 'cmd_listwhitelist' }],
                [{ text: '🗑️ /removewhitelist - Remove Keyword', callback_data: 'cmd_removewhitelist' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        },
        help_missions: {
            text: '🎯 <b>Community Missions</b>\n\nCreate and manage community missions:',
            keyboard: [
                [{ text: '➕ /mission - Create Mission', callback_data: 'cmd_mission' }],
                [{ text: '📋 /showmission - Show Missions', callback_data: 'cmd_showmission' }],
                [{ text: '🗑️ /deletemission - Delete Mission', callback_data: 'cmd_deletemission' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        },
        help_messages: {
            text: '💾 <b>Message Templates & Scheduling</b>\n\nManage message templates and auto-sending:',
            keyboard: [
                [{ text: '💾 /message - Save Message', callback_data: 'cmd_message' }],
                [{ text: '📋 /showmessage - Show Messages', callback_data: 'cmd_showmessage' }],
                [{ text: '🗑️ /deletemessage - Delete Message', callback_data: 'cmd_deletemessage' }],
                [{ text: '📋 /listscheduled - List Scheduled', callback_data: 'cmd_listscheduled' }],
                [{ text: '⏹️ /stopmessage - Stop Message', callback_data: 'cmd_stopmessage' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'help_main' }]
            ]
        }
    },
    commands: {
        cmd_signup: {
            text: '📝 <b>/signup</b>\n\nRegister your eCash address to receive token rewards.\n\n<b>Usage:</b>\n<code>/signup ecash:qp...</code>\n\n<b>Note:</b>\nProvide a valid eCash address for registration',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_price: {
            text: '💵 <b>/price</b>\n\nGet current eCash (XEC) real-time price data.\n\n<b>Usage:</b>\n<code>/price</code>\n\n<b>Note:</b>\nDisplays price, market cap, 24h change, and more',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_explorer: {
            text: '🔍 <b>/explorer</b>\n\nQuery transaction history for a specific address.\n\n<b>Usage:</b>\n<code>/explorer ecash:qp... [page]</code>\n\n<b>Example:</b>\n<code>/explorer ecash:qp... 1</code>\n\n<b>Note:</b>\nShows address transaction history with pagination',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_time: {
            text: '⏰ <b>/time</b>\n\nCheck current time around the world.\n\n<b>Usage:</b>\n<code>/time [location/UTC offset]</code>\n\n<b>Examples:</b>\n<code>/time</code> - Current time\n<code>/time shanghai utc+8</code> - Specify timezone\n\n<b>Note:</b>\nSupports city names and UTC offsets',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_whitelisting: {
            text: '✅ <b>/whitelisting</b>\n\nRequest to add a keyword to whitelist, bypassing spam detection.\n\n<b>Usage:</b>\n<code>/whitelisting keyword</code>\n\n<b>Note:</b>\nWait for admin approval after submission',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_translate: {
            text: '🌐 <b>/translate</b>\n\nTranslate messages to a specified language.\n\n<b>Usage:</b>\n<code>/translate [language]</code>\n\n<b>Example:</b>\nReply to a message and send:\n<code>/translate english</code>\n\n<b>Note:</b>\nCan reply to translate, or add text after command',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_addlicense: {
            text: '➕ <b>/addlicense</b>\n\nGrant a user moderator permission to use /report.\n\n<b>Usage:</b>\n<code>/addlicense @username</code>\n\n<b>Note:</b>\nAdmin only',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_mods' }]]
        },
        cmd_removelicense: {
            text: '➖ <b>/removelicense</b>\n\nRevoke a user\'s moderator permission.\n\n<b>Usage:</b>\n<code>/removelicense @username</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_mods' }]]
        },
        cmd_listlicenses: {
            text: '📋 <b>/listlicenses</b>\n\nView all users with moderator permission.\n\n<b>Usage:</b>\n<code>/listlicenses</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_mods' }]]
        },
        cmd_getaddress: {
            text: '🔍 <b>/getaddress</b>\n\nQuery a user\'s registered eCash address.\n\n<b>Usage:</b>\n<code>/getaddress @username</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_users' }]]
        },
        cmd_listaddresses: {
            text: '📋 <b>/listaddresses</b>\n\nView all registered eCash addresses.\n\n<b>Usage:</b>\n<code>/listaddresses [page]</code>\n\n<b>Note:</b>\nDisplays 20 addresses per page',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_users' }]]
        },
        cmd_send: {
            text: '💸 <b>/send</b>\n\nSend XEC, SLP, or ALP tokens to a user.\n\n<b>Usage:</b>\n<code>/send amount</code> - Send XEC\n<code>/send tokenId amount</code> - Send SLP/ALP\n\n<b>Note:</b>\nReply to user\'s message to use this command',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_send' }]]
        },
        cmd_exportdata: {
            text: '📤 <b>/exportdata</b>\n\nExport all user data as a JSON file.\n\n<b>Usage:</b>\n<code>/exportdata</code>\n\n<b>Note:</b>\nFor backup or migration purposes',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_data' }]]
        },
        cmd_importdata: {
            text: '📥 <b>/importdata</b>\n\nImport user data from a JSON file.\n\n<b>Usage:</b>\nReply to the exported JSON file and send:\n<code>/importdata</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_data' }]]
        },
        cmd_listwhitelist: {
            text: '📋 <b>/listwhitelist</b>\n\nView all whitelisted keywords.\n\n<b>Usage:</b>\n<code>/listwhitelist</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_whitelist' }]]
        },
        cmd_removewhitelist: {
            text: '🗑️ <b>/removewhitelist</b>\n\nRemove a keyword from the whitelist.\n\n<b>Usage:</b>\n<code>/removewhitelist keyword</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_whitelist' }]]
        },
        cmd_mission: {
            text: '➕ <b>/mission</b>\n\nCreate a new community mission (reward: 1 OORAH).\n\n<b>Usage:</b>\n<code>/mission description</code>\n\n<b>Note:</b>\nGroup only',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_missions' }]]
        },
        cmd_showmission: {
            text: '📋 <b>/showmission</b>\n\nView all created missions with their IDs.\n\n<b>Usage:</b>\n<code>/showmission</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_missions' }]]
        },
        cmd_deletemission: {
            text: '🗑️ <b>/deletemission</b>\n\nDelete a specific mission.\n\n<b>Usage:</b>\n<code>/deletemission mission_id</code>\n\n<b>Note:</b>\nCan also reply to mission message to use this command',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_missions' }]]
        },
        cmd_message: {
            text: '💾 <b>/message</b>\n\nSave a message template for later use.\n\n<b>Usage:</b>\nReply to the message to save and send:\n<code>/message commandname</code>\n<code>/message commandname time</code> - Scheduled repeat\n\n<b>Example:</b>\n<code>/message koush 6h</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_messages' }]]
        },
        cmd_showmessage: {
            text: '📋 <b>/showmessage</b>\n\nView all saved message templates.\n\n<b>Usage:</b>\n<code>/showmessage</code>\n\n<b>Note:</b>\nPrivate chat only',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_messages' }]]
        },
        cmd_deletemessage: {
            text: '🗑️ <b>/deletemessage</b>\n\nDelete a saved message template.\n\n<b>Usage:</b>\n<code>/deletemessage commandname</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_messages' }]]
        },
        cmd_listscheduled: {
            text: '📋 <b>/listscheduled</b>\n\nView all scheduled repeating messages.\n\n<b>Usage:</b>\n<code>/listscheduled</code>\n\n<b>Note:</b>\nPrivate chat only',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_messages' }]]
        },
        cmd_stopmessage: {
            text: '⏹️ <b>/stopmessage</b>\n\nStop a message from repeating.\n\n<b>Usage:</b>\n<code>/stopmessage commandname</code>',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_messages' }]]
        }
    }
};

function getHelpMenu(callbackData, isAdmin) {
    if (callbackData === 'help_main') {
        return isAdmin ? helpMenuData.main.admin : helpMenuData.main.user;
    }
    
    if (callbackData.startsWith('help_')) {
        return helpMenuData.categories[callbackData];
    }
    
    if (callbackData.startsWith('cmd_')) {
        return helpMenuData.commands[callbackData];
    }
    
    return null;
}

// Helper: check if the user is replying to a "standard command reply" from the bot
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

    if (repliedText.startsWith('🔄 Translation:')) {
        return true;
    }

    if (repliedText.startsWith('✅ Mission created!') ||
        repliedText.startsWith('📋 All Missions') ||
        repliedText.startsWith('📋 No missions have been created yet.') ||
        repliedText.startsWith('✅ Mission ')) {
        return true;
    }

    if (repliedText.startsWith('📈 eCash (XEC) Price Update') ||
        repliedText.startsWith('🗻 eCash Avalanche Network Update') ||
        repliedText.startsWith('🌍 World Time') ||
        repliedText.startsWith('✨ Address: ')) {
        return true;
    }

    if (repliedText.startsWith('⏰ Repeating message scheduled:') ||
        repliedText.startsWith('📚 Stored Messages (') ||
        repliedText.startsWith('📭 No saved messages yet.') ||
        repliedText.startsWith('📭 No scheduled repeating messages.') ||
        repliedText.startsWith('⏰ Scheduled Repeating Messages (') ||
        repliedText.startsWith('✅ Stopped repeating message:') ||
        repliedText.startsWith('✅ Message saved with command:')) {
        return true;
    }

    return false;
}

// Helper: should handle request
function shouldHandleRequest(msg) {
    let textContent = msg.text || msg.caption || '';
    const echanRegex = /\bechan\b/i;

    // If the user is replying to a standard bot reply (command/system output),
    // do NOT route this into the main conversation / external API.
    if (isReplyToStandardBotReply(msg)) {
        return false;
    }
    
    // Check if message contains /translate command
    const hasTranslateCommand = textContent.includes('/translate');
    
    return (msg.reply_to_message && msg.reply_to_message.from.username === BOT_USERNAME) ||
           (textContent.includes(`@${BOT_USERNAME}`) || echanRegex.test(textContent)) ||
           (msg.chat.type === "private") ||
           hasTranslateCommand;
}

function registerRoutes(bot) {
    const ports = createPorts(bot);
    // Listener 1: store group messages
    bot.on('message', async (msg) => {
        if (isGroupMessage(msg)) {
            addMessageToGroup(msg.chat.id, msg);
        }
    });

    // Listener 2: handle /report
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/report')) {
            return;
        }
        
        // Dynamically load reporters list
        const reporters = await getReporters();
        if (!reporters.includes(msg.from.username)) {
            return;
        }
        
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing report command ---');
        try {
            await handleReportCommand(msg, bot);
        } catch (error) {
            console.error('Failed to process report:', error);
            await bot.sendMessage(msg.chat.id, "You can try replying to spam messages and use the /report function.");
        }
    });

    // Listener 3: help
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const command = msg.text.trim().toLowerCase();
        if (command !== "/start" && command !== "/help") {
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing help command ---');
        const isAdmin = ALLOWED_USERS.includes(msg.from.username);
        const menuData = getHelpMenu('help_main', isAdmin);
        
        await bot.sendMessage(msg.chat.id, menuData.text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: menuData.keyboard
            }
        });
    });

    // Listener 3.1: addlicense (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/addlicense')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing add license command ---');
        try {
            await handleAddLicense(msg, bot);
        } catch (error) {
            console.error('Failed to add license:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to add license. Please try again.');
        }
    });

    // Listener 3.2: removelicense (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/removelicense')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing remove license command ---');
        try {
            await handleRemoveLicense(msg, bot);
        } catch (error) {
            console.error('Failed to remove license:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to remove license. Please try again.');
        }
    });

    // Listener 3.3: listlicenses (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/listlicenses')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing list licenses command ---');
        try {
            await handleListLicenses(msg, bot);
        } catch (error) {
            console.error('Failed to list licenses:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to list licenses. Please try again.');
        }
    });

    // Listener 3.4: signup (all users)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/signup')) {
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing user signup command ---');
        try {
            await handleSignup(msg, bot);
        } catch (error) {
            console.error('Failed to process signup:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to register address. Please try again.');
        }
    });

    // Listener 3.5: getaddress (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/getaddress')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing get address command ---');
        try {
            await handleGetAddress(msg, bot);
        } catch (error) {
            console.error('Failed to get address:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve address. Please try again.');
        }
    });

    // Listener 3.6: listaddresses (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/listaddresses')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing list addresses command ---');
        try {
            // Parse page parameter (user provides 1-based, convert to 0-based)
            const parts = msg.text.trim().split(/\s+/);
            const userPageInput = parts[1] ? parseInt(parts[1], 10) : 1;
            const page = Number.isFinite(userPageInput) ? Math.max((userPageInput || 1) - 1, 0) : 0;
            
            await handleListAddresses(msg, bot, page);
        } catch (error) {
            console.error('Failed to list addresses:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve addresses. Please try again.');
        }
    });

    // Listener 3.7: send (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/send')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing send token command ---');
        try {
            await handleSendCommand(msg, bot);
        } catch (error) {
            console.error('Failed to send tokens:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to send tokens. Please try again.');
        }
    });

    // Listener 3.8: exportdata (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/exportdata')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing export data command ---');
        try {
            await handleExportData(msg, bot);
        } catch (error) {
            console.error('Failed to export data:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to export data. Please try again.');
        }
    });

    // Listener 3.9: importdata (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/importdata')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing import data command ---');
        try {
            await handleImportData(msg, bot);
        } catch (error) {
            console.error('Failed to import data:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to import data. Please try again.');
        }
    });

    // Listener 3.10: whitelisting (all users)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/whitelisting')) {
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing whitelisting command ---');
        try {
            await handleWhitelistingCommand(msg, bot);
        } catch (error) {
            console.error('Failed to process whitelisting:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to submit whitelist request. Please try again.');
        }
    });

    // Listener 3.11: listwhitelist (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/listwhitelist')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing list whitelist command ---');
        try {
            await handleListWhitelistCommand(msg, bot);
        } catch (error) {
            console.error('Failed to list whitelist:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve whitelist. Please try again.');
        }
    });

    // Listener 3.12: removewhitelist (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/removewhitelist')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing remove whitelist command ---');
        try {
            await handleRemoveWhitelistCommand(msg, bot);
        } catch (error) {
            console.error('Failed to remove whitelist keyword:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to remove keyword. Please try again.');
        }
    });

    // Listener 3.13: message (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/message')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing message save command ---');
        try {
            await handleMessageCommand(msg, bot);
        } catch (error) {
            console.error('Failed to save message:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to save message. Please try again.');
        }
    });

    // Listener 3.14: showmessage (admin only, private only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/showmessage')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing show message command ---');
        try {
            await handleShowMessageCommand(msg, bot);
        } catch (error) {
            console.error('Failed to show messages:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve messages. Please try again.');
        }
    });

    // Listener 3.15: deletemessage (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/deletemessage')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing delete message command ---');
        try {
            await handleDeleteMessageCommand(msg, bot);
        } catch (error) {
            console.error('Failed to delete message:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to delete message. Please try again.');
        }
    });

    // Listener 3.16: stopmessage (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/stopmessage')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing stop message command ---');
        try {
            await handleStopMessageCommand(msg, bot);
        } catch (error) {
            console.error('Failed to stop message:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to stop message. Please try again.');
        }
    });

    // Listener 3.17: listscheduled (admin only, private only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/listscheduled')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing list scheduled command ---');
        try {
            await handleListScheduledCommand(msg, bot);
        } catch (error) {
            console.error('Failed to list scheduled messages:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve scheduled messages. Please try again.');
        }
    });

    // Listener 3.18: mission (admin or ecash army group members)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/mission')) {
            return;
        }
        // Check if user is admin or in ecash army group
        const isAdmin = ALLOWED_USERS.includes(msg.from.username);
        const isEcashArmy = String(msg.chat.id) === ECASH_ARMY_GROUP_ID;
        
        if (!isAdmin && !isEcashArmy) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing mission command ---');
        try {
            await handleMissionCommand(msg, bot);
        } catch (error) {
            console.error('Failed to create mission:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to create mission. Please try again.');
        }
    });

    // Listener 3.19: showmission (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/showmission')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing show mission command ---');
        try {
            await handleShowMissionCommand(msg, bot);
        } catch (error) {
            console.error('Failed to show missions:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to retrieve missions. Please try again.');
        }
    });

    // Listener 3.21: deletemission (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text?.startsWith('/deletemission')) {
            return;
        }
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing delete mission command ---');
        try {
            await handleDeleteMissionCommand(msg, bot);
        } catch (error) {
            console.error('Failed to delete mission:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to delete mission. Please try again.');
        }
    });

    // Listener 3.20: mission completion (all users, group only, when replying with ✅ or "done")
    bot.on('message', async (msg) => {
        // Only handle group messages with replies
        const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
        if (!isGroup || !msg.reply_to_message) {
            return;
        }

        // Check if message is ✅ or "done"
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

    // Listener 4: price
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim().toLowerCase();
        const isPriceCommand = text === '/price' || text === `/price@${BOT_USERNAME.toLowerCase()}`;
        if (!isPriceCommand) {
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing price query command ---');
        try {
            const loadingMessage = await bot.sendMessage(msg.chat.id, '📊 Getting latest price data...');
            const priceDto = await handlePriceCommand();
            const priceMessage = renderPriceMessage(priceDto);
            await bot.editMessageText(priceMessage, {
                chat_id: msg.chat.id,
                message_id: loadingMessage.message_id
            });
        } catch (error) {
            console.error('Price query failed:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to get price data. Please try again later.');
        }
    });

    // Listener 5: explorer (address only for now)
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim();
        const lower = text.toLowerCase();
        const isExplorerCommand = lower.startsWith('/explorer') || lower.startsWith(`/explorer@${BOT_USERNAME.toLowerCase()}`);
        if (!isExplorerCommand) {
            return;
        }
        console.log('\n--- Processing explorer query command ---');
        try {
            const parts = text.split(/\s+/);
            if (parts.length < 2) {
                await bot.sendMessage(msg.chat.id, 'Usage: /explorer <address> [page]');
                return;
            }
            const rawQuery = parts[1].trim();
            const userPageInput = parts[2] ? parseInt(parts[2], 10) : 1; // User input is 1-based
            const page = Number.isFinite(userPageInput) ? Math.max((userPageInput || 1) - 1, 0) : 0; // Internal 0-based
            const displayPage = page + 1; // Display still uses 1-based
            const loadingMessage = await bot.sendMessage(msg.chat.id, `🔎 Fetching, page ${displayPage}...`);
            const result = await handleExplorerAddress(rawQuery, page);
            const { renderExplorerMessage } = require('./views/explorerView.js');
            const textResp = renderExplorerMessage(result, page);
            await bot.editMessageText(textResp, {
                chat_id: msg.chat.id,
                message_id: loadingMessage.message_id,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            });
        } catch (error) {
            if (error && error.name === 'InvalidAddressError') {
                await bot.sendMessage(msg.chat.id, '❌ Invalid address. Please check and try again.');
            } else {
                console.error('Explorer query failed:', error.message);
                await bot.sendMessage(msg.chat.id, '❌ Failed to fetch explorer data. Please try again later.');
            }
        }
    });

    // Listener 6: avalanche
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim().toLowerCase();
        const isAvaCommand = text === '/ava' || text === `/ava@${BOT_USERNAME.toLowerCase()}`;
        if (!isAvaCommand) {
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, FEATURE_DISABLED_MSG);
            return;
        }
        console.log('\n--- Processing avalanche query command ---');
        try {
            const loadingMessage = await bot.sendMessage(msg.chat.id, '🗻 Getting latest Avalanche data...');
            const avalancheDto = await handleAvalancheCommand();
            const avalancheMessage = renderAvalancheMessage(avalancheDto);
            await bot.editMessageText(avalancheMessage, {
                chat_id: msg.chat.id,
                message_id: loadingMessage.message_id
            });
        } catch (error) {
            console.error('Avalanche query failed:', error);
            await bot.sendMessage(msg.chat.id, '❌ Failed to get Avalanche data. Please try again later.');
        }
    });

    // Listener 6.2: time conversion
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim();
        const lower = text.toLowerCase();
        const isTimeCommand = lower.startsWith('/time') || lower.startsWith(`/time@${BOT_USERNAME.toLowerCase()}`);
        if (!isTimeCommand) {
            return;
        }
        if (LIMITED_MODE) {
            await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            return;
        }
        console.log('\n--- Processing time command ---');
        
        const countryNames = text.split(/\s+/).slice(1);
        const loadingMessage = await bot.sendMessage(msg.chat.id, '⏰ Getting time...');
        
        const executeTimeCommand = async () => {
            return Promise.race([
                handleTimeCommand(countryNames),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);
        };
        
        let lastError = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
            try {
                const timeData = await executeTimeCommand();
                const timeMessage = renderTimeMessage(timeData);
                
                await bot.editMessageText(timeMessage, {
                    chat_id: msg.chat.id,
                    message_id: loadingMessage.message_id
                });
                return;
            } catch (error) {
                lastError = error;
                console.error(`Time command attempt ${attempt} failed:`, error.message);
                if (attempt < 2) {
                    console.log(`Retrying... (attempt ${attempt + 1}/2)`);
                }
            }
        }
        
        console.error('Time command failed after 2 attempts:', lastError);
        await bot.editMessageText('❌ Try again plesea', {
            chat_id: msg.chat.id,
            message_id: loadingMessage.message_id
        });
    });

    // Listener 6.6: stored message commands (custom /commandname [time]) (admin only)
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        
        // Only handle commands starting with /
        if (!msg.text.startsWith('/')) {
            return;
        }

        // Extract command name and optional time parameter
        const text = msg.text.trim();
        const allParts = text.split(/\s+/);
        const commandPart = allParts[0]; // e.g., "/koush"
        const timeParam = allParts[1] ? allParts[1].trim() : null; // e.g., "0.1h"
        
        let commandName = commandPart.substring(1); // Remove the leading /
        
        // Remove @botname if present
        if (commandName.includes('@')) {
            commandName = commandName.split('@')[0];
        }

        // Skip if it's a known command
        const knownCommands = [
            'report', 'addlicense', 'removelicense', 'listlicenses',
            'signup', 'getaddress', 'listaddresses', 'send',
            'exportdata', 'importdata', 'whitelisting', 'listwhitelist',
            'removewhitelist', 'message', 'showmessage', 'deletemessage',
            'stopmessage', 'listscheduled', 'mission', 'showmission', 'deletemission',
            'start', 'help', 'price', 'ava', 'explorer', 'time', 'translate'
        ];
        
        if (knownCommands.includes(commandName.toLowerCase())) {
            return;
        }

        // Skip if empty command name
        if (!commandName) {
            return;
        }

        if (LIMITED_MODE) {
            return;
        }

        // Check admin permission before processing stored message
        if (!ALLOWED_USERS.includes(msg.from.username)) {
            const { checkStoredMessageExists } = require('../application/usecases/messageHandler.js');
            const exists = await checkStoredMessageExists(commandName);
            if (exists) {
                await bot.sendMessage(msg.chat.id, '❌ This command is only available to administrators.');
            }
            return;
        }

        console.log(`\n--- Checking for stored message command: ${commandName} ${timeParam ? `with time ${timeParam}` : ''} ---`);
        
        try {
            const handled = await handleStoredMessageCommand(msg, bot, commandName, timeParam);
            if (!handled) {
                // Not a stored message, ignore silently
                console.log(`No stored message found for: ${commandName}`);
            }
        } catch (error) {
            console.error('Failed to handle stored message command:', error);
        }
    });

    // Listener 7: main conversation
    bot.on('message', async (msg) => {
        if (!shouldHandleRequest(msg)) {
            return;
        }

        // Limited mode: only allow DM for whitelisted users; allow /explorer everywhere
        if (LIMITED_MODE && !isWhitelistedDMUser(msg)) {
            const isPrivate = msg.chat.type === "private";
            const lower = (msg.text || '').trim().toLowerCase();
            if (isPrivate) {
                if (!lower.startsWith('/explorer')) {
                    await bot.sendMessage(msg.chat.id, pickDisabledMsg());
                }
            } else {
                await bot.sendMessage(msg.chat.id, pickDisabledMsg());
            }
            return;
        }

        // Skip commands handled above
        if (msg.text?.startsWith('/report') ||
            msg.text?.startsWith('/addlicense') ||
            msg.text?.startsWith('/removelicense') ||
            msg.text?.startsWith('/listlicenses') ||
            msg.text?.startsWith('/signup') ||
            msg.text?.startsWith('/getaddress') ||
            msg.text?.startsWith('/listaddresses') ||
            msg.text?.startsWith('/send') ||
            msg.text?.startsWith('/exportdata') ||
            msg.text?.startsWith('/importdata') ||
            msg.text?.startsWith('/whitelisting') ||
            msg.text?.startsWith('/listwhitelist') ||
            msg.text?.startsWith('/removewhitelist') ||
            msg.text?.startsWith('/message') ||
            msg.text?.startsWith('/showmessage') ||
            msg.text?.startsWith('/deletemessage') ||
            msg.text?.startsWith('/stopmessage') ||
            msg.text?.startsWith('/listscheduled') ||
            msg.text?.startsWith('/mission') ||
            msg.text?.startsWith('/showmission') ||
            msg.text?.startsWith('/deletemission') ||
            msg.text?.trim().toLowerCase() === "/start" ||
            msg.text?.trim().toLowerCase() === "/help" ||
            msg.text?.trim().toLowerCase() === "/price" ||
            msg.text?.trim().toLowerCase() === `/price@${BOT_USERNAME.toLowerCase()}` ||
            msg.text?.trim().toLowerCase() === "/ava" ||
            msg.text?.trim().toLowerCase() === `/ava@${BOT_USERNAME.toLowerCase()}` ||
            msg.text?.trim().toLowerCase().startsWith('/explorer') ||
            msg.text?.trim().toLowerCase().startsWith(`/explorer@${BOT_USERNAME.toLowerCase()}`) ||
            msg.text?.trim().toLowerCase().startsWith('/time') ||
            msg.text?.trim().toLowerCase().startsWith(`/time@${BOT_USERNAME.toLowerCase()}`)) {
            return;
        }

        console.log('\n--- Processing conversation request ---');

        let query = msg.caption || msg.text || '';
        query = query
            .replace(`@${BOT_USERNAME}`, "")
            .trim();

        // Replace /translate with "echan please translate to"
        // If replying to a message, include the replied message content
        if (query.includes('/translate')) {
            // First, replace /translate with "echan please translate to"
            query = query.replace(/\/translate/g, 'echan please translate(result only) to');
            
            // If replying to a message, add the replied content
            if (msg.reply_to_message) {
                const repliedText = msg.reply_to_message.text || msg.reply_to_message.caption || '';
                if (repliedText) {
                    // Extract the language specification (everything after "echan please translate to")
                    const languageSpec = query.replace('echan please translate(result only) to', '').trim();
                    // Reconstruct: if language specified, use "to [language]:"; otherwise just "translate:"
                    query = languageSpec 
                        ? `echan please translate(result only) to ${languageSpec}: "${repliedText}"`
                        : `echan please translate(result only): "${repliedText}"`;
                }
            }
        }

        // Add username to query
        const userInfo = msg.from.username ? `[${msg.from.username}]: ` : '';
        query = userInfo + query;

        // Check mention flags
        const textContent = msg.text || msg.caption || '';
        const isDirectMention = textContent.includes(`@${BOT_USERNAME}`);
        const isEchanMention = /\bechan\b/i.test(textContent);

        if (isEchanMention || isDirectMention) {

            // skipNeedsResponseCheck = true for direct @ mentions
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

    // Listener 6.5: check new member usernames
    bot.on('message', async (msg) => {
        if (LIMITED_MODE) {
            return;
        }
        
        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup) {
            return;
        }
        
        // Check for new_chat_members
        if (msg.new_chat_members && msg.new_chat_members.length > 0) {
            console.log('\n--- New members joined ---');
            
            // Check bot admin status first
            try {
                const botInfo = await bot.getMe();
                const botMember = await bot.getChatMember(msg.chat.id, botInfo.id);
                const isBotAdmin = ['creator', 'administrator'].includes(botMember.status);
                
                if (!isBotAdmin) {
                    console.log('Bot is not admin, cannot check new members');
                    return;
                }
                
                // Check each new member
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

    // Listener 7: group spam detection
    bot.on('message', async (msg) => {
        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup) {
            return;
        }

        if (!msg || (!msg.text && !msg.caption && !msg.reply_to_message)) {
            return;
        }

        if (msg.text?.startsWith('/')) {
            return;
        }

        console.log('\n--- Detect group spam ---');
        await processGroupMessage(msg, bot, ports);
    });

    // Listener 8: simple anti-impersonation
    bot.on('message', async (msg) => {
        if (LIMITED_MODE) {
            return;
        }
        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup || !msg.from || !msg.from.username || msg.from.is_bot) {
            return;
        }

        if (msg.text?.startsWith('/')) {
            return;
        }

        console.log('\n--- Detect impersonation ---');

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

    // Listener 9: callback query handler (for whitelist approval/rejection, message operations, and help menu)
    bot.on('callback_query', async (query) => {
        try {
            if (query.data.startsWith('whitelist_')) {
                console.log('\n--- Processing whitelist callback ---');
                await handleWhitelistCallback(query, bot);
            } else if (query.data.startsWith('msg_')) {
                console.log('\n--- Processing message callback ---');
                await handleMessageCallback(query, bot);
            } else if (query.data.startsWith('help_') || query.data.startsWith('cmd_')) {
                console.log('\n--- Processing help menu callback ---');
                const isAdmin = ALLOWED_USERS.includes(query.from.username);
                const menuData = getHelpMenu(query.data, isAdmin);
                
                if (menuData) {
                    await bot.editMessageText(menuData.text, {
                        chat_id: query.message.chat.id,
                        message_id: query.message.message_id,
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: menuData.keyboard
                        }
                    });
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


