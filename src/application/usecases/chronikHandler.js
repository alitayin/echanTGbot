const fs = require('fs');
const os = require('os');
const path = require('path');
const { listChronikTools, callChronikTool } = require('../../infrastructure/mcp/chronikMcpClient.js');
const { sendPromptMessage } = require('../../infrastructure/telegram/promptMessenger.js');

function chunkText(text, maxLen = 3500) {
    if (!text) return [''];
    const chunks = [];
    let remaining = String(text);
    while (remaining.length > maxLen) {
        let cut = remaining.lastIndexOf('\n', maxLen);
        if (cut === -1 || cut < maxLen * 0.5) {
            cut = maxLen;
        }
        chunks.push(remaining.slice(0, cut));
        remaining = remaining.slice(cut);
    }
    if (remaining) chunks.push(remaining);
    return chunks;
}

function extractJsonObject(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        return null;
    }
    const candidate = text.slice(start, end + 1);
    try {
        return JSON.parse(candidate);
    } catch (_) {
        return null;
    }
}

function extractToolName(answer, tools) {
    if (!answer || !tools.length) return null;
    const trimmed = String(answer).trim();
    const json = extractJsonObject(trimmed);
    if (json && typeof json.function === 'string') {
        return tools.find((tool) => tool.name === json.function)?.name || null;
    }
    const direct = tools.find((tool) => tool.name === trimmed);
    if (direct) return direct.name;
    const normalized = trimmed.replace(/[`"'[\]\n\r]/g, ' ').trim();
    for (const tool of tools) {
        const pattern = new RegExp(`\\b${tool.name}\\b`);
        if (pattern.test(normalized)) {
            return tool.name;
        }
    }
    return null;
}

function buildToolListForPrompt(tools) {
    return tools.map((tool) => {
        const desc = tool.description ? ` - ${tool.description}` : '';
        const schema = tool.inputSchema ? ` input_schema: ${JSON.stringify(tool.inputSchema)}` : '';
        return `- ${tool.name}${desc}${schema}`;
    }).join('\n');
}

async function selectToolName(ports, userId, userQuery, tools) {
    const toolList = buildToolListForPrompt(tools);
    const prompt = [
        'You are an eCash MCP selector.',
        'Choose exactly one function name from the list below that best matches the user request.',
        'Return ONLY the function name in English. No extra words, no JSON, no markdown.',
        '',
        'Available functions:',
        toolList,
        '',
        `User request: ${userQuery}`
    ].join('\n');
    const response = await ports.chat.sendText(prompt, userId, '');
    return extractToolName(response?.answer, tools);
}

function toolNeedsParams(tool) {
    const schema = tool?.inputSchema;
    const hasProps = schema && typeof schema === 'object' && schema.properties && Object.keys(schema.properties).length > 0;
    const hasRequired = schema && Array.isArray(schema.required) && schema.required.length > 0;
    return Boolean(hasProps || hasRequired);
}

async function buildToolArgs(ports, userId, userQuery, tool) {
    const schema = tool.inputSchema ? JSON.stringify(tool.inputSchema) : '{}';
    const prompt = [
        'You are an eCash MCP parameter builder.',
        'Return ONLY a JSON object for the tool parameters.',
        'Do not include any extra text or markdown.',
        '',
        `Tool name: ${tool.name}`,
        `Tool input schema: ${schema}`,
        `User request: ${userQuery}`
    ].join('\n');
    const response = await ports.chat.sendText(prompt, userId, '');
    const parsed = extractJsonObject(response?.answer);
    return parsed || {};
}

async function sendJsonFile(bot, msg, data) {
    const payload = JSON.stringify(data, null, 2);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chronik-'));
    const filePath = path.join(tmpDir, 'chronik-result.json');
    fs.writeFileSync(filePath, payload, 'utf8');
    try {
        await bot.sendDocument(msg.chat.id, filePath, {
            reply_to_message_id: msg.message_id
        });
    } finally {
        fs.unlink(filePath, () => {});
        fs.rmdir(tmpDir, () => {});
    }
}

async function handleChronikCommand(msg, bot, ports) {
    const text = (msg.text || '').trim();
    const parts = text.split(/\s+/);
    const userQuery = parts.slice(1).join(' ').trim();
    if (!userQuery) {
        await sendPromptMessage(
            bot,
            msg.chat.id,
            'Usage: /chronik <request>',
            { reply_to_message_id: msg.message_id }
        );
        return;
    }

    const loadingMessage = await sendPromptMessage(
        bot,
        msg.chat.id,
        '🔎 Fetching Chronik MCP data...',
        { reply_to_message_id: msg.message_id }
    );

    try {
        const tools = await listChronikTools();
        if (!tools.length) {
            throw new Error('No MCP tools available');
        }
        const toolName = await selectToolName(ports, msg.from.id, userQuery, tools);
        if (!toolName) {
            throw new Error('Failed to select tool');
        }
        const tool = tools.find((item) => item.name === toolName);
        const toolArgs = tool && toolNeedsParams(tool)
            ? await buildToolArgs(ports, msg.from.id, userQuery, tool)
            : {};
        const result = await callChronikTool(toolName, toolArgs);

        await bot.deleteMessage(msg.chat.id, loadingMessage.message_id).catch(() => {});
        await sendJsonFile(bot, msg, result);
    } catch (error) {
        console.error('Chronik MCP error:', error.message || error);
        await bot.editMessageText('❌ MCP request failed. Please try again later.', {
            chat_id: msg.chat.id,
            message_id: loadingMessage.message_id
        }).catch(async () => {
            await sendPromptMessage(bot, msg.chat.id, '❌ MCP request failed. Please try again later.');
        });
    }
}

module.exports = {
    handleChronikCommand
};

