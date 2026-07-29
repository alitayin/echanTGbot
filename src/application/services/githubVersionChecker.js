const axios = require('axios');
const { execFileSync } = require('child_process');
const { NOTIFICATION_GROUP_ID } = require('../../../config/config.js');

const REPO_OWNER = 'alitayin';
const REPO_NAME = 'echanTGbot';
const REMOTE_PACKAGE_URL = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/package.json`;
const REMOTE_COMMIT_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/main`;
const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;
const RELEASE_API_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/tags`;
const CHECK_INTERVAL_MS = parseInt(process.env.GITHUB_VERSION_CHECK_INTERVAL_MS || String(5 * 60 * 1000));

const localVersion = (() => {
    try {
        return require('../../../package.json').version;
    } catch {
        return '0.0.0';
    }
})();

function getLocalCommitSha() {
    try {
        return execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: require('path').resolve(__dirname, '../../..'),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || null;
    } catch {
        return null;
    }
}

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

async function fetchReleaseData(remoteVersion, http = axios) {
    try {
        const response = await http.get(`${RELEASE_API_URL}/v${remoteVersion}`, { timeout: 10000 });
        return response.data || null;
    } catch (error) {
        console.warn(`[GithubVersionChecker] Failed to fetch release details for v${remoteVersion}: ${error.message}`);
        return null;
    }
}

class GithubVersionChecker {
    constructor(bot, options = {}) {
        this.bot = bot;
        this.http = options.http || axios;
        this.localCommitSha = options.localCommitSha === undefined
            ? getLocalCommitSha()
            : options.localCommitSha;
        this.lastNotifiedRevision = null;
        this.intervalId = null;
    }

    async check() {
        if (!NOTIFICATION_GROUP_ID) {
            return;
        }

        try {
            if (this.localCommitSha) {
                try {
                    const commitResponse = await this.http.get(REMOTE_COMMIT_URL, { timeout: 10000 });
                    const remoteCommitSha = commitResponse.data?.sha;
                    if (remoteCommitSha) {
                        console.log(
                            `[GithubVersionChecker] local=${this.localCommitSha.slice(0, 7)} remote=${remoteCommitSha.slice(0, 7)}`
                        );
                        if (
                            remoteCommitSha !== this.localCommitSha &&
                            remoteCommitSha !== this.lastNotifiedRevision
                        ) {
                            const summary = String(commitResponse.data?.commit?.message || 'New commit on main')
                                .split('\n')[0]
                                .slice(0, 200);
                            const commitUrl = commitResponse.data?.html_url || `${REPO_URL}/commit/${remoteCommitSha}`;
                            const message = [
                                '🆕 New echanTGbot commit available!',
                                '',
                                `Current commit: ${this.localCommitSha.slice(0, 7)}`,
                                `Latest commit: ${remoteCommitSha.slice(0, 7)}`,
                                '',
                                summary,
                                commitUrl,
                            ].join('\n');
                            await this.bot.sendMessage(NOTIFICATION_GROUP_ID, message);
                            this.lastNotifiedRevision = remoteCommitSha;
                            console.log(`[GithubVersionChecker] Notified: ${remoteCommitSha.slice(0, 7)}`);
                        }
                        return;
                    }
                } catch (error) {
                    console.warn(`[GithubVersionChecker] Commit check failed, using version fallback: ${error.message}`);
                }
            }

            const response = await this.http.get(REMOTE_PACKAGE_URL, { timeout: 10000 });
            const remoteVersion = response.data && response.data.version;
            if (!remoteVersion) {
                console.log('[GithubVersionChecker] Could not parse remote version');
                return;
            }

            console.log(`[GithubVersionChecker] local=${localVersion} remote=${remoteVersion}`);

            if (
                isRemoteNewer(localVersion, remoteVersion) &&
                `version:${remoteVersion}` !== this.lastNotifiedRevision
            ) {
                const releaseData = await fetchReleaseData(remoteVersion, this.http);
                const message = formatReleaseSummary(releaseData, remoteVersion);

                await this.bot.sendMessage(NOTIFICATION_GROUP_ID, message);
                this.lastNotifiedRevision = `version:${remoteVersion}`;
                console.log(`[GithubVersionChecker] Notified: v${remoteVersion}`);
            }
        } catch (error) {
            console.error('[GithubVersionChecker] Check failed:', error.message);
        }
    }

    start() {
        if (!NOTIFICATION_GROUP_ID) {
            console.log('[GithubVersionChecker] Disabled: NOTIFICATION_GROUP_ID is not configured');
            return;
        }
        if (this.intervalId) {
            console.log('[GithubVersionChecker] Already running');
            return;
        }
        console.log(`[GithubVersionChecker] Started (interval: ${CHECK_INTERVAL_MS / 1000}s, local: v${localVersion})`);
        this.check();
        this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
        this.intervalId.unref?.();
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[GithubVersionChecker] Stopped');
        }
    }
}

module.exports = { GithubVersionChecker, isRemoteNewer, getLocalCommitSha };
