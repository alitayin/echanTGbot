// Pure heuristic for detecting non-English text.
// No I/O or side effects (Date.now() is used only for perf timing).

const { stripEmoji, simpleStem } = require('./text.js');
const { HIGH_FREQ_WORDS } = require('./englishHighFreq.js');
const {
    ENGLISH_COVERAGE_SKIP,
    ENGLISH_MIN_COVERAGE,
    ENGLISH_MIN_COVERAGE_STEM,
} = require('../policies/languagePolicy.js');

/**
 * Heuristic to decide whether a message should be checked by the API for
 * language confirmation.
 * - Always computes non-ASCII ratio on emoji-stripped text.
 * - For long text (>50 chars), also computes English high-frequency coverage.
 * Returns { shouldCheckWithApi, reasons, ratio, coverage, coverageStem, length, durationMs }.
 */
function detectNonEnglish(msg) {
    const t0 = Date.now();
    const rawContent = (msg?.text || msg?.caption || '').trim();
    const content = stripEmoji(rawContent);
    const length = content.length;

    if (!content) {
        return { shouldCheckWithApi: false, reasons: ['empty'], ratio: 0, coverage: null, coverageStem: null, length, durationMs: Date.now() - t0 };
    }

    const nonAscii = (content.match(/[^\x00-\x7F]/g) || []).length;
    const ratio = length > 0 ? nonAscii / length : 0;
    const reasons = [];

    if (ratio >= 0.15) {
        reasons.push(`non-ascii-ratio>=0.15 (${ratio.toFixed(3)})`);
    }

    let coverageRaw = null;
    let coverageStem = null;

    if (length > 50) {
        const words = content.toLowerCase().match(/[a-z']+/g) || [];
        if (words.length) {
            let hitsRaw = 0;
            for (const w of words) {
                if (!ENGLISH_COVERAGE_SKIP.has(w) && HIGH_FREQ_WORDS.has(w)) hitsRaw++;
            }
            let hitsStem = hitsRaw;
            if (hitsRaw < words.length) {
                for (const w of words) {
                    if (ENGLISH_COVERAGE_SKIP.has(w) || HIGH_FREQ_WORDS.has(w)) continue;
                    const stem = simpleStem(w);
                    if (!ENGLISH_COVERAGE_SKIP.has(stem) && HIGH_FREQ_WORDS.has(stem)) {
                        hitsStem++;
                    }
                }
            }
            coverageRaw = hitsRaw / words.length;
            coverageStem = hitsStem / words.length;
            if (coverageRaw < ENGLISH_MIN_COVERAGE && coverageStem < ENGLISH_MIN_COVERAGE_STEM) {
                reasons.push(`low-english-coverage raw=${coverageRaw.toFixed(3)}, stem=${coverageStem.toFixed(3)}`);
            }
        } else {
            reasons.push('long-text-no-english-words');
        }
    }

    return {
        shouldCheckWithApi: reasons.length > 0,
        reasons,
        ratio,
        coverage: coverageRaw,
        coverageStem,
        length,
        durationMs: Date.now() - t0
    };
}

module.exports = { detectNonEnglish };
