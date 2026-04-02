const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');
const { handleReportCommand } = require('../../application/usecases/reportHandler.js');
const {
    handleAddLicense,
    handleRemoveLicense,
    handleListLicenses
} = require('../../application/usecases/licenseHandler.js');
const {
    handleSignup,
    handleGetAddress,
    handleListAddresses,
    handleExportData,
    handleImportData
} = require('../../application/usecases/signupHandler.js');
const { handleSendCommand } = require('../../application/usecases/sendHandler.js');
const {
    handleWhitelistingCommand,
    handleListWhitelistCommand,
    handleRemoveWhitelistCommand
} = require('../../application/usecases/whitelistHandler.js');
const {
    handleMessageCommand,
    handleShowMessageCommand,
    handleDeleteMessageCommand,
    handleStopMessageCommand,
    handleListScheduledCommand
} = require('../../application/usecases/messageHandler.js');
const {
    handleMissionCommand,
    handleShowMissionCommand,
    handleDeleteMissionCommand
} = require('../../application/usecases/missionHandler.js');
const { handlePriceCommand } = require('../../application/usecases/priceHandler.js');
const { renderPriceMessage } = require('../views/priceView.js');
const { handleAvalancheCommand } = require('../../application/usecases/avalancheHandler.js');
const { renderAvalancheMessage } = require('../views/avalancheView.js');
const { handleExplorerAddress } = require('../../application/usecases/explorerHandler.js');
const { ensureUserRecord } = require('../../infrastructure/storage/userAddressStore.js');
const { handleTimeCommand } = require('../../application/usecases/timeHandler.js');
const { renderTimeMessage } = require('../views/timeView.js');
const { getHelpMenu } = require('../views/helpMenuData.js');
const { ALLOWED_USERS, BOT_USERNAME } = require('../../../config/config.js');

/**
 * Command handlers - each handler is a simple async function
 */

async function handleHelp(msg, bot) {
    console.log('\n--- Processing help command ---');
    const isAdmin = ALLOWED_USERS.includes(msg.from.username);
    const menuData = getHelpMenu('help_main', isAdmin);

    await sendPromptMessage(bot, msg.chat.id, menuData.text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: menuData.keyboard
        }
    });
}

async function handleReport(msg, bot) {
    console.log('\n--- Processing report command ---');
    try {
        await handleReportCommand(msg, bot);
    } catch (error) {
        console.error('Failed to process report:', error);
        await sendPromptMessage(bot, msg.chat.id, "You can try replying to spam messages and use the /report function.");
    }
}

async function handleAddLicenseCommand(msg, bot) {
    console.log('\n--- Processing add license command ---');
    try {
        await handleAddLicense(msg, bot);
    } catch (error) {
        console.error('Failed to add license:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to add license. Please try again.');
    }
}

async function handleRemoveLicenseCommand(msg, bot) {
    console.log('\n--- Processing remove license command ---');
    try {
        await handleRemoveLicense(msg, bot);
    } catch (error) {
        console.error('Failed to remove license:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to remove license. Please try again.');
    }
}

async function handleListLicensesCommand(msg, bot) {
    console.log('\n--- Processing list licenses command ---');
    try {
        await handleListLicenses(msg, bot);
    } catch (error) {
        console.error('Failed to list licenses:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to list licenses. Please try again.');
    }
}

async function handleSignupCommand(msg, bot) {
    console.log('\n--- Processing user signup command ---');
    try {
        await handleSignup(msg, bot);
    } catch (error) {
        console.error('Failed to process signup:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to register address. Please try again.');
    }
}

async function handleGetAddressCommand(msg, bot) {
    console.log('\n--- Processing get address command ---');
    try {
        await handleGetAddress(msg, bot);
    } catch (error) {
        console.error('Failed to get address:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to retrieve address. Please try again.');
    }
}

async function handleListAddressesCommand(msg, bot) {
    console.log('\n--- Processing list addresses command ---');
    try {
        const parts = msg.text.trim().split(/\s+/);
        const userPageInput = parts[1] ? parseInt(parts[1], 10) : 1;
        const page = Number.isFinite(userPageInput) ? Math.max((userPageInput || 1) - 1, 0) : 0;

        await handleListAddresses(msg, bot, page);
    } catch (error) {
        console.error('Failed to list addresses:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to retrieve addresses. Please try again.');
    }
}

