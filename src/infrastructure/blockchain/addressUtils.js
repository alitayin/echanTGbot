const { decodeCashAddress } = require('ecashaddrjs');

class InvalidAddressError extends Error {
    constructor(message = 'Invalid eCash address') {
        super(message);
        this.name = 'InvalidAddressError';
    }
}

function tryDecode(address) {
    try {
        return decodeCashAddress(address);
    } catch (e) {
        return null;
    }
}

function decodeAddressWithFallback(raw) {
    const input = (raw || '').trim();
    if (!input) {
        throw new InvalidAddressError('Empty address');
    }
    const candidates = [input];
    if (!input.includes(':')) {
        candidates.push(`ecash:${input}`);
        candidates.push(`etoken:${input}`);
    }
    for (const c of candidates) {
        const decoded = tryDecode(c);
        if (decoded) {
            return { type: decoded.type, hash: decoded.hash };
        }
    }
    throw new InvalidAddressError();
}

function ensureAddressWithFallback(raw) {
    const input = (raw || '').trim();
    if (!input) {
        throw new InvalidAddressError('Empty address');
    }
    const candidates = [input];
    if (!input.includes(':')) {
        candidates.push(`ecash:${input}`);
        candidates.push(`etoken:${input}`);
    }
    for (const c of candidates) {
        const decoded = tryDecode(c);
        if (decoded) {
            return c; // return the first valid address string candidate
        }
    }
    throw new InvalidAddressError();
}

module.exports = {
    decodeAddressWithFallback,
    ensureAddressWithFallback,
    InvalidAddressError,
};


