import { describe, expect, it, vi } from 'vitest';

const providerMocks = vi.hoisted(() => ({
    fetchAvalancheSummary: vi.fn(),
    fetchAvalancheAPY: vi.fn(),
    fetchXecSimplePrice: vi.fn(),
}));

vi.mock('../../../src/infrastructure/data/avalancheProvider.js', () => providerMocks);

import { getAvalancheData } from '../../../src/application/usecases/avalancheHandler.js';

describe('getAvalancheData', () => {
    it('leaves derived stake value unavailable when the XEC price is missing', async () => {
        providerMocks.fetchAvalancheSummary.mockResolvedValue({ totalStake: 1000, nodeCount: 2, proofCount: 4 });
        providerMocks.fetchAvalancheAPY.mockResolvedValue({ apy: 0.1 });
        providerMocks.fetchXecSimplePrice.mockResolvedValue({ ecash: {} });

        const result = await getAvalancheData();

        expect(result.xecPrice).toBeNull();
        expect(result.totalStakedValue).toBeNull();
    });
});
