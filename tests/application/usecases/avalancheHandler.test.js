import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Module, { createRequire } from 'module';

const require = createRequire(import.meta.url);
const originalLoad = Module._load;
const handlerPath = require.resolve('../../../src/application/usecases/avalancheHandler.js');
const providerPath = require.resolve('../../../src/infrastructure/data/avalancheProvider.js');

const providerMocks = vi.hoisted(() => ({
    fetchAvalancheSummary: vi.fn(),
    fetchAvalancheAPY: vi.fn(),
    fetchXecSimplePrice: vi.fn(),
}));

let getAvalancheData;

beforeEach(() => {
    Module._load = function patchedLoad(request, parent, isMain) {
        const resolved = Module._resolveFilename(request, parent, isMain);
        if (resolved === providerPath) return providerMocks;
        return originalLoad.call(this, request, parent, isMain);
    };

    delete require.cache[handlerPath];
    ({ getAvalancheData } = require(handlerPath));
    vi.clearAllMocks();
});

afterEach(() => {
    Module._load = originalLoad;
    delete require.cache[handlerPath];
});

describe('getAvalancheData', () => {
    it('leaves derived stake value unavailable when the XEC price is missing', async () => {
        providerMocks.fetchAvalancheSummary.mockResolvedValue({ totalStake: 1000, nodeCount: 2, proofCount: 4 });
        providerMocks.fetchAvalancheAPY.mockResolvedValue({ apy: 0.1 });
        providerMocks.fetchXecSimplePrice.mockResolvedValue({ ecash: {} });

        const result = await getAvalancheData();

        expect(result.xecPrice).toBeNull();
        expect(result.totalStakedValue).toBeNull();
    });

    it('keeps network statistics when optional APY and price requests fail', async () => {
        providerMocks.fetchAvalancheSummary.mockResolvedValue({ totalStake: 1000, nodeCount: 2, proofCount: 4 });
        providerMocks.fetchAvalancheAPY.mockRejectedValue(new Error('APY unavailable'));
        providerMocks.fetchXecSimplePrice.mockRejectedValue(new Error('price unavailable'));

        const result = await getAvalancheData();
        expect(result.totalStake).toBe(1000);
        expect(result.nodeCount).toBe(2);
        expect(result.apy).toBeNull();
        expect(result.totalStakedValue).toBeNull();
    });

    it('reports a missing summary clearly', async () => {
        providerMocks.fetchAvalancheSummary.mockResolvedValue(null);
        providerMocks.fetchAvalancheAPY.mockResolvedValue(null);
        providerMocks.fetchXecSimplePrice.mockResolvedValue(null);
        await expect(getAvalancheData()).rejects.toThrow('Avalanche summary data is unavailable');
    });

    it('does not expose overflow as a derived monetary value', async () => {
        providerMocks.fetchAvalancheSummary.mockResolvedValue({ totalStake: Number.MAX_VALUE });
        providerMocks.fetchAvalancheAPY.mockResolvedValue(null);
        providerMocks.fetchXecSimplePrice.mockResolvedValue({ ecash: { usd: 2 } });
        expect((await getAvalancheData()).totalStakedValue).toBeNull();
    });
});
