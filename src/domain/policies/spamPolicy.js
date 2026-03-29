// Domain policy for spam detection and disciplinary decisions.
// Pure functions only. No side effects, IO, or environment access.

// Disciplinary thresholds
const FIRST_OFFENSE_COUNT = 1;
const MIN_WORD_COUNT_DEFAULT = 1;

// English language detection constants
const ENGLISH_COVERAGE_SKIP = new Set(['dan']); // high-frequency collision words (e.g., Indonesian "dan")
const ENGLISH_MIN_COVERAGE = 0.6;       // minimum high-freq word coverage to treat Latin text as English
const ENGLISH_MIN_COVERAGE_STEM = 0.80; // stricter threshold when using stemmed matching

function containsRelevantKeywords(text, relevantKeywords) {
	const lowercaseText = (text || '').toLowerCase();
	const keywords = Array.isArray(relevantKeywords) ? relevantKeywords : [];
	return keywords.some((keyword) => lowercaseText.includes(String(keyword).toLowerCase()));
}

function calculateSpamScore(measures) {
	const deviation = Number(measures?.deviation || 0);
	const suspicion = Number(measures?.suspicion || 0);
	const inducement = Number(measures?.inducement || 0);
	return deviation + suspicion + inducement;
}

function isSpamMessage(params) {
	const {
		spamFlag,
		deviation,
		suspicion,
		inducement,
		spamThreshold,
		query,
		relevantKeywords,
		minWordCount = MIN_WORD_COUNT_DEFAULT,
	} = params || {};

	const score = calculateSpamScore({ deviation, suspicion, inducement });
	const text = String(query || '');
	const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
	const hasRelevantKeywords = containsRelevantKeywords(text, relevantKeywords);

	return (
		spamFlag === true &&
		score > Number(spamThreshold || 0) &&
		wordCount >= Number(minWordCount || MIN_WORD_COUNT_DEFAULT) &&
		!hasRelevantKeywords
	);
}

function decideSecondarySpamCheck(isPrimarySpam) {
	return Boolean(isPrimarySpam);
}

function decideDisciplinaryAction(options) {
	const currentCount = Number(options?.currentSpamCountInWindow || 0);
	return currentCount === FIRST_OFFENSE_COUNT ? 'warn' : 'kick';
}

module.exports = {
	containsRelevantKeywords,
	calculateSpamScore,
	isSpamMessage,
	decideSecondarySpamCheck,
	decideDisciplinaryAction,
	ENGLISH_COVERAGE_SKIP,
	ENGLISH_MIN_COVERAGE,
	ENGLISH_MIN_COVERAGE_STEM,
};
