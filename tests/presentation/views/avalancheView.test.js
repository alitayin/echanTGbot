import { describe, expect, it } from 'vitest';
import { renderAvalancheMessage } from '../../../src/presentation/views/avalancheView.js';

describe('renderAvalancheMessage', () => {
    it('shows unavailable values without rendering NaN or undefined', () => {
        const message = renderAvalancheMessage({
            totalStake: null,
            apy: NaN,
            totalStakedValue: null,
            proofCount: undefined,
            nodeCount: -1,
        });

        expect(message).toContain('Total Staked: N/A');
        expect(message).toContain('Current APY: N/A');
        expect(message).toContain('Total Staked Value: N/A');
        expect(message).toContain('Number of Peers: N/A');
        expect(message).toContain('Number of Nodes: N/A');
        expect(message).not.toMatch(/NaN|undefined/);
    });

    it('renders an unavailable response when no data object is supplied', () => {
        expect(renderAvalancheMessage(null)).toBe('Avalanche data unavailable.');
    });

    it('does not render overflowing APY percentages as Infinity', () => {
        expect(renderAvalancheMessage({ apy: Number.MAX_VALUE })).toContain('Current APY: N/A');
    });
});
