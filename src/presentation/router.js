const {
    BOT_USERNAME,
    ALLOWED_USERS,
    BLOCKED_USERS,
    DATA_KEYWORDS,
} = require('../../config/config.js');
const mods = require('../../config/mods.json');
const REPORTERS = mods.reporters;
const { isGroupWithAlitayin } = require('../infrastructure/telegram/groupUtils.js');
const {
    addMessageToGroup,
    addBotMessageToGroup,
    getFormattedContext,
    isGroupMessage
} = require('../infrastructure/storage/groupMessageStorage.js');

const { handleRequestIfAllowed, handlePhotoMessage } = require('../application/usecases/conversationHandler.js');
const { processGroupMessage } = require('../application/usecases/spamHandler.js');
const { handleAdminCommands } = require('../application/usecases/adminCommands.js');
const { prepareConversationQuery, injectNetworkDataIfKeyword } = require('../application/usecases/externalDataHandler.js');
const { createPorts } = require('./portsFactory.js');
const { checkImpersonation, handleImpersonation } = require('../application/usecases/antiImpersonationHandler.js');
const { handlePriceCommand } = require('../application/usecases/priceHandler.js');
const { renderPriceMessage } = require('./views/priceView.js');
const { handleReportCommand } = require('../application/usecases/reportHandler.js');
const { handleAvalancheCommand } = require('../application/usecases/avalancheHandler.js');
const { renderAvalancheMessage } = require('./views/avalancheView.js');
const { handleExplorerAddress } = require('../application/usecases/explorerHandler.js');

// Help messages
const userHelpMessage = `
Welcome to alitayinGPTbot! Here is a list of available commands:

### For All Users:
You can @echan or mention echan in your message to start a conversation with the GPT bot.

If you have any questions, please contact the admin.
`;

const adminHelpMessage = `
Welcome to alitayinGPTbot! Here is a list of available commands for admins:

### For Admins (Allowed Users):
/addmod <username> - Add a new moderator
/removemod <username> - Remove a moderator
/send <address> <amount> - Send a transaction
/usecli <command> - Execute CLI commands
`;

// Helper: should handle request
function shouldHandleRequest(msg) {
    let textContent = msg.text || msg.caption || '';
    const echanRegex = /\bechan\b/i;
    return (msg.reply_to_message && msg.reply_to_message.from.username === BOT_USERNAME) ||
           (textContent.includes(`@${BOT_USERNAME}`) || echanRegex.test(textContent)) ||
           (msg.chat.type === "private");
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
        if (!msg.text?.startsWith('/report') || !REPORTERS.includes(msg.from.username)) {
            return;
        }
        console.log('\n--- 处理举报命令 ---');
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
        console.log('\n--- 处理帮助命令 ---');
        const helpMessage = ALLOWED_USERS.includes(msg.from.username) ? adminHelpMessage : userHelpMessage;
        await bot.sendMessage(msg.chat.id, helpMessage);
    });

    // Listener 4: price
    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const text = msg.text.trim().toLowerCase();
        const isPriceCommand = text === '/price' || text === `/price@${BOT_USERNAME.toLowerCase()}`;
        if (!isPriceCommand) {
            return;
        }
        console.log('\n--- 处理价格查询命令 ---');
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
        console.log('\n--- 处理Explorer查询命令 ---');
        try {
            const parts = text.split(/\s+/);
            if (parts.length < 2) {
                await bot.sendMessage(msg.chat.id, '用法：/explorer <地址> [页码]');
                return;
            }
            const rawQuery = parts[1].trim();
            const userPageInput = parts[2] ? parseInt(parts[2], 10) : 1; // 用户1基
            const page = Number.isFinite(userPageInput) ? Math.max((userPageInput || 1) - 1, 0) : 0; // 内部0基
            const displayPage = page + 1; // 显示仍用1基
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
        console.log('\n--- 处理Avalanche查询命令 ---');
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

    // Listener 7: main conversation
    bot.on('message', async (msg) => {
        if (!shouldHandleRequest(msg)) {
            return;
        }

        // Skip commands handled above
        if (msg.text?.startsWith('/report') ||
            msg.text?.trim().toLowerCase() === "/start" ||
            msg.text?.trim().toLowerCase() === "/help" ||
            msg.text?.trim().toLowerCase() === "/price" ||
            msg.text?.trim().toLowerCase() === `/price@${BOT_USERNAME.toLowerCase()}` ||
            msg.text?.trim().toLowerCase() === "/ava" ||
            msg.text?.trim().toLowerCase() === `/ava@${BOT_USERNAME.toLowerCase()}` ||
            msg.text?.trim().toLowerCase().startsWith('/explorer') ||
            msg.text?.trim().toLowerCase().startsWith(`/explorer@${BOT_USERNAME.toLowerCase()}`)) {
            return;
        }

        console.log('\n--- 处理对话请求 ---');

        let query = msg.caption || msg.text || '';
        query = query
            .replace(`@${BOT_USERNAME}`, "")
            .trim();

        // Add username to query
        const userInfo = msg.from.username ? `[${msg.from.username}]: ` : '';
        query = userInfo + query;

        // Check mention flags
        const textContent = msg.text || msg.caption || '';
        const isDirectMention = textContent.includes(`@${BOT_USERNAME}`);
        const isEchanMention = /\bechan\b/i.test(textContent);

        if (isEchanMention || isDirectMention) {
            console.log('🔍 检查消息是否需要回复');
            const prep = await prepareConversationQuery(ports, query, msg.from.id);
            if (!prep.shouldRespond) {
                return;
            }
            query = prep.query;
        }

        // Add previous context (group)
        if (isGroupMessage(msg)) {
            const context = getFormattedContext(msg.chat.id, msg.message_id, BOT_USERNAME);
            if (context) {
                query = `Previous context:\n${context}\n\nCurrent message:\n${query}`;
            }
        }

        // Inject network data if keyword
        query = await injectNetworkDataIfKeyword(query, DATA_KEYWORDS, 3000);

        // Admin commands
        if (ALLOWED_USERS.includes(msg.from.username)) {
            const isAdminCommand = await handleAdminCommands(msg, query, bot);
            if (isAdminCommand) {
                return;
            }
        }

        // Handle different message types
        if (msg.photo && msg.photo.length > 0) {
            console.log('🖼️ 处理图片消息');
            if (!query) {
                query = "Describe this image";
            }
            const photo = msg.photo[msg.photo.length - 1];
            handlePhotoMessage(msg, photo, query, bot, ALLOWED_USERS, BLOCKED_USERS, ports);
        } else if (msg.text) {
            console.log('💭 处理文本对话');
            handleRequestIfAllowed(msg, query, bot, ALLOWED_USERS, BLOCKED_USERS, ports);
        }
    });

    // Listener 7: group spam detection
    bot.on('message', async (msg) => {
        const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
        if (!isGroup) {
            return;
        }

        if (!msg || (!msg.text && !msg.caption)) {
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
}

module.exports = {
    registerRoutes,
};