async function handleSend(msg, bot) {
    console.log('\n--- Processing send token command ---');
    try {
        await handleSendCommand(msg, bot);
    } catch (error) {
        console.error('Failed to send tokens:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to send tokens. Please try again.');
    }
}

async function handleExport(msg, bot) {
    console.log('\n--- Processing export data command ---');
    try {
        await handleExportData(msg, bot);
    } catch (error) {
        console.error('Failed to export data:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to export data. Please try again.');
    }
}

async function handleImport(msg, bot) {
    console.log('\n--- Processing import data command ---');
    try {
        await handleImportData(msg, bot);
    } catch (error) {
        console.error('Failed to import data:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to import data. Please try again.');
    }
}

async function handleWhitelisting(msg, bot) {
    console.log('\n--- Processing whitelisting command ---');
    try {
        await handleWhitelistingCommand(msg, bot);
    } catch (error) {
        console.error('Failed to process whitelisting:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to submit whitelist request. Please try again.');
    }
}

async function handleListWhitelist(msg, bot) {
    console.log('\n--- Processing list whitelist command ---');
    try {
        await handleListWhitelistCommand(msg, bot);
    } catch (error) {
        console.error('Failed to list whitelist:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to retrieve whitelist. Please try again.');
    }
}

async function handleRemoveWhitelist(msg, bot) {
    console.log('\n--- Processing remove whitelist command ---');
    try {
        await handleRemoveWhitelistCommand(msg, bot);
    } catch (error) {
        console.error('Failed to remove whitelist keyword:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to remove keyword. Please try again.');
    }
}

async function handleMessage(msg, bot) {
    console.log('\n--- Processing message save command ---');
    try {
        await handleMessageCommand(msg, bot);
    } catch (error) {
        console.error('Failed to save message:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to save message. Please try again.');
    }
}

async function handleShowMessage(msg, bot) {
    console.log('\n--- Processing show message command ---');
    try {
        await handleShowMessageCommand(msg, bot);
    } catch (error) {
        console.error('Failed to show messages:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to retrieve messages. Please try again.');
    }
}

async function handleDeleteMessage(msg, bot) {
    console.log('\n--- Processing delete message command ---');
    try {
        await handleDeleteMessageCommand(msg, bot);
    } catch (error) {
        console.error('Failed to delete message:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to delete message. Please try again.');
    }
}

async function handleStopMessage(msg, bot) {
    console.log('\n--- Processing stop message command ---');
    try {
        await handleStopMessageCommand(msg, bot);
    } catch (error) {
        console.error('Failed to stop message:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to stop message. Please try again.');
    }
}

async function handleListScheduled(msg, bot) {
    console.log('\n--- Processing list scheduled command ---');
    try {
        await handleListScheduledCommand(msg, bot);
    } catch (error) {
        console.error('Failed to list scheduled messages:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to retrieve scheduled messages. Please try again.');
    }
}

async function handleMission(msg, bot) {
    console.log('\n--- Processing mission command ---');
    try {
        await handleMissionCommand(msg, bot);
    } catch (error) {
        console.error('Failed to create mission:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to create mission. Please try again.');
    }
}

async function handleShowMission(msg, bot) {
    console.log('\n--- Processing show mission command ---');
    try {
        await handleShowMissionCommand(msg, bot);
    } catch (error) {
        console.error('Failed to show missions:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to retrieve missions. Please try again.');
    }
}

async function handleDeleteMission(msg, bot) {
    console.log('\n--- Processing delete mission command ---');
    try {
        await handleDeleteMissionCommand(msg, bot);
    } catch (error) {
        console.error('Failed to delete mission:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to delete mission. Please try again.');
    }
}

async function handlePrice(msg, bot) {
    console.log('\n--- Processing price query command ---');
    try {
        const priceDto = await handlePriceCommand();
        const priceMessage = renderPriceMessage(priceDto);
        await sendPromptMessage(bot, msg.chat.id, priceMessage, { disableAutoDelete: true });
    } catch (error) {
        console.error('Price query failed:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to get price data. Please try again later.');
    }
}

