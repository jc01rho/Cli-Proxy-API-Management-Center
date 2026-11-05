import { afterEach, describe, expect, test } from 'bun:test';
import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/services/api/client';
import { providersApi } from '@/services/api/providers';
import { normalizeProviderGroups } from '@/services/api/transformers';
import type { ProviderKeyConfig } from '@/types';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

const rows = (groups: Record<string, unknown>[]) =>
  normalizeProviderGroups(groups) as ProviderKeyConfig[];

type ReadConfig = AxiosRequestConfig & { onETag?: (etag: string | null) => void };

/**
 * Models the backend ConfigV8 contract: GET returns an ETag for the stored
 * document, a write whose If-Match names an older version fails with 412, and
 * a write without If-Match stays unconditional.
 */
const fakeConfigBackend = (initial: Record<string, unknown>[], readers = 1) => {
  const state = { stored: initial, version: 1, rejected: 0 };
  // The first `readers` GETs are held until all of them were issued, so every
  // tab reads the same version before any tab writes.
  const waiting: Array<() => void> = [];
  apiClient.get = (async (_path: string, config?: ReadConfig) => {
    const snapshot = structuredClone(state.stored);
    const etag = `"v${state.version}"`;
    if (waiting.length < readers) {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
        if (waiting.length === readers) waiting.forEach((release) => release());
      });
    }
    config?.onETag?.(etag);
    return { 'api-keys': { codex: snapshot } };
  }) as unknown as typeof apiClient.get;
  apiClient.put = (async (_path: string, value: unknown, config?: AxiosRequestConfig) => {
    const ifMatch = (config?.headers as Record<string, string> | undefined)?.['If-Match'];
    if (ifMatch !== undefined && ifMatch !== `"v${state.version}"`) {
      state.rejected += 1;
      throw Object.assign(new Error('precondition_failed'), { status: 412 });
    }
    state.stored = structuredClone(value as Record<string, unknown>[]);
    state.version += 1;
  }) as unknown as typeof apiClient.put;
  return state;
};

// TLA+ ConfigWrites A1: two tabs share one GET -> PUT window on one provider group.
describe('concurrent provider config writes', () => {
  test('concurrent saves of two keys in one group keep both changes', async () => {
    const backend = fakeConfigBackend(
      [{ name: 'g', keys: [{ 'api-key': 'k1' }, { 'api-key': 'k2' }] }],
      2
    );
    const [row1, row2] = rows(structuredClone(backend.stored));

    await Promise.all([
      providersApi.updateCodexConfig(row1.apiKey, row1.baseUrl, { ...row1, weight: 7 }),
      providersApi.updateCodexConfig(row2.apiKey, row2.baseUrl, { ...row2, weight: 9 }),
    ]);

    const keys = backend.stored[0].keys as Record<string, unknown>[];
    expect(keys.map((key) => key.weight)).toEqual([7, 9]);
    expect(backend.rejected).toBe(1);
  });

  test('concurrent saves of the same key reject the stale one instead of overwriting', async () => {
    const backend = fakeConfigBackend([{ name: 'g', keys: [{ 'api-key': 'k1' }] }], 2);
    const [row] = rows(structuredClone(backend.stored));

    const results = await Promise.allSettled([
      providersApi.updateCodexConfig(row.apiKey, row.baseUrl, { ...row, weight: 7 }),
      providersApi.updateCodexConfig(row.apiKey, row.baseUrl, { ...row, weight: 9 }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(['fulfilled', 'rejected']);
    const winner = results[0].status === 'fulfilled' ? 7 : 9;
    expect((backend.stored[0].keys as Record<string, unknown>[])[0].weight).toBe(winner);
  });

  // TLA+ ConfigWrites A4: auth-index is a GET-only runtime field; persisted fields are equal.
  test('a runtime-only auth-index difference does not block a save', async () => {
    const backend = fakeConfigBackend([
      { name: 'g', keys: [{ 'api-key': 'k1', 'auth-index': 'a2' }] },
    ]);
    const [row] = rows([{ name: 'g', keys: [{ 'api-key': 'k1', 'auth-index': 'a1' }] }]);

    await providersApi.updateCodexConfig(row.apiKey, row.baseUrl, { ...row, weight: 7 });

    expect((backend.stored[0].keys as Record<string, unknown>[])[0].weight).toBe(7);
  });
});
