import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Module, { createRequire } from 'module';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const handlerPath = require.resolve('../../../src/application/usecases/priceHandler.js');
const providerPath = require.resolve('../../../src/infrastructure/data/priceProvider.js');

const providerMocks = vi.hoisted(() => ({
    fetchCoinGeckoMarkets: vi.fn(),
    fetchCoinGeckoGlobal: vi.fn(),
    fetchCMCRank: vi.fn(),
}));

let getFallbackPriceData;

beforeEach(() => {
    Module._load = function patchedLoad(request, parent, isMain) {
        const resolved = Module._resolveFilename(request, parent, isMain);
        if (resolved === providerPath) return providerMocks;
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[handlerPath];
    ({ getFallbackPriceData } = require(handlerPath));
    vi.clearAllMocks();
});

afterEach(() => {
    Module._load = originalLoad;
    delete require.cache[handlerPath];
});

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

    it('keeps market data when optional global and ranking requests fail', async () => {
        providerMocks.fetchCoinGeckoMarkets.mockResolvedValue([{
            current_price: 0.00004,
            price_change_percentage_24h: 2.5,
            market_cap: 1000000,
            total_volume: 50000,
        }]);
        providerMocks.fetchCoinGeckoGlobal.mockRejectedValue(new Error('global unavailable'));
        providerMocks.fetchCMCRank.mockRejectedValue(new Error('rank unavailable'));

        const result = await getFallbackPriceData();

        expect(result.currentPrice).toBe(0.00004);
        expect(result.totalCryptoMarketCap).toBeNull();
        expect(result.cmcRank).toBeNull();
    });

    it('returns real hourly changes and preserves missing daily changes', async () => {
        providerMocks.fetchCoinGeckoMarkets.mockResolvedValue([{
            current_price: 0.00004,
            price_change_percentage_1h_in_currency: -1.25,
        }]);
        providerMocks.fetchCoinGeckoGlobal.mockResolvedValue(null);
        providerMocks.fetchCMCRank.mockResolvedValue(null);

        const result = await getFallbackPriceData();
        expect(result.priceChange1h).toBe(-1.25);
        expect(result.priceChange24h).toBeNull();
    });

    it('marks invalid currency metrics unavailable without changing negative price changes', async () => {
        providerMocks.fetchCoinGeckoMarkets.mockResolvedValue([{
            current_price: -1, market_cap: Infinity, total_volume: -50,
            price_change_percentage_24h: -2.5,
        }]);
        providerMocks.fetchCoinGeckoGlobal.mockResolvedValue({ data: { total_market_cap: { usd: -1 } } });
        providerMocks.fetchCMCRank.mockResolvedValue(null);
        const result = await getFallbackPriceData();
        expect(result.currentPrice).toBeNull();
        expect(result.marketCap).toBeNull();
        expect(result.volume24h).toBeNull();
        expect(result.totalCryptoMarketCap).toBeNull();
        expect(result.priceChange24h).toBe(-2.5);
    });
});
