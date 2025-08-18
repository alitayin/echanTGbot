const { ChronikClient } = require('chronik-client');
const { CHRONIK_URLS, CHRONIK_TIMEOUT_MS } = require('../../../config/config.js');

const chronik = new ChronikClient(CHRONIK_URLS && CHRONIK_URLS.length ? CHRONIK_URLS : ['https://chronik.e.cash']);

function withTimeout(promise, ms, label = 'request') {
    const timeout = ms || CHRONIK_TIMEOUT_MS || 8000;
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), timeout))
    ]);
}

async function fetchAddressHistory(type, hash, page = 0, pageSize = 20, originalAddress) {
    // Minimal: prefer address API with timeout, no retry
    if (originalAddress && typeof chronik.address === 'function') {
        return await withTimeout(chronik.address(originalAddress).history(page, pageSize), CHRONIK_TIMEOUT_MS, 'history');
    }
    // Fallback to script only if address not provided
    return await withTimeout(chronik.script(type, hash).history(page, pageSize), CHRONIK_TIMEOUT_MS, 'history');
}

async function fetchAddressUtxos(type, hash, originalAddress) {
    // Minimal: prefer address API with timeout, no retry
    if (originalAddress && typeof chronik.address === 'function') {
        return await withTimeout(chronik.address(originalAddress).utxos(), CHRONIK_TIMEOUT_MS, 'utxos');
    }
    // Fallback to script only if address not provided
    return await withTimeout(chronik.script(type, hash).utxos(), CHRONIK_TIMEOUT_MS, 'utxos');
}

async function fetchAddressData(type, hash, page = 0, pageSize = 20, originalAddress) {
    const [history, utxos] = await Promise.all([
        fetchAddressHistory(type, hash, page, pageSize, originalAddress),
        fetchAddressUtxos(type, hash, originalAddress),
    ]);

    // Collect tokenIds present in this page of history to enrich with token metadata
    const tokenIds = new Set();
    try {
        const txs = Array.isArray(history?.txs) ? history.txs : [];
        for (const tx of txs) {
            const inputs = Array.isArray(tx?.inputs) ? tx.inputs : [];
            const outputs = Array.isArray(tx?.outputs) ? tx.outputs : [];
            for (const i of inputs) {
                const t = i && i.token;
                if (t && t.tokenId) tokenIds.add(t.tokenId);
            }
            for (const o of outputs) {
                const t = o && o.token;
                if (t && t.tokenId) tokenIds.add(t.tokenId);
            }
        }
    } catch (_) {
        // best-effort; ignore extraction errors
    }

    const tokenMeta = await fetchTokenInfos(Array.from(tokenIds));
    return { history, utxos, tokenMeta };
}

async function fetchTokenInfo(tokenId) {
    return await withTimeout(chronik.token(tokenId), CHRONIK_TIMEOUT_MS, 'token');
}

async function fetchTokenInfos(tokenIds) {
    const uniqueIds = Array.from(new Set((Array.isArray(tokenIds) ? tokenIds : []).filter(Boolean)));
    if (uniqueIds.length === 0) return {};
    const results = await Promise.all(uniqueIds.map(async (id) => {
        try {
            const info = await fetchTokenInfo(id);
            return [id, info];
        } catch (_) {
            return [id, null];
        }
    }));
    const mapping = {};
    for (const [id, info] of results) {
        if (info) mapping[id] = info;
    }
    return mapping;
}

module.exports = {
    fetchAddressHistory,
    fetchAddressUtxos,
    fetchAddressData,
    fetchTokenInfo,
    fetchTokenInfos,
};


