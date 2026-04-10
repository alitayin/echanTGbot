const axios = require('axios');
const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');

const REPO_OWNER = 'alitayin';
const REPO_NAME = 'echanTGbot';
const REMOTE_PACKAGE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`;
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const RELEASE_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags`;
const CHECK_INTERVAL_MS = parseInt(process.env.GITHUB_VERSION_CHECK_INTERVAL_MS || String(60 * 60 * 1000));

const localVersion = (() => {
    try {
        return require('../../../package.json').version;
    } catch {
        return '0.0.0';
    }
})();

/**
 * Compare two semver strings (major.minor.patch).
 * Returns true if `remote` is strictly greater than `local`.
 */
function isRemoteNewer(local, remote) {
    const parse = (v) => String(v || '0').split('.').map((n) => parseInt(n, 10) || 0);
    const [lMaj, lMin, lPat] = parse(local);
    const [rMaj, rMin, rPat] = parse(remote);
    if (rMaj !== lMaj) return rMaj > lMaj;
    if (rMin !== lMin) return rMin > lMin;
    return rPat > lPat;
}

function formatReleaseSummary(releaseData, remoteVersion) {
    const releaseName = releaseData?.name || `Release ${remoteVersion}`;
    const body = String(releaseData?.body || '').trim();
    const changeLines = body
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.startsWith('- '))
        .slice(0, 8);

    const parts = [
        `🆕 New version of echanTGbot available!`,
        '',
        `Current: v${localVersion}`,
        `Latest: v${remoteVersion}`,
        '',
        `Release: ${releaseName}`,
    ];

    if (changeLines.length > 0) {
        parts.push('', 'Changes:', ...changeLines);
    }

    parts.push('', `${REPO_URL}/releases/tag/v${remoteVersion}`);
    return parts.join('\n');
}

async function fetchReleaseData(remoteVersion) {
    try {
        const response = await axios.get(`${RELEASE_API_URL}/v${remoteVersion}`, { timeout: 10000 });
        return response.data || null;
    } catch (error) {
        console.warn(`[GithubVersionChecker] Failed to fetch release details for v${remoteVersion}: ${error.message}`);
        return null;
    }
}

class GithubVersionChecker {
    constructor(bot) {
        this.bot = bot;
        this.lastNotifiedVersion = null;
        this.intervalId = null;
    }

    async check() {
        try {
            const response = await axios.get(REMOTE_PACKAGE_URL, { timeout: 10000 });
            const remoteVersion = response.data && response.data.version;
            if (!remoteVersion) {
                console.log('[GithubVersionChecker] Could not parse remote version');
                return;
            }

            console.log(`[GithubVersionChecker] local=${localVersion} remote=${remoteVersion}`);

            if (
                isRemoteNewer(localVersion, remoteVersion) &&
                remoteVersion !== this.lastNotifiedVersion
            ) {
                const releaseData = await fetchReleaseData(remoteVersion);
                const message = formatReleaseSummary(releaseData, remoteVersion);

                await this.bot.sendMessage(NOTIFICATION_GROUP_ID, message);
                this.lastNotifiedVersion = remoteVersion;
                console.log(`[GithubVersionChecker] Notified: v${remoteVersion}`);
            }
        } catch (error) {
            console.error('[GithubVersionChecker] Check failed:', error.message);
        }
    }

    start() {
        if (this.intervalId) {
            console.log('[GithubVersionChecker] Already running');
            return;
        }
        console.log(`[GithubVersionChecker] Started (interval: ${CHECK_INTERVAL_MS / 1000}s, local: v${localVersion})`);
        this.check();
        this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[GithubVersionChecker] Stopped');
        }
    }
}

module.exports = { GithubVersionChecker, isRemoteNewer };
