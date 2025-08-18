/**
 * Wrap text in a typed <context>.
 * @param {string} label
 * @param {string} content
 * @returns {string}
 */
function wrapInContext(label, content) {
    return `<context type="${label}">
${content}
</context>`;
}

module.exports = { wrapInContext };


