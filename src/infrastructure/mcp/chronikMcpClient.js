const axios = require('axios');
const { MCP_ECASH_URL, MCP_TIMEOUT_MS } = require('../../../config/config.js');

let cachedSessionId = null;

async function ensureSession() {
    if (cachedSessionId) {
        return cachedSessionId;
    }
    const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: {
                name: 'xecbot',
                version: '1.0.0'
            }
        }
    };
    const response = await axios.post(MCP_ECASH_URL, payload, {
        timeout: MCP_TIMEOUT_MS,
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const sessionId = response?.headers?.['mcp-session-id'];
    if (sessionId) {
        cachedSessionId = sessionId;
    }
    return cachedSessionId;
}

function buildPayload(method, params) {
    return {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
    };
}

async function postMcp(payload, retry = true) {
    const sessionId = await ensureSession();
    const headers = {
        'Content-Type': 'application/json'
    };
    if (sessionId) {
        headers['mcp-session-id'] = sessionId;
    }
    try {
        const response = await axios.post(MCP_ECASH_URL, payload, {
            timeout: MCP_TIMEOUT_MS,
            headers
        });
        return response.data;
    } catch (error) {
        const message = error?.response?.data?.error?.message || error?.message || '';
        if (retry && typeof message === 'string' && message.toLowerCase().includes('session')) {
            cachedSessionId = null;
            await ensureSession();
            return postMcp(payload, false);
        }
        throw error;
    }
}

function normalizeTools(response) {
    const result = response?.result;
    if (!result) return [];
    if (Array.isArray(result)) {
        return result;
    }
    if (Array.isArray(result.tools)) {
        return result.tools;
    }
    return [];
}

async function listChronikTools() {
    const response = await postMcp(buildPayload('tools/list', {}));
    if (response?.error) {
        throw new Error(response.error.message || 'MCP tools/list error');
    }
    const tools = normalizeTools(response);
    return tools;
}

async function callChronikTool(toolName, toolArgs = {}) {
    const response = await postMcp(buildPayload('tools/call', {
        name: toolName,
        arguments: toolArgs
    }));
    if (response?.error) {
        throw new Error(response.error.message || 'MCP tools/call error');
    }
    return response?.result ?? response;
}

module.exports = {
    listChronikTools,
    callChronikTool
};

