// Markdown formatting utilities
// Domain layer module

/**
 * Escape special characters in Telegram Markdown
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeMarkdown(text) {
    // Escape special Markdown characters: _ * [ ] ( ) ~ ` > # + - = | { } . !
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

module.exports = {
    escapeMarkdown
};


