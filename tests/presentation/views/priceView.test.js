import { describe, expect, it } from 'vitest';
import { renderPriceMessage } from '../../../src/presentation/views/priceView.js';

describe('renderPriceMessage', () => {
    it('returns an unavailable message for a missing response', () => {
        expect(renderPriceMessage(null)).toContain('Price data unavailable');
    });
    it('marks missing metrics as unavailable instead of zero', () => {
        const message = renderPriceMessage({
            priceChange1h: null,
            totalCryptoMarketCap: null,
        });

        expect(message).toContain('Current Price: N/A');
        expect(message).toContain('Price Change (%) 1h: N/A');
        expect(message).toContain('Market Cap: N/A');
        expect(message).toContain('Volume 24h: N/A');
        expect(message).toContain('Total Crypto Market Cap: N/A');
    });

    it('keeps real zero values visible', () => {
        const message = renderPriceMessage({ currentPrice: 0, priceChange24h: 0 });

        expect(message).toContain('Current Price: $0.0000');
        expect(message).toContain('Price Change (%) 24h: 0.00%');
    });

    it('shows only a positive integer as the CoinMarketCap rank', () => {
        expect(renderPriceMessage({ cmcRank: 12 })).toContain('CMC Rank: 12');
        expect(renderPriceMessage({ cmcRank: 0 })).toContain('CMC Rank: N/A');
        expect(renderPriceMessage({ cmcRank: '12' })).toContain('CMC Rank: N/A');
    });
});