async function handleExplorer(msg, bot) {
    console.log('\n--- Processing explorer query command ---');
    try {
        const parts = msg.text.split(/\s+/);
        if (parts.length < 2) {
            await sendPromptMessage(bot, msg.chat.id, 'Usage: /explorer <address> [page]');
            return;
        }
        const rawQuery = parts[1].trim();
        const userPageInput = parts[2] ? parseInt(parts[2], 10) : 1;
        const page = Number.isFinite(userPageInput) ? Math.max((userPageInput || 1) - 1, 0) : 0;
        const displayPage = page + 1;
        const loadingMessage = await sendPromptMessage(bot, msg.chat.id, `🔎 Fetching, page ${displayPage}...`);
        const result = await handleExplorerAddress(rawQuery, page);
        const { renderExplorerMessage } = require('../views/explorerView.js');
        const textResp = renderExplorerMessage(result, page);
        await bot.editMessageText(textResp, {
            chat_id: msg.chat.id,
            message_id: loadingMessage.message_id,
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    } catch (error) {
        if (error && error.name === 'InvalidAddressError') {
            await sendPromptMessage(bot, msg.chat.id, '❌ Invalid address. Please check and try again.');
        } else {
            console.error('Explorer query failed:', error.message);
            await sendPromptMessage(bot, msg.chat.id, '❌ Failed to fetch explorer data. Please try again later.');
        }
    }
}

async function handleWallet(msg, bot) {
    console.log('\n--- Processing my wallet command ---');
    try {
        const userData = await ensureUserRecord(msg.from.id, msg.from.username || msg.from.first_name || null);
        const registeredAddress = userData?.address;
        const depositAddress = userData?.depositAddress;
        const dbBalance = Number.isFinite(userData?.balance) ? userData.balance : 20;

        if (!registeredAddress) {
            await sendPromptMessage(
                bot,
                msg.chat.id,
                '❌ You have not registered an address yet.\n\nUse /signup <ecash_address> first.'
            );
            return;
        }

        const walletText =
            '👛 *My Wallet*\n\n' +
            `📍 Signup Address: \`${registeredAddress}\`\n` +
            `📦 Deposit Address: \`${depositAddress || 'Not assigned yet'}\`\n` +
            `💾 DB Balance: *${dbBalance}*`;

        await sendPromptMessage(bot, msg.chat.id, walletText, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('My wallet query failed:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to fetch your wallet data. Please try again later.');
    }
}

async function handleAvalanche(msg, bot) {
    console.log('\n--- Processing avalanche query command ---');
    try {
        const avalancheDto = await handleAvalancheCommand();
        const avalancheMessage = renderAvalancheMessage(avalancheDto);
        await sendPromptMessage(bot, msg.chat.id, avalancheMessage);
    } catch (error) {
        console.error('Avalanche query failed:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ Failed to get Avalanche data. Please try again later.');
    }
}

async function handleTime(msg, bot) {
    console.log('\n--- Processing time command ---');

    const countryNames = msg.text.split(/\s+/).slice(1);
    const loadingMessage = await sendPromptMessage(bot, msg.chat.id, '⏰ Getting time...');

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
    await bot.editMessageText('❌ Try again please', {
        chat_id: msg.chat.id,
        message_id: loadingMessage.message_id
    });
}

module.exports = {
    handleHelp,
    handleReport,
    handleAddLicenseCommand,
    handleRemoveLicenseCommand,
    handleListLicensesCommand,
    handleSignupCommand,
    handleGetAddressCommand,
    handleListAddressesCommand,
    handleSend,
    handleExport,
    handleImport,
    handleWhitelisting,
    handleListWhitelist,
    handleRemoveWhitelist,
    handleMessage,
    handleShowMessage,
    handleDeleteMessage,
    handleStopMessage,
    handleListScheduled,
    handleMission,
    handleShowMission,
    handleDeleteMission,
    handlePrice,
    handleExplorer,
    handleWallet,
    handleAvalanche,
    handleTime
};
