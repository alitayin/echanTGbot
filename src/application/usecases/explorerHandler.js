const { fetchAddressData } = require('../../infrastructure/blockchain/chronikClient.js');
const { decodeAddressWithFallback, ensureAddressWithFallback, InvalidAddressError } = require('../../infrastructure/blockchain/addressUtils.js');
const { getOutputScriptFromAddress, encodeOutputScript } = require('ecashaddrjs');

async function handleExplorerAddress(rawAddress, page = 0, pageSize = 10) {
    const { type, hash } = decodeAddressWithFallback(rawAddress);
    const resolvedAddress = ensureAddressWithFallback(rawAddress);
    const data = await fetchAddressData(type, hash, page, pageSize, resolvedAddress);
    return { ...data, address: resolvedAddress, type, hash };
}


function shortenAddress(addr) {
    if (typeof addr !== 'string') return 'unknown';
    const payload = addr.includes(':') ? addr.split(':').pop() : addr;
    const suffix = payload.slice(-6);
    return `...${suffix}`;
}

function linkAddress(addr) {
    if (typeof addr === 'string' && addr.startsWith('ecash:')) {
        const display = shortenAddress(addr);
        const url = `https://explorer.e.cash/address/${addr}`;
        return `<a href="${url}">${display}</a>`;
    }
    // Not a recognized ecash address; return shortened plain text
    return shortenAddress(String(addr || 'unknown'));
}

module.exports = {
    handleExplorerAddress,
    InvalidAddressError,
};


