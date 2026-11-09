import { describe, expect, it } from 'vitest';
import { renderTimeMessage } from '../../../src/presentation/views/timeView.js';

describe('renderTimeMessage', () => {
    it('includes unrecognized location input in the reply', () => {
        const message = renderTimeMessage({
            times: [],
            unrecognizedInputs: ['New Atlantis'],
            standard: { utc: 'Thu, 01 Jan 2026 00:00:00 GMT', iso: '2026-01-01T00:00:00.000Z', timestamp: 1767225600 },
        });

        expect(message).toContain('Unrecognized locations: New Atlantis');
    });

    it('keeps oversized replies within Telegram length limits without splitting emoji', () => {
        const message = renderTimeMessage({
            times: [],
            unrecognizedInputs: ['😀'.repeat(3000)],
            standard: null,
        });

        expect(message.length).toBeLessThanOrEqual(4096);
        expect(message.endsWith('...')).toBe(true);
        expect(message.slice(0, -3).endsWith('😀')).toBe(true);
    });
});
