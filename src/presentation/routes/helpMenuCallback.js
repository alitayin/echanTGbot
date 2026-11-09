const { withTimeout } = require('../../domain/utils/async.js');

function isMessageNotModifiedError(error) {
    const body = error?.response?.body;
    if (body?.error_code === 400 && /^Bad Request: message is not modified(?::|$)/.test(body.description || '')) {
        return true;
    }

    return /^ETELEGRAM: 400 Bad Request: message is not modified(?::|$)/.test(error?.message || '');
}

async function handleHelpMenuCallback(query, bot, menuData) {
    const editOptions = {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: menuData.keyboard,
        },
    };

    try {
        await withTimeout(
            bot.editMessageText(menuData.text, editOptions),
            5000,
            'Help menu update timed out'
        );
    } catch (error) {
        if (!isMessageNotModifiedError(error)) throw error;
    }

    await bot.answerCallbackQuery(query.id);
}

module.exports = {
    handleHelpMenuCallback,
};
