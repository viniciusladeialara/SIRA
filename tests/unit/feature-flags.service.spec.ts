import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeatureFlagService } from '../../apps/api/src/modules/feature-flags/feature-flag.service.js';

describe('FeatureFlagService (Unit)', () => {
  let service: FeatureFlagService;
  let mockPrisma: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPrisma = {
      feature_flags: {
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
    };

    mockRedis = {
      get: vi.fn(),
      set: vi.fn(),
      del: vi.fn(),
    };

    service = new FeatureFlagService(mockPrisma as any, mockRedis as any);
  });

  it('deve retornar true do cache Redis se a flag estiver habilitada no mapa', async () => {
    mockRedis.get.mockResolvedValueOnce({
      optimizer_enabled: true,
      reports_enabled: false,
    });

    const isEnabled = await service.isEnabled('optimizer_enabled');

    expect(isEnabled).toBe(true);
    expect(mockRedis.get).toHaveBeenCalledWith('sira:feature_flags:all');
    expect(mockPrisma.feature_flags.findMany).not.toHaveBeenCalled();
  });

  it('deve consultar o banco de dados e gravar no Redis em caso de cache miss', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    mockPrisma.feature_flags.findMany.mockResolvedValueOnce([
      { nome: 'reports_enabled', ativo: true },
      { nome: 'optimizer_enabled', ativo: false },
    ]);

    const isEnabled = await service.isEnabled('reports_enabled');

    expect(isEnabled).toBe(true);
    expect(mockPrisma.feature_flags.findMany).toHaveBeenCalled();
    expect(mockRedis.set).toHaveBeenCalledWith(
      'sira:feature_flags:all',
      { reports_enabled: true, optimizer_enabled: false },
      60,
    );
  });

  it('deve retornar false caso a flag não exista no banco nem no Redis', async () => {
    mockRedis.get.mockResolvedValueOnce(null);
    mockPrisma.feature_flags.findMany.mockResolvedValueOnce([]);

    const isEnabled = await service.isEnabled('flag_inexistente');

    expect(isEnabled).toBe(false);
  });
});
