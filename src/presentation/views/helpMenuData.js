// Help menu data and accessors for inline keyboard navigation
const helpMenuData = {
    main: {
        user: {
            text: '🤖 <b>alitayinGPTbot</b>\n\nWelcome! Click on a command to see details:',
            keyboard: [
                [{ text: '📝 /signup - Register Address', callback_data: 'cmd_signup' }],
                [{ text: '👛 /mywallet - My Wallet', callback_data: 'cmd_mywallet' }],
                [{ text: '💵 /price - Price Query', callback_data: 'cmd_price' }],
                [{ text: '🔍 /explorer - Address Query', callback_data: 'cmd_explorer' }],
                [{ text: '⏰ /time - World Time', callback_data: 'cmd_time' }],
                [{ text: '🌐 /translate - Translation', callback_data: 'cmd_translate' }],
                [{ text: '🧰 /chronik - Chronik MCP', callback_data: 'cmd_chronik' }],
                [{ text: '✅ /whitelisting - Keyword Whitelist', callback_data: 'cmd_whitelisting' }],
                [{ text: '📖 Learn to use /help with LLM', callback_data: 'cmd_learnhelp' }]
            ]
        },
        admin: {
            text: '👑 <b>Admin Control Panel</b>\n\nSelect a category:',
            keyboard: [
                [{ text: '👮 Mods Add & Remove', callback_data: 'help_mods' }],
                [{ text: '👥 Community User Management', callback_data: 'help_users' }],
                [{ text: '🛡️ Protection Control', callback_data: 'help_protection' }],
                [{ text: '💸 Send XEC/SLP/ALP', callback_data: 'help_send' }],
                [{ text: '📦 User Data Import/Export', callback_data: 'help_data' }],
                [{ text: '🛡️ Whitelist Keywords', callback_data: 'help_whitelist' }],
                [{ text: '🎯 Community Missions', callback_data: 'help_missions' }],
                [{ text: '💾 Message Templates & Scheduling', callback_data: 'help_messages' }],
                [{ text: '📖 Learn to use /help with LLM', callback_data: 'cmd_learnhelp' }]
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
        help_protection: {
            text: '🛡️ <b>Protection Control</b>\n\nProtection is global, persistent, and disabled by default. These commands only work in a private chat with the bot:',
            keyboard: [
                [{ text: '/protectionstatus', callback_data: 'cmd_protectionstatus' }],
                [{ text: '/enableprotection', callback_data: 'cmd_enableprotection' }],
                [{ text: '/disableprotection', callback_data: 'cmd_disableprotection' }],
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
                [{ text: '➕ /whitelisting - Add Keyword', callback_data: 'cmd_whitelisting' }],
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
            text: '📝 <b>/signup</b>\n\nRegister your eCash address and get a deposit address.\n\n<b>Usage:</b>\n<code>/signup ecash:qp...</code>\n\n<b>Note:</b>\nA deposit address is always assigned by the bot after you register your address.',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
        },
        cmd_mywallet: {
            text: '👛 <b>/mywallet</b>\n\nQuery your signup address, deposit address, and database balance.\n\n<b>Usage:</b>\n<code>/mywallet</code>\n\n<b>Note:</b>\nPlease register first with <code>/signup ecash:qp...</code>.',
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
        cmd_chronik: {
            text: '🧰 <b>/chronik</b>\n\nCall eCash MCP (Chronik) via natural language.\n\n<b>Usage:</b>\n<code>/chronik get the latest block hash</code>\n<code>/mcp get the coinbase string from block &lt;hash&gt;</code>\n\n<b>Note:</b>\nReturns raw JSON from the MCP tool',
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
        cmd_protectionstatus: {
            text: '🛡️ <b>/protectionstatus</b>\n\nShow the global protection state.\n\n<b>Note:</b>\nAdmin only; private chat only.',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_protection' }]]
        },
        cmd_enableprotection: {
            text: '🛡️ <b>/enableprotection</b>\n\nEnable spam, newcomer, flood, and impersonation protection globally.\n\n<b>Note:</b>\nAdmin only; private chat only.',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_protection' }]]
        },
        cmd_disableprotection: {
            text: '🛡️ <b>/disableprotection</b>\n\nDisable all automatic and manual protection features globally. Translation and LLM replies stay active.\n\n<b>Note:</b>\nAdmin only; private chat only.',
            keyboard: [[{ text: '🔙 Back', callback_data: 'help_protection' }]]
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
        },
        cmd_learnhelp: {
            text: '📖 <b>Learn to use /help with LLM</b>\n\nInclude <code>/help</code> in your question so echan can show all commands in context.\n\nExample:\n<code>hi echan, how to use /help?</code>\n\nYou can also tap /help directly to get the menu.',
            keyboard: [[{ text: '🔙 Back to Menu', callback_data: 'help_main' }]]
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

module.exports = { helpMenuData, getHelpMenu };

