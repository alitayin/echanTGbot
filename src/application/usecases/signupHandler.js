const { ensureAddressWithFallback, InvalidAddressError } = require('../../infrastructure/blockchain/addressUtils.js');
const { saveUserAddress, getUserAddress } = require('../../infrastructure/storage/userAddressStore.js');
const { escapeMarkdown } = require('../../domain/formatting/markdown.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

async function handleSignup(msg, bot) {
    const parts = msg.text.trim().split(/\s+/);
    
    if (parts.length < 2) {
        await sendPromptMessage(
            msg.chat.id, 
            '❌ Usage: /signup <ecash_address>\n\nExample:\n/signup ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035'
        );
        return;
    }

    const rawAddress = parts[1].trim();
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'unknown';

    try {
        const validAddress = ensureAddressWithFallback(rawAddress);
        
        const existingData = await getUserAddress(userId);
        
        const success = await saveUserAddress(userId, validAddress, username);
        
        if (success) {
            if (existingData) {
                await sendPromptMessage(
                    msg.chat.id, 
                    `✅ Your eCash address has been updated!\n\n📍 Address: \`${validAddress}\``,
                    { parse_mode: 'Markdown' }
                );
                console.log(`Address updated for @${username} (${userId}): ${validAddress}`);
            } else {
                await sendPromptMessage(
                    msg.chat.id, 
                    `✅ Your eCash address has been registered successfully!\n\n📍 Address: \`${validAddress}\``,
                    { parse_mode: 'Markdown' }
                );
                console.log(`New address registered for @${username} (${userId}): ${validAddress}`);
            }
        } else {
            await sendPromptMessage(msg.chat.id, '❌ Failed to save your address. Please try again later.');
        }
    } catch (error) {
        if (error instanceof InvalidAddressError || error.name === 'InvalidAddressError') {
            await sendPromptMessage(
                msg.chat.id, 
                '❌ Invalid eCash address. Please check your address and try again.\n\nAccepted formats:\n- ecash:qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035\n- qz2708636snqhsxu8wnlka78h6fdp77ar59jrf5035'
            );
            console.log(`Invalid address attempt by @${username} (${userId}): ${rawAddress}`);
        } else {
            console.error('Error in handleSignup:', error);
            await sendPromptMessage(msg.chat.id, '❌ An error occurred. Please try again later.');
        }
    }
}

async function handleGetAddress(msg, bot) {
    const parts = msg.text.trim().split(/\s+/);
    
    if (parts.length < 2) {
        await sendPromptMessage(
            msg.chat.id, 
            '❌ Usage: /getaddress @username\n\nExample:\n/getaddress @alice'
        );
        return;
    }

    const targetUsername = parts[1].replace('@', '').trim();
    
    try {
        const { getAllUsers } = require('../../infrastructure/storage/userAddressStore.js');
        const allUsers = await getAllUsers();
        
        const userData = allUsers.find(user => 
            user.username && user.username.toLowerCase() === targetUsername.toLowerCase()
        );
        
        if (!userData) {
            await sendPromptMessage(
                msg.chat.id, 
                `❌ No registered address found for @${escapeMarkdown(targetUsername)}.\n\nThe user may not have registered yet, or the username doesn't match our records.`,
                { parse_mode: 'Markdown' }
            );
            return;
        }

        await sendPromptMessage(
            msg.chat.id,
            `📋 Address for @${escapeMarkdown(userData.username)}:\n\n` +
            `📍 Address: \`${userData.address}\`\n` +
            `👤 User ID: \`${userData.userId}\`\n` +
            `📅 Registered: ${new Date(userData.createdAt).toLocaleString()}\n` +
            `🔄 Last updated: ${new Date(userData.updatedAt).toLocaleString()}`,
            { parse_mode: 'Markdown' }
        );
        
        console.log(`Address queried: @${userData.username} by @${msg.from.username}`);
    } catch (error) {
        console.error('Error in handleGetAddress:', error);
        await sendPromptMessage(msg.chat.id, '❌ Failed to retrieve address. Please try again later.');
    }
}

async function handleListAddresses(msg, bot, page = 0) {
    const ITEMS_PER_PAGE = 20;
    
    try {
        const { getAllUsers } = require('../../infrastructure/storage/userAddressStore.js');
        const allUsers = await getAllUsers();
        
        if (allUsers.length === 0) {
            await sendPromptMessage(msg.chat.id, '📋 No users have registered their addresses yet.');
            return;
        }

        allUsers.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        const totalPages = Math.ceil(allUsers.length / ITEMS_PER_PAGE);
        const currentPage = Math.max(0, Math.min(page, totalPages - 1));
        const startIndex = currentPage * ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, allUsers.length);
        const pageUsers = allUsers.slice(startIndex, endIndex);
        
        const displayPage = currentPage + 1;
        let message = `📋 Registered Addresses (${allUsers.length} total)\n`;
        message += `📄 Page ${displayPage} of ${totalPages}\n\n`;
        
        pageUsers.forEach((user, index) => {
            const globalIndex = startIndex + index + 1;
            const displayUsername = escapeMarkdown(user.username || 'unknown');
            message += `${globalIndex}. @${displayUsername} (ID: ${user.userId})\n`;
            message += `\`${user.address}\`\n`;
            message += `📅 ${new Date(user.createdAt).toLocaleDateString()}\n\n`;
        });
        
        if (totalPages > 1) {
            message += `\n💡 Use /listaddresses <page> to view other pages\n`;
            if (currentPage > 0) {
                message += `   ← Previous: /listaddresses ${currentPage}\n`;
            }
            if (currentPage < totalPages - 1) {
                message += `   → Next: /listaddresses ${currentPage + 2}\n`;
            }
        }
        
        await sendPromptMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
        
        console.log(`Address list (page ${displayPage}/${totalPages}) viewed by @${msg.from.username}`);
    } catch (error) {
        console.error('Error in handleListAddresses:', error);
        await sendPromptMessage(msg.chat.id, '❌ Failed to retrieve address list. Please try again later.');
    }
}

