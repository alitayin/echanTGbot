import { describe, expect, it } from 'vitest';
import { handleTimeCommand } from '../../../src/application/usecases/timeHandler.js';

describe('handleTimeCommand', () => {
    it('resolves multi-word countries and cities alongside UTC offsets', async () => {
        const result = await handleTimeCommand(['New', 'York', 'UTC+8']);

        expect(result.times.map(({ name }) => name)).toEqual(['USA', 'UTC+8']);
    });

    it('continues to resolve multiple single-word locations', async () => {
        const result = await handleTimeCommand(['Shanghai', 'Tokyo']);

        expect(result.times.map(({ name }) => name)).toEqual(['China', 'Japan']);
    });

    it('keeps cities with different timezones in the same country as separate results', async () => {
        const result = await handleTimeCommand('Los Angeles Chicago New York');
        expect(result.times.map(({ name }) => name)).toEqual(['Los Angeles', 'Chicago', 'USA']);
    });

    it('deduplicates repeated offsets and locations in the same timezone', async () => {
        const result = await handleTimeCommand(['UTC+8', 'utc+8', 'China', 'Shanghai']);

        expect(result.times.map(({ name }) => name)).toEqual(['UTC+8', 'China']);
    });

    it('deduplicates clock offsets against the equivalent decimal offset', async () => {
        const result = await handleTimeCommand('UTC+05:30 UTC+5.5');
        expect(result.times.map(({ name }) => name)).toEqual(['UTC+5.5']);
    });

    it('returns contiguous unknown location text for clear feedback', async () => {
        const result = await handleTimeCommand(['New', 'Atlantis', 'China']);

        expect(result.times.map(({ name }) => name)).toEqual(['China']);
        expect(result.unrecognizedInputs).toEqual(['New Atlantis']);
    });

    it('normalizes string, null, and mixed-type inputs safely', async () => {
        const fromString = await handleTimeCommand('New York');
        const fromNull = await handleTimeCommand(null);
        const fromMixed = await handleTimeCommand([null, 'UTC+8']);

        expect(fromString.times.map(({ name }) => name)).toEqual(['USA']);
        expect(fromNull.times).toEqual([]);
        expect(fromMixed.times.map(({ name }) => name)).toEqual(['UTC+8']);
    });
});
