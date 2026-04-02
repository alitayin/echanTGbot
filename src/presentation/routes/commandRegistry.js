const { CommandRouter } = require('../middleware/commandRouter.js');
const { createAuthMiddleware, createLimitedModeMiddleware } = require('../middleware/authMiddleware.js');
const { ALLOWED_USERS, ECASH_ARMY_GROUP_ID, BOT_USERNAME } = require('../../../config/config.js');
const { getReporters } = require('../../application/usecases/licenseHandler.js');
const {
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
} = require('./commandHandlers.js');

const LIMITED_MODE = false;
const FEATURE_DISABLED_MSGS = [
    "I'm resting. When I wake up, will the Earth be any different?",
    "I can't talk to you for now; the Earth's signal is too weak..",
    "I'm listening to the silence; your voice is somewhere behind the static.",
    "I tried to reach you, but the signal dissolved into the void.",
    "I can't answer right now; the cosmos is louder than your words."
];

/**
 * Create and configure command router with all commands
 */
function createCommandRouter() {
    const router = new CommandRouter();

    // Create middleware instances
    const adminAuth = createAuthMiddleware({ requireAdmin: true });
    const limitedMode = createLimitedModeMiddleware(LIMITED_MODE, FEATURE_DISABLED_MSGS);

    // Custom auth for /report - allow admins or reporters
    const reportAuth = createAuthMiddleware({
        customCheck: async (msg, bot) => {
            // Check if user is admin or creator
            try {
                const member = await bot.getChatMember(msg.chat.id, msg.from.id);
                if (['creator', 'administrator'].includes(member.status)) {
                    return true;
                }
            } catch (err) {
                console.warn('getChatMember check failed:', err.message);
            }

            // Check if user has reporter license
            const reporters = await getReporters();
            return reporters.includes(msg.from.username);
        }
    });

    // Custom auth for /mission - allow admins or ecash army group
    const missionAuth = createAuthMiddleware({
        customCheck: async (msg, bot) => {
            const isAdmin = ALLOWED_USERS.includes(msg.from.username);
            const isEcashArmy = String(msg.chat.id) === ECASH_ARMY_GROUP_ID;
            return isAdmin || isEcashArmy;
        }
    });

    // Register commands with middleware chains

    // Help commands
    router.command('/start', limitedMode, handleHelp);
    router.command('/help', limitedMode, handleHelp);

    // Report command (special auth)
    router.command('/report*', reportAuth, limitedMode, handleReport);

    // License management (admin only)
    router.command('/addlicense*', adminAuth, limitedMode, handleAddLicenseCommand);
    router.command('/removelicense*', adminAuth, limitedMode, handleRemoveLicenseCommand);
    router.command('/listlicenses*', adminAuth, limitedMode, handleListLicensesCommand);

    // User signup (all users)
    router.command('/signup*', limitedMode, handleSignupCommand);

    // Address management (admin only)
    router.command('/getaddress*', adminAuth, limitedMode, handleGetAddressCommand);
    router.command('/listaddresses*', adminAuth, limitedMode, handleListAddressesCommand);

    // Token operations (admin only)
    router.command('/send*', adminAuth, limitedMode, handleSend);

    // Data import/export (admin only)
    router.command('/exportdata*', adminAuth, limitedMode, handleExport);
    router.command('/importdata*', adminAuth, limitedMode, handleImport);

    // Whitelisting (all users for request, admin for management)
    router.command('/whitelisting*', limitedMode, handleWhitelisting);
    router.command('/listwhitelist*', adminAuth, limitedMode, handleListWhitelist);
    router.command('/removewhitelist*', adminAuth, limitedMode, handleRemoveWhitelist);

    // Message management (admin only)
    router.command('/message*', adminAuth, limitedMode, handleMessage);
    router.command('/showmessage*', adminAuth, limitedMode, handleShowMessage);
    router.command('/deletemessage*', adminAuth, limitedMode, handleDeleteMessage);
    router.command('/stopmessage*', adminAuth, limitedMode, handleStopMessage);
    router.command('/listscheduled*', adminAuth, limitedMode, handleListScheduled);

    // Mission management (special auth)
    router.command('/mission*', missionAuth, limitedMode, handleMission);
    router.command('/showmission*', adminAuth, limitedMode, handleShowMission);
    router.command('/deletemission*', adminAuth, limitedMode, handleDeleteMission);

    // Public query commands
    router.command(new RegExp(`^/price(@${BOT_USERNAME.toLowerCase()})?$`, 'i'), limitedMode, handlePrice);
    router.command(new RegExp(`^/explorer(@${BOT_USERNAME.toLowerCase()})?`, 'i'), handleExplorer);
    router.command(new RegExp(`^/wallet(@${BOT_USERNAME.toLowerCase()})?$`, 'i'), limitedMode, handleWallet);
    router.command(new RegExp(`^/ava(@${BOT_USERNAME.toLowerCase()})?$`, 'i'), limitedMode, handleAvalanche);
    router.command(new RegExp(`^/time(@${BOT_USERNAME.toLowerCase()})?`, 'i'), limitedMode, handleTime);

    return router;
}

module.exports = { createCommandRouter, LIMITED_MODE, FEATURE_DISABLED_MSGS };
