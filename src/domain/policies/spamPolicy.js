// Domain policy for spam detection and disciplinary decisions.
// Pure functions only. No side effects, IO, or environment access.

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
		minWordCount = 1,
	} = params || {};

	const score = calculateSpamScore({ deviation, suspicion, inducement });
	const text = String(query || '');
	const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
	const hasRelevantKeywords = containsRelevantKeywords(text, relevantKeywords);

	return (
		spamFlag === true &&
		score > Number(spamThreshold || 0) &&
		wordCount >= Number(minWordCount || 1) &&
		!hasRelevantKeywords
	);
}

function decideSecondarySpamCheck(isPrimarySpam) {
	return Boolean(isPrimarySpam);
}

function decideDisciplinaryAction(options) {
	const currentCount = Number(options?.currentSpamCountInWindow || 0);
	return currentCount === 1 ? 'warn' : 'kick';
}

module.exports = {
	containsRelevantKeywords,
	calculateSpamScore,
	isSpamMessage,
	decideSecondarySpamCheck,
	decideDisciplinaryAction,
};