async function handleExportData(msg, bot) {
    try {
        const { exportAllData } = require('../../infrastructure/storage/userAddressStore.js');
        
        await sendPromptMessage(msg.chat.id, '📦 Exporting user data...');
        
        const jsonData = await exportAllData();
        
        // Send as file
        const buffer = Buffer.from(jsonData, 'utf-8');
        const filename = `xecbot-users-export-${new Date().toISOString().split('T')[0]}.json`;
        
        await bot.sendDocument(
            msg.chat.id,
            buffer,
            {},
            {
                filename: filename,
                contentType: 'application/json'
            }
        );
        
        const data = JSON.parse(jsonData);
        await sendPromptMessage(
            msg.chat.id,
            `✅ Export completed!\n\n` +
            `📊 Users: ${data.totalUsers}\n` +
            `💾 Templates: ${data.totalMessages ?? 0}\n` +
            `⏰ Scheduled: ${data.totalScheduledMessages ?? 0}\n` +
            `✅ Trusted: ${data.totalTrustedRecords ?? 0}\n` +
            `📅 Export date: ${new Date(data.exportDate).toLocaleString()}\n\n` +
            `💡 To import this data on another server, use:\n/importdata (reply to the exported file)`
        );
        
        console.log(`Data exported by @${msg.from.username}: ${data.totalUsers} users`);
    } catch (error) {
        console.error('Error in handleExportData:', error);
        await sendPromptMessage(msg.chat.id, '❌ Failed to export data. Please try again later.');
    }
}

async function handleImportData(msg, bot) {
    try {
        // Check if replying to a document
        if (!msg.reply_to_message || !msg.reply_to_message.document) {
            await sendPromptMessage(
                msg.chat.id,
                '❌ Usage: Reply to an exported JSON file with /importdata\n\n⚠️ Warning: This will add/update users in the database. Existing users with the same ID will be updated.'
            );
            return;
        }

        const document = msg.reply_to_message.document;
        
        // Check file type
        if (!document.file_name.endsWith('.json')) {
            await sendPromptMessage(msg.chat.id, '❌ Please reply to a JSON file exported by /exportdata');
            return;
        }

        await sendPromptMessage(msg.chat.id, '📥 Importing user data...');

        // Download file
        const fileLink = await bot.getFileLink(document.file_id);
        const axios = require('axios');
        const response = await axios.get(fileLink);
        const jsonData = JSON.stringify(response.data);

        // Import data
        const { importAllData } = require('../../infrastructure/storage/userAddressStore.js');
        const results = await importAllData(jsonData);

        // Report results
        let message = `✅ Import completed!\n\n`;
        message += `📊 Users imported: ${results.users.success}\n`;
        message += `💾 Templates imported: ${results.messages.success}\n`;
        message += `⏰ Scheduled imported: ${results.scheduledMessages.success}\n`;
        message += `✅ Trusted imported: ${results.trustedRecords.success}\n`;
        
        const hasUserErrors = results.users.failed > 0;
        const hasMsgErrors = results.messages.failed > 0;
        const hasSchedErrors = results.scheduledMessages.failed > 0;
        const hasTrustedErrors = results.trustedRecords.failed > 0;

        if (hasUserErrors || hasMsgErrors || hasSchedErrors || hasTrustedErrors) {
            message += `\n⚠️ Errors encountered:\n`;

            if (hasUserErrors) {
                message += `• Users failed: ${results.users.failed}\n`;
                results.users.errors.slice(0, 3).forEach(err => message += `   - ${err}\n`);
            }
            if (hasMsgErrors) {
                message += `• Templates failed: ${results.messages.failed}\n`;
                results.messages.errors.slice(0, 3).forEach(err => message += `   - ${err}\n`);
            }
            if (hasSchedErrors) {
                message += `• Scheduled failed: ${results.scheduledMessages.failed}\n`;
                results.scheduledMessages.errors.slice(0, 3).forEach(err => message += `   - ${err}\n`);
            }
            if (hasTrustedErrors) {
                message += `• Trusted failed: ${results.trustedRecords.failed}\n`;
                results.trustedRecords.errors.slice(0, 3).forEach(err => message += `   - ${err}\n`);
            }
        }

        await bot.sendMessage(msg.chat.id, message);
        console.log(
            `Data imported by @${msg.from.username}: ` +
            `users ${results.users.success}/${results.users.failed}, ` +
            `messages ${results.messages.success}/${results.messages.failed}, ` +
            `scheduled ${results.scheduledMessages.success}/${results.scheduledMessages.failed}, ` +
            `trusted ${results.trustedRecords.success}/${results.trustedRecords.failed}`
        );
    } catch (error) {
        console.error('Error in handleImportData:', error);
        await sendPromptMessage(
            msg.chat.id,
            `❌ Failed to import data: ${error.message}\n\nPlease make sure the file is a valid export from /exportdata`
        );
    }
}

module.exports = {
    handleSignup,
    handleGetAddress,
    handleListAddresses,
    handleExportData,
    handleImportData
};

