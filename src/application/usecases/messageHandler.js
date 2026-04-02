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
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

// In-memory store for pending overwrite confirmations
// key: `${chatId}__${userId}__${commandName}`, value: { commandName, messageContent, photoBuffer, photoMetadata, username, expiresAt }
const pendingOverwrites = new Map();

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
            await sendPromptMessage(bot, msg.chat.id, '❌ Please reply to a message to save it.\n\nUsage: /message <commandname> [time]\nExample: /message reminder 6h');
            return;
        }

        const parts = msg.text.trim().split(/\s+/);
        if (parts.length < 2) {
            await sendPromptMessage(bot, msg.chat.id, '❌ Please provide a command name.\n\nUsage: /message <commandname> [time]\nExample: /message reminder 6h');
            return;
        }

        const commandName = parts[1].trim();
        const timeParam = parts[2] ? parts[2].trim() : null;
        
        if (!/^[a-zA-Z0-9_]+$/.test(commandName)) {
            await sendPromptMessage(bot, msg.chat.id, '❌ Command name can only contain letters, numbers, and underscores.');
            return;
        }

        const messageToSave = msg.reply_to_message.text || msg.reply_to_message.caption || '';
        
        // Extract and download photo if present
        let photoBuffer = null;
        let photoMetadata = null;
        if (msg.reply_to_message.photo && msg.reply_to_message.photo.length > 0) {
            try {
                const photo = msg.reply_to_message.photo[msg.reply_to_message.photo.length - 1];
                
                // Download photo as stream
                const fileStream = await bot.getFileStream(photo.file_id);
                const chunks = [];
                
                // Collect stream data
                await new Promise((resolve, reject) => {
                    fileStream.on('data', (chunk) => chunks.push(chunk));
                    fileStream.on('end', resolve);
                    fileStream.on('error', reject);
                });
                
                photoBuffer = Buffer.concat(chunks);
                photoMetadata = {
                    fileSize: photo.file_size,
                    width: photo.width,
                    height: photo.height
                };
                
                console.log(`📸 Downloaded photo: ${photoBuffer.length} bytes`);
            } catch (error) {
                console.error('Failed to download photo:', error);
                await sendPromptMessage(bot, msg.chat.id, '❌ Failed to download photo. Please try again.');
                return;
            }
        }
        
        // Allow saving if there's text OR photo
        if (!messageToSave && !photoBuffer) {
            await sendPromptMessage(bot, msg.chat.id, '❌ The replied message has no content to save.');
            return;
        }

        const username = msg.from.username || msg.from.first_name || 'Unknown';

        // Check if this is a scheduled message
        if (timeParam) {
            const intervalMs = parseTimeString(timeParam);
            if (!intervalMs) {
                await sendPromptMessage(bot, msg.chat.id, '❌ Invalid time format. Use format like: 0.1h, 6h, 24h');
                return;
            }

            const success = await saveScheduledMessage(commandName, messageToSave, msg.chat.id, intervalMs, username, photoBuffer, photoMetadata);

            if (success) {
                const hours = intervalMs / (60 * 60 * 1000);
                const firstSendTime = new Date(Date.now() + intervalMs).toLocaleString();
                const contentPreview = photoBuffer 
                    ? `${photoBuffer ? '🖼️ Photo' : ''}${messageToSave ? ' + ' + messageToSave.substring(0, 30) : ''}${messageToSave.length > 30 ? '...' : ''}`
                    : `${messageToSave.substring(0, 50)}${messageToSave.length > 50 ? '...' : ''}`;
                await sendPromptMessage(bot, msg.chat.id, 
                    `⏰ Repeating message scheduled: "${commandName}"\n\n🔄 Repeats every ${hours}h\n⏱️ First send: ${firstSendTime}\n\n📝 Preview: ${contentPreview}\n\n💡 Use /stopmessage ${commandName} to stop`
                );
            } else {
                await sendPromptMessage(bot, msg.chat.id, '❌ Failed to schedule message. Please try again.');
            }
            return;
        }

        // Regular message (not scheduled)
        const exists = await messageExists(commandName);
        if (exists) {
            const pendingKey = `${msg.chat.id}__${msg.from.id}__${commandName}`;
            pendingOverwrites.set(pendingKey, {
                commandName,
                messageContent: messageToSave,
                photoBuffer,
                photoMetadata,
                username,
                expiresAt: Date.now() + 5 * 60 * 1000,
            });
            await sendPromptMessage(bot, msg.chat.id, 
                `⚠️ Command name "${commandName}" already exists. The message will be overwritten.\n\nContinue?`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Yes, overwrite', callback_data: `msg_overwrite__${msg.chat.id}__${msg.from.id}__${commandName}` },
                            { text: '❌ Cancel', callback_data: 'msg_cancel' }
                        ]]
                    }
                }
            );
            return;
        }

        const success = await saveMessage(commandName, messageToSave, username, photoBuffer, photoMetadata);

        if (success) {
            const contentPreview = photoBuffer 
                ? `${photoBuffer ? '🖼️ Photo' : ''}${messageToSave ? ' + ' + messageToSave.substring(0, 30) : ''}${messageToSave.length > 30 ? '...' : ''}`
                : `${messageToSave.substring(0, 50)}${messageToSave.length > 50 ? '...' : ''}`;
            await sendPromptMessage(bot, msg.chat.id, 
                `✅ Message saved with command: "${commandName}"\n\n📝 Preview: ${contentPreview}`
            );
        } else {
            await sendPromptMessage(bot, msg.chat.id, '❌ Failed to save message. Please try again.');
        }
    } catch (error) {
        console.error('Failed to handle message command:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleShowMessageCommand(msg, bot) {
    try {
        if (msg.chat.type !== 'private') {
            await sendPromptMessage(bot, msg.chat.id, '❌ This command is only available in private chat with the bot.');
            return;
        }

        const messages = await getAllMessages();

        if (messages.length === 0) {
            await sendPromptMessage(bot, msg.chat.id, '📭 No saved messages yet.\n\nUse /message <commandname> (as a reply to any message) to save messages.');
            return;
        }

        let messageText = `📚 Stored Messages (${messages.length}):\n\n`;
        
        messages.forEach((msgData, index) => {
            const messageType = msgData.messageType || 'text';
            let contentDisplay = '';
            
            if (messageType === 'photo') {
                contentDisplay = '🖼️ Photo only';
            } else if (messageType === 'photo_with_caption') {
                const preview = msgData.messageContent.substring(0, 40);
                contentDisplay = `🖼️ Photo + ${msgData.messageContent.length > 40 ? `${preview}...` : preview}`;
            } else {
                const preview = msgData.messageContent.substring(0, 50);
                contentDisplay = msgData.messageContent.length > 50 ? `${preview}...` : preview;
            }
            
            messageText += `${index + 1}. Command: <code>${msgData.commandName}</code>\n`;
            messageText += `   📝 ${contentDisplay}\n`;
            messageText += `   👤 Saved by: ${msgData.savedBy}\n`;
            messageText += `   📅 ${new Date(msgData.savedAt).toLocaleString()}\n\n`;
        });

        messageText += '\n💡 Use /deletemessage &lt;commandname&gt; to delete a saved message.';

        if (messageText.length > 4000) {
            const chunks = [];
            let currentChunk = `📚 Stored Messages (${messages.length}):\n\n`;
            
            messages.forEach((msgData, index) => {
                const messageType = msgData.messageType || 'text';
                let contentDisplay = '';
                
                if (messageType === 'photo') {
                    contentDisplay = '🖼️ Photo only';
                } else if (messageType === 'photo_with_caption') {
                    const preview = msgData.messageContent.substring(0, 40);
                    contentDisplay = `🖼️ Photo + ${msgData.messageContent.length > 40 ? `${preview}...` : preview}`;
                } else {
                    const preview = msgData.messageContent.substring(0, 50);
                    contentDisplay = msgData.messageContent.length > 50 ? `${preview}...` : preview;
                }
                
                const entry = `${index + 1}. Command: <code>${msgData.commandName}</code>\n` +
                             `   📝 ${contentDisplay}\n` +
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
                await sendPromptMessage(bot, msg.chat.id, chunk, { parse_mode: 'HTML' });
            }
        } else {
            await sendPromptMessage(bot, msg.chat.id, messageText, { parse_mode: 'HTML' });
        }
    } catch (error) {
        console.error('Failed to handle show message command:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleDeleteMessageCommand(msg, bot) {
    try {
        const parts = msg.text.trim().split(/\s+/);
        if (parts.length < 2) {
            await sendPromptMessage(bot, msg.chat.id, '❌ Please provide a command name.\n\nUsage: /deletemessage <commandname>');
            return;
        }

        const commandName = parts[1].trim();

        const messageData = await getMessage(commandName);
        if (!messageData) {
            await sendPromptMessage(bot, msg.chat.id, `❌ No message found with command name "${commandName}".`);
            return;
        }

        const messageType = messageData.messageType || 'text';
        let contentDisplay = '';
        
        if (messageType === 'photo') {
            contentDisplay = '🖼️ Photo only';
        } else if (messageType === 'photo_with_caption') {
            const preview = messageData.messageContent.substring(0, 40);
            contentDisplay = `🖼️ Photo + ${messageData.messageContent.length > 40 ? `${preview}...` : preview}`;
        } else {
            const preview = messageData.messageContent.substring(0, 50);
            contentDisplay = messageData.messageContent.length > 50 ? `${preview}...` : preview;
        }
        
        await sendPromptMessage(bot, msg.chat.id,
            `⚠️ Are you sure you want to delete this message?\n\nCommand: "${commandName}"\n📝 ${contentDisplay}`,
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
        await sendPromptMessage(bot, msg.chat.id, '❌ An error occurred. Please try again.');
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

        if (data.startsWith('msg_overwrite__')) {
            // Format: msg_overwrite__<chatId>__<userId>__<commandName>
            const withoutPrefix = data.replace('msg_overwrite__', '');
            const separatorIdx1 = withoutPrefix.indexOf('__');
            const separatorIdx2 = withoutPrefix.indexOf('__', separatorIdx1 + 2);
            const pendingChatId = withoutPrefix.substring(0, separatorIdx1);
            const pendingUserId = withoutPrefix.substring(separatorIdx1 + 2, separatorIdx2);
            const commandName = withoutPrefix.substring(separatorIdx2 + 2);
            const pendingKey = `${pendingChatId}__${pendingUserId}__${commandName}`;

            const pending = pendingOverwrites.get(pendingKey);
            if (!pending || Date.now() > pending.expiresAt) {
                pendingOverwrites.delete(pendingKey);
                await bot.editMessageText(
                    `⚠️ Overwrite confirmation expired. Please use /message ${commandName} again.`,
                    { chat_id: chatId, message_id: messageId }
                );
                await bot.answerCallbackQuery(query.id);
                return;
            }

            try {
                const success = await saveMessage(
                    pending.commandName,
                    pending.messageContent,
                    pending.username,
                    pending.photoBuffer,
                    pending.photoMetadata
                );
                pendingOverwrites.delete(pendingKey);

                if (success) {
                    const contentPreview = pending.photoBuffer
                        ? `🖼️ Photo${pending.messageContent ? ' + ' + pending.messageContent.substring(0, 30) : ''}`
                        : `${(pending.messageContent || '').substring(0, 50)}`;
                    await bot.editMessageText(
                        `✅ Message "${commandName}" has been overwritten.\n\n📝 Preview: ${contentPreview}`,
                        { chat_id: chatId, message_id: messageId }
                    );
                } else {
                    await bot.editMessageText('❌ Failed to overwrite message. Please try again.', {
                        chat_id: chatId,
                        message_id: messageId
                    });
                }
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

        const messageType = messageData.messageType || 'text';
        const photoData = messageData.photo || null;

        // If time parameter is provided, start scheduled repeating
        if (timeParam) {
            const intervalMs = parseTimeString(timeParam);
            if (!intervalMs) {
                await sendPromptMessage(bot, msg.chat.id, '❌ Invalid time format. Use format like: 0.1h, 6h, 24h');
                return true;
            }

            const username = msg.from.username || msg.from.first_name || 'Unknown';
            
            // Extract buffer and metadata if photo exists
            const photoBuffer = photoData ? Buffer.from(photoData.buffer, 'base64') : null;
            const photoMetadata = photoData ? photoData.metadata : null;
            
            const success = await saveScheduledMessage(commandName, messageData.messageContent, msg.chat.id, intervalMs, username, photoBuffer, photoMetadata);

            if (success) {
                const hours = intervalMs / (60 * 60 * 1000);
                const firstSendTime = new Date(Date.now() + intervalMs).toLocaleString();
                const contentPreview = photoData 
                    ? `${photoData ? '🖼️ Photo' : ''}${messageData.messageContent ? ' + ' + messageData.messageContent.substring(0, 30) : ''}${messageData.messageContent.length > 30 ? '...' : ''}`
                    : `${messageData.messageContent.substring(0, 50)}${messageData.messageContent.length > 50 ? '...' : ''}`;
                await sendPromptMessage(bot, msg.chat.id, 
                    `⏰ Repeating message scheduled: "${commandName}"\n\n🔄 Repeats every ${hours}h\n⏱️ First send: ${firstSendTime}\n\n📝 Preview: ${contentPreview}\n\n💡 Use /stopmessage ${commandName} to stop`
                );
            } else {
                await sendPromptMessage(bot, msg.chat.id, '❌ Failed to schedule message. Please try again.');
            }
            return true;
        }

        // No time parameter, just send the message once
        if (messageType === 'photo' || messageType === 'photo_with_caption') {
            // Send photo from buffer
            const photoBuffer = Buffer.from(photoData.buffer, 'base64');
            await bot.sendPhoto(msg.chat.id, photoBuffer, {
                caption: messageData.messageContent || undefined,
                reply_to_message_id: msg.message_id
            });
        } else {
            // Send text
            await bot.sendMessage(msg.chat.id, messageData.messageContent, {
                reply_to_message_id: msg.message_id
            });
        }

        console.log(`✅ Sent stored message (${messageType}): "${commandName}"`);
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
            await sendPromptMessage(bot, msg.chat.id, '❌ Please provide a command name.\n\nUsage: /stopmessage <commandname>');
            return;
        }

        const commandName = parts[1].trim();

        const success = await deleteScheduledMessageByName(commandName);
        if (success) {
            await sendPromptMessage(bot, msg.chat.id, `✅ Stopped repeating message: "${commandName}"`);
        } else {
            await sendPromptMessage(bot, msg.chat.id, `❌ No repeating message found with name "${commandName}".`);
        }
    } catch (error) {
        console.error('Failed to stop message:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function handleListScheduledCommand(msg, bot) {
    try {
        if (msg.chat.type !== 'private') {
            await sendPromptMessage(bot, msg.chat.id, '❌ This command is only available in private chat with the bot.');
            return;
        }

        const scheduledMessages = await getAllScheduledMessages();

        if (scheduledMessages.length === 0) {
            await sendPromptMessage(bot, msg.chat.id, '📭 No scheduled repeating messages.');
            return;
        }

        let messageText = `⏰ Scheduled Repeating Messages (${scheduledMessages.length}):\n\n`;
        
        scheduledMessages.forEach((msgData, index) => {
            const messageType = msgData.messageType || 'text';
            let contentDisplay = '';
            
            if (messageType === 'photo') {
                contentDisplay = '🖼️ Photo only';
            } else if (messageType === 'photo_with_caption') {
                const preview = msgData.messageContent.substring(0, 40);
                contentDisplay = `🖼️ Photo + ${msgData.messageContent.length > 40 ? `${preview}...` : preview}`;
            } else {
                const preview = msgData.messageContent.substring(0, 50);
                contentDisplay = msgData.messageContent.length > 50 ? `${preview}...` : preview;
            }
            
            const hours = msgData.intervalMs / (60 * 60 * 1000);
            const nextSend = new Date(msgData.nextSendTime).toLocaleString();
            messageText += `${index + 1}. Command: <code>${msgData.commandName}</code>\n`;
            messageText += `   🔄 Every ${hours}h\n`;
            messageText += `   ⏱️ Next: ${nextSend}\n`;
            messageText += `   📝 ${contentDisplay}\n\n`;
        });

        messageText += '\n💡 Use /stopmessage &lt;commandname&gt; to stop a repeating message.';

        await sendPromptMessage(bot, msg.chat.id, messageText, { parse_mode: 'HTML' });
    } catch (error) {
        console.error('Failed to list scheduled messages:', error);
        await sendPromptMessage(bot, msg.chat.id, '❌ An error occurred. Please try again.');
    }
}

async function checkStoredMessageExists(commandName) {
    return await messageExists(commandName);
}

module.exports = {
    handleMessageCommand,
    handleShowMessageCommand,
    handleDeleteMessageCommand,
    handleMessageCallback,
    handleStoredMessageCommand,
    handleStopMessageCommand,
    handleListScheduledCommand,
    checkStoredMessageExists
};

