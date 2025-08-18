/** Impersonation policy helpers. */

/** Default TTLs (ms). */
const DEFAULT_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour
const DEFAULT_WHITELIST_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function isDisplayNameEmpty(name) {
    return !name || name.replace(/\s+/g, '') === '';
}

/**
 * Check potential impersonation by display name.
 * @param {{user:{id:number,username?:string|null,fullName:string},admin:{userId:number,username?:string|null,fullName:string}}} params
 * @returns {boolean}
 */
function isPotentialNameImpersonation({ user, admin }) {
    if (isDisplayNameEmpty(user.fullName)) return false;
    if (isDisplayNameEmpty(admin.fullName)) return false;

    if (admin.fullName !== user.fullName) return false;
    if (admin.userId === user.id) return false;

    const userUsername = user.username ? String(user.username).toLowerCase() : null;
    const adminUsername = admin.username ? String(admin.username).toLowerCase() : null;

    if (userUsername && adminUsername && userUsername === adminUsername) {
        // Same person, not impersonation
        return false;
    }

    return true;
}

/** Decide outcome after avatar check. */
function decideAfterAvatarCheck({ avatarsSimilar }) {
    if (avatarsSimilar) {
        return { isImpersonation: true, addToWhitelist: false, avatarComparison: true };
    }
    return { isImpersonation: false, addToWhitelist: true, avatarComparison: false };
}

/** Validate whitelist timestamp by TTL. */
function isWhitelistValid(entryTimestamp, now = Date.now(), ttlMs = DEFAULT_WHITELIST_DURATION_MS) {
    if (entryTimestamp == null) return false;
    return (now - entryTimestamp) < ttlMs;
}

module.exports = {
    DEFAULT_CACHE_DURATION_MS,
    DEFAULT_WHITELIST_DURATION_MS,
    isPotentialNameImpersonation,
    decideAfterAvatarCheck,
    isWhitelistValid,
};


