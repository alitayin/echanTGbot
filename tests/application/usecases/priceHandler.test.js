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

    it('keeps XEC market data when global market cap is unavailable', async () => {
        providerMocks.fetchCoinGeckoMarkets.mockResolvedValue([{
            current_price: 0.00004,
            price_change_percentage_24h: 2.5,
            market_cap: 1000000,
            total_volume: 50000,
        }]);
        providerMocks.fetchCoinGeckoGlobal.mockResolvedValue(null);
        providerMocks.fetchCMCRank.mockResolvedValue(250);

        const result = await getFallbackPriceData();

        expect(result.currentPrice).toBe(0.00004);
        expect(result.priceChange1h).toBeNull();
        expect(result.totalCryptoMarketCap).toBeNull();
    });
});
