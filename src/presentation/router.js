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

// Help messages
const userHelpMessage = `
Welcome to alitayinGPTbot! Here is a list of available commands:

### For All Users:
You can @echan or mention echan in your message to start a conversation with the GPT bot.

/signup <address> - Register your eCash address
/price - Get current eCash price data
/explorer <address> [page] - Query address transactions
/time [location/utc] - World time (e.g. /time or /time shanghai utc+8)
/whitelisting <keyword> - Request to whitelist a keyword (bypasses spam detection)

If you have any questions, please contact the admin.
`;

const adminHelpMessage = `
Welcome to alitayinGPTbot! Here is a list of available commands for admins:

### For Admins (Allowed Users):
/addlicense @username - Give a user permission to use /report
/removelicense @username - Remove /report permission from a user
/listlicenses - View all users with /report permission
/getaddress @username - Query user's registered eCash address
/listaddresses [page] - View all registered eCash addresses (paginated, 20 per page)
/send <amount> - Send XEC to user (reply to their message)
/send <tokenId> <amount> - Send SLP tokens to user (reply to their message)
/exportdata - Export all user data to JSON file (for backup/migration)
/importdata - Import user data from JSON file (reply to exported file)
/listwhitelist - View all whitelisted keywords
/removewhitelist <keyword> - Remove a keyword from the whitelist
`;

// Helper: should handle request
function shouldHandleRequest(msg) {
    let textContent = msg.text || msg.caption || '';
    const echanRegex = /\bechan\b/i;
    
    // Check if replying to a translation message - if so, don't handle
    if (msg.reply_to_message && 
        msg.reply_to_message.from.username === BOT_USERNAME &&
        msg.reply_to_message.text?.startsWith('🔄 Translation:')) {
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
        const helpMessage = ALLOWED_USERS.includes(msg.from.username) ? adminHelpMessage : userHelpMessage;
        await bot.sendMessage(msg.chat.id, helpMessage);
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
            console.log('🔍 Checking if message needs response');
            const prep = await prepareConversationQuery(ports, query, msg.from.id);
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

    // Listener 9: callback query handler (for whitelist approval/rejection)
    bot.on('callback_query', async (query) => {
        try {
            if (query.data.startsWith('whitelist_')) {
                console.log('\n--- Processing whitelist callback ---');
                await handleWhitelistCallback(query, bot);
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


