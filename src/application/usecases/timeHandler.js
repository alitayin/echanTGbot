const {
    formatTimeForTimezone,
    formatTimeForUTCOffset,
    parseUTCOffset,
    findCountry,
    findExactLocation,
} = require('../../domain/timezone/timezoneUtils.js');

function resolveInputs(inputs) {
    const values = inputs;
    const resolved = [];
    const unrecognizedInputs = [];
    let pendingUnknown = [];

    function flushUnknown() {
        if (pendingUnknown.length > 0) {
            unrecognizedInputs.push(pendingUnknown.join(' '));
            pendingUnknown = [];
        }
    }

    for (let index = 0; index < values.length;) {
        const offset = parseUTCOffset(values[index]);
        if (offset !== null) {
            flushUnknown();
            resolved.push({ type: 'offset', value: offset, input: values[index] });
            index += 1;
            continue;
        }

        let exactCountry = null;
        let matchedLength = 0;
        const maxLocationWords = Math.min(3, values.length - index);
        for (let length = maxLocationWords; length > 1; length -= 1) {
            const candidate = values.slice(index, index + length).join(' ');
            exactCountry = findExactLocation(candidate);
            if (exactCountry) {
                matchedLength = length;
                break;
            }
        }

        if (exactCountry) {
            flushUnknown();
            resolved.push({ type: 'country', value: exactCountry });
            index += matchedLength;
            continue;
        }

        const country = findCountry(values[index]);
        if (country) {
            flushUnknown();
            resolved.push({ type: 'country', value: country });
        } else {
            pendingUnknown.push(values[index]);
        }
        index += 1;
    }

    flushUnknown();
    return { resolved, unrecognizedInputs };
}

function normalizeTimeInputs(inputs) {
    const values = Array.isArray(inputs)
        ? inputs
        : typeof inputs === 'string'
            ? inputs.trim().split(/\s+/)
            : [];

    return values
        .filter(value => typeof value === 'string')
        .map(value => value.trim())
        .filter(Boolean);
}

async function handleTimeCommand(inputs = []) {
    try {
        const now = new Date();
        const results = [];
        const seenOffsets = new Set();
        const seenTimezones = new Set();
        const inputList = normalizeTimeInputs(inputs);
        const { resolved, unrecognizedInputs } = resolveInputs(inputList);

        if (inputList.length > 0) {
            for (const input of resolved) {
                if (input.type === 'offset') {
                    const utcOffset = input.value;
                    if (seenOffsets.has(utcOffset)) continue;
                    seenOffsets.add(utcOffset);
                    const formatted = formatTimeForUTCOffset(now, utcOffset);
                    results.push({
                        name: `UTC${utcOffset >= 0 ? '+' : ''}${utcOffset}`,
                        time: formatted
                    });
                } else {
                    const country = input.value;
                    if (country && !seenTimezones.has(country.tz)) {
                        const formatted = formatTimeForTimezone(now, country.tz);
                        if (formatted) {
                            seenTimezones.add(country.tz);
                            results.push({
                                name: country.name,
                                time: formatted
                            });
                        }
                    }
                }
            }
        }

        const standardTimes = {
            utc: now.toUTCString(),
            iso: now.toISOString(),
            timestamp: Math.floor(now.getTime() / 1000)
        };

        return {
            times: results,
            unrecognizedInputs,
            standard: standardTimes
        };
    } catch (error) {
        console.error('Failed to handle time command:', error);
        throw error;
    }
}

module.exports = {
    handleTimeCommand
};
