const axios = require('axios');
const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');

const REMOTE_PACKAGE_URL = 'https://raw.githubusercontent.com/alitayin/echanTGbot/main/package.json';
const REPO_URL = 'https://github.com/alitayin/echanTGbot';
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
                const message =
                    `🆕 New version of echanTGbot available!\n\n` +
                    `Current: v${localVersion}\n` +
                    `Latest: v${remoteVersion}\n\n` +
                    `${REPO_URL}`;

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
