import { describe, expect, test } from 'bun:test';
import { PROVIDER_BRAND_ORDER, PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import { buildProviderGroups } from '../src/features/providers/useProviderWorkbench';
import { providersApi } from '../src/services/api/providers';

describe('removed freebuff provider', () => {
  test('is not offered as a provider brand', () => {
    expect(PROVIDER_BRAND_ORDER as readonly string[]).not.toContain('freebuff');
    expect(Object.keys(PROVIDER_DESCRIPTORS)).not.toContain('freebuff');
    expect(buildProviderGroups({}).map((group) => group.id)).not.toContain('freebuff');
  });

  test('has no management API surface left', () => {
    const api = providersApi as unknown as Record<string, unknown>;
    for (const method of [
      'getFreebuffConfigs',
      'saveFreebuffConfigs',
      'updateFreebuffConfig',
      'deleteFreebuffConfig',
      'createFreebuffConfig',
      'updateFreebuffConfigByKey',
    ]) {
      expect(method in api).toBe(false);
    }
  });
});
