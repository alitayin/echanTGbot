const {
    saveMessage,
    deleteMessage,
    getMessage,
    getAllMessages,
    messageExists,
    saveScheduledMessage,
    deleteScheduledMessageByName,
    getAllScheduledMessages
} = require('../../infrastructure/storage/storedMessageStore.js');

function parseTimeString(timeStr) {
    const match = timeStr.match(/^([\d.]+)h$/i);
    if (!match) {
        return null;
    }
    const hours = parseFloat(match[1]);
    if (isNaN(hours) || hours <= 0) {
        return null;
    }
    return hours * 60 * 60 * 1000; // Convert to milliseconds
}

async function handleMessageCommand(msg, bot) {
    try {
        if (!msg.reply_to_message) {
            await bot.sendMessage(msg.chat.id, '❌ Please reply to a message to save it.\n\nUsage: /message <commandname> [time]\nExample: /message reminder 6h');
            return;
        }

        const parts = msg.text.trim().split(/\s+/);
        if (parts.length < 2) {
            await bot.sendMessage(msg.chat.id, '❌ Please provide a command name.\n\nUsage: /message <commandname> [time]\nExample: /message reminder 6h');
            return;
        }

        const commandName = parts[1].trim();
        const timeParam = parts[2] ? parts[2].trim() : null;
        
        if (!/^[a-zA-Z0-9_]+$/.test(commandName)) {
            await bot.sendMessage(msg.chat.id, '❌ Command name can only contain letters, numbers, and underscores.');
            return;
        }

        const messageToSave = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        
        if (!messageToSave) {
            await bot.sendMessage(msg.chat.id, '❌ The replied message has no text content to save.');
            return;
        }

        const username = msg.from.username || msg.from.first_name || 'Unknown';

        // Check if this is a scheduled message
        if (timeParam) {
            const intervalMs = parseTimeString(timeParam);
            if (!intervalMs) {
                await bot.sendMessage(msg.chat.id, '❌ Invalid time format. Use format like: 0.1h, 6h, 24h');
                return;
            }

            const success = await saveScheduledMessage(commandName, messageToSave, msg.chat.id, intervalMs, username);

            if (success) {
                const hours = intervalMs / (60 * 60 * 1000);
                const firstSendTime = new Date(Date.now() + intervalMs).toLocaleString();
                await bot.sendMessage(
                    msg.chat.id, 
                    `⏰ Repeating message scheduled: "${commandName}"\n\n🔄 Repeats every ${hours}h\n⏱️ First send: ${firstSendTime}\n\n📝 Preview: ${messageToSave.substring(0, 50)}${messageToSave.length > 50 ? '...' : ''}\n\n💡 Use /stopmessage ${commandName} to stop`
                );
            } else {
                await bot.sendMessage(msg.chat.id, '❌ Failed to schedule message. Please try again.');
            }
            return;
        }

        // Regular message (not scheduled)
        const exists = await messageExists(commandName);
        if (exists) {
            await bot.sendMessage(
                msg.chat.id, 
                `⚠️ Command name "${commandName}" already exists. The message will be overwritten.\n\nContinue?`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Yes, overwrite', callback_data: `msg_overwrite_${commandName}_${msg.reply_to_message.message_id}` },
                            { text: '❌ Cancel', callback_data: 'msg_cancel' }
                        ]]
                    }
                }
            );
            return;
        }

        const success = await saveMessage(commandName, messageToSave, username);

        if (success) {
            await bot.sendMessage(
                msg.chat.id, 
                `✅ Message saved with command: "${commandName}"\n\n📝 Preview: ${messageToSave.substring(0, 50)}${messageToSave.length > 50 ? '...' : ''}`
            );
        } else {
            await bot.sendMessage(msg.chat.id, '❌ Failed to save message. Please try again.');
        }
    } catch (error) {
        console.error('Failed to handle message command:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleShowMessageCommand(msg, bot) {
    try {
        if (msg.chat.type !== 'private') {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available in private chat with the bot.');
            return;
        }

        const messages = await getAllMessages();

        if (messages.length === 0) {
            await bot.sendMessage(msg.chat.id, '📭 No saved messages yet.\n\nUse /message <commandname> (as a reply to any message) to save messages.');
            return;
        }

        let messageText = `📚 Stored Messages (${messages.length}):\n\n`;
        
        messages.forEach((msgData, index) => {
            const preview = msgData.messageContent.substring(0, 50);
            const previewText = msgData.messageContent.length > 50 ? `${preview}...` : preview;
            messageText += `${index + 1}. Command: <code>${msgData.commandName}</code>\n`;
            messageText += `   📝 ${previewText}\n`;
            messageText += `   👤 Saved by: ${msgData.savedBy}\n`;
            messageText += `   📅 ${new Date(msgData.savedAt).toLocaleString()}\n\n`;
        });

        messageText += '\n💡 Use /deletemessage &lt;commandname&gt; to delete a saved message.';

        if (messageText.length > 4000) {
            const chunks = [];
            let currentChunk = `📚 Stored Messages (${messages.length}):\n\n`;
            
            messages.forEach((msgData, index) => {
                const preview = msgData.messageContent.substring(0, 50);
                const previewText = msgData.messageContent.length > 50 ? `${preview}...` : preview;
                const entry = `${index + 1}. Command: <code>${msgData.commandName}</code>\n` +
                             `   📝 ${previewText}\n` +
                             `   👤 Saved by: ${msgData.savedBy}\n` +
                             `   📅 ${new Date(msgData.savedAt).toLocaleString()}\n\n`;
                
                if ((currentChunk + entry).length > 4000) {
                    chunks.push(currentChunk);
                    currentChunk = entry;
                } else {
                    currentChunk += entry;
                }
            });
            
            if (currentChunk) {
                chunks.push(currentChunk + '\n💡 Use /deletemessage &lt;commandname&gt; to delete a saved message.');
            }
            
            for (const chunk of chunks) {
                await bot.sendMessage(msg.chat.id, chunk, { parse_mode: 'HTML' });
            }
        } else {
            await bot.sendMessage(msg.chat.id, messageText, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('Failed to handle show message command:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleDeleteMessageCommand(msg, bot) {
    try {
        const parts = msg.text.trim().split(/\s+/);
        if (parts.length < 2) {
            await bot.sendMessage(msg.chat.id, '❌ Please provide a command name.\n\nUsage: /deletemessage <commandname>');
            return;
        }

        const commandName = parts[1].trim();

        const messageData = await getMessage(commandName);
        if (!messageData) {
            await bot.sendMessage(msg.chat.id, `❌ No message found with command name "${commandName}".`);
            return;
        }

        const preview = messageData.messageContent.substring(0, 50);
        const previewText = messageData.messageContent.length > 50 ? `${preview}...` : preview;
        
        await bot.sendMessage(
            msg.chat.id,
            `⚠️ Are you sure you want to delete this message?\n\nCommand: "${commandName}"\n📝 ${previewText}`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Yes, delete', callback_data: `msg_delete_${commandName}` },
                        { text: '❌ Cancel', callback_data: 'msg_cancel' }
                    ]]
                }
            }
        );
    } catch (error) {
        console.error('Failed to handle delete message command:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleMessageCallback(query, bot) {
    try {
        const data = query.data;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;

        if (data === 'msg_cancel') {
            await bot.editMessageText('❌ Operation cancelled.', {
                chat_id: chatId,
                message_id: messageId
            });
            await bot.answerCallbackQuery(query.id);
            return;
        }

        if (data.startsWith('msg_delete_')) {
            const commandName = data.replace('msg_delete_', '');
            const success = await deleteMessage(commandName);

            if (success) {
                await bot.editMessageText(`✅ Message "${commandName}" has been deleted.`, {
                    chat_id: chatId,
                    message_id: messageId
                });
            } else {
                await bot.editMessageText(`❌ Failed to delete message "${commandName}".`, {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
            await bot.answerCallbackQuery(query.id);
            return;
        }

        if (data.startsWith('msg_overwrite_')) {
            const parts = data.replace('msg_overwrite_', '').split('_');
            const commandName = parts[0];

            try {
                await bot.editMessageText(
                    `Please use /message ${commandName} again by replying to the message you want to save.`,
                    {
                        chat_id: chatId,
                        message_id: messageId
                    }
                );
            } catch (error) {
                console.error('Failed to overwrite message:', error);
                await bot.editMessageText('❌ Failed to overwrite message. Please try again.', {
                    chat_id: chatId,
                    message_id: messageId
                });
            }
            await bot.answerCallbackQuery(query.id);
            return;
        }

        await bot.answerCallbackQuery(query.id);
    } catch (error) {
        console.error('Failed to handle message callback:', error);
        await bot.answerCallbackQuery(query.id, {
            text: '❌ An error occurred. Please try again.',
            show_alert: true
        });
    }
}

async function handleStoredMessageCommand(msg, bot, commandName, timeParam = null) {
    try {
        const messageData = await getMessage(commandName);
        
        if (!messageData) {
            return false;
        }

        // If time parameter is provided, start scheduled repeating
        if (timeParam) {
            const intervalMs = parseTimeString(timeParam);
            if (!intervalMs) {
                await bot.sendMessage(msg.chat.id, '❌ Invalid time format. Use format like: 0.1h, 6h, 24h');
                return true;
            }

            const username = msg.from.username || msg.from.first_name || 'Unknown';
            const success = await saveScheduledMessage(commandName, messageData.messageContent, msg.chat.id, intervalMs, username);

            if (success) {
                const hours = intervalMs / (60 * 60 * 1000);
                const firstSendTime = new Date(Date.now() + intervalMs).toLocaleString();
                await bot.sendMessage(
                    msg.chat.id, 
                    `⏰ Repeating message scheduled: "${commandName}"\n\n🔄 Repeats every ${hours}h\n⏱️ First send: ${firstSendTime}\n\n📝 Preview: ${messageData.messageContent.substring(0, 50)}${messageData.messageContent.length > 50 ? '...' : ''}\n\n💡 Use /stopmessage ${commandName} to stop`
                );
            } else {
                await bot.sendMessage(msg.chat.id, '❌ Failed to schedule message. Please try again.');
            }
            return true;
        }

        // No time parameter, just send the message once
        await bot.sendMessage(msg.chat.id, messageData.messageContent, {
            reply_to_message_id: msg.message_id
        });

        console.log(`✅ Sent stored message: "${commandName}"`);
        return true;
    } catch (error) {
        console.error('Failed to handle stored message command:', error);
        return false;
    }
}

async function handleStopMessageCommand(msg, bot) {
    try {
        const parts = msg.text.trim().split(/\s+/);
        if (parts.length < 2) {
            await bot.sendMessage(msg.chat.id, '❌ Please provide a command name.\n\nUsage: /stopmessage <commandname>');
            return;
        }

        const commandName = parts[1].trim();

        const success = await deleteScheduledMessageByName(commandName);
        if (success) {
            await bot.sendMessage(msg.chat.id, `✅ Stopped repeating message: "${commandName}"`);
        } else {
            await bot.sendMessage(msg.chat.id, `❌ No repeating message found with name "${commandName}".`);
        }
    } catch (error) {
        console.error('Failed to stop message:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleListScheduledCommand(msg, bot) {
    try {
        if (msg.chat.type !== 'private') {
            await bot.sendMessage(msg.chat.id, '❌ This command is only available in private chat with the bot.');
            return;
        }

        const scheduledMessages = await getAllScheduledMessages();

        if (scheduledMessages.length === 0) {
            await bot.sendMessage(msg.chat.id, '📭 No scheduled repeating messages.');
            return;
        }

        let messageText = `⏰ Scheduled Repeating Messages (${scheduledMessages.length}):\n\n`;
        
        scheduledMessages.forEach((msgData, index) => {
            const preview = msgData.messageContent.substring(0, 50);
            const previewText = msgData.messageContent.length > 50 ? `${preview}...` : preview;
            const hours = msgData.intervalMs / (60 * 60 * 1000);
            const nextSend = new Date(msgData.nextSendTime).toLocaleString();
            messageText += `${index + 1}. Command: <code>${msgData.commandName}</code>\n`;
            messageText += `   🔄 Every ${hours}h\n`;
            messageText += `   ⏱️ Next: ${nextSend}\n`;
            messageText += `   📝 ${previewText}\n\n`;
        });

        messageText += '\n💡 Use /stopmessage &lt;commandname&gt; to stop a repeating message.';

        await bot.sendMessage(msg.chat.id, messageText, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Failed to list scheduled messages:', error);
        await bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

module.exports = {
    handleMessageCommand,
    handleShowMessageCommand,
    handleDeleteMessageCommand,
    handleMessageCallback,
    handleStoredMessageCommand,
    handleStopMessageCommand,
    handleListScheduledCommand
};

