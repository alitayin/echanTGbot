import { describe, expect, it, vi } from 'vitest';

const providerMocks = vi.hoisted(() => ({
    fetchCoinGeckoMarkets: vi.fn(),
    fetchCoinGeckoGlobal: vi.fn(),
    fetchCMCRank: vi.fn(),
}));

vi.mock('../../../src/infrastructure/data/priceProvider.js', () => providerMocks);

import { getFallbackPriceData } from '../../../src/application/usecases/priceHandler.js';

describe('getFallbackPriceData', () => {
    it('reports an empty markets result without masking it with a reference error', async () => {
        providerMocks.fetchCoinGeckoMarkets.mockResolvedValue([]);
        providerMocks.fetchCoinGeckoGlobal.mockResolvedValue({ data: { total_market_cap: { usd: 1 } } });
        providerMocks.fetchCMCRank.mockResolvedValue(null);

        await expect(getFallbackPriceData()).rejects.toThrow('eCash data not found in fallback API');
    });
});
