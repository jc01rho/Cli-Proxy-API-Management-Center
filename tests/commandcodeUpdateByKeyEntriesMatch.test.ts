// Regression test for: editing a commandcode/freebuff custom model shows the
// "Updated" success toast but the change never lands.
//
// Root cause: `serializeProviderKey` treats `api-key-entries` as the source
// of truth once entries exist and clears the top-level `api-key` on save
// (see providers.ts). commandcode/freebuff resources keep using that
// original key as their `selector.apiKey` (see adapters.ts
// `commandcodeToResource`/`freebuffToResource`, which fall back to
// `entries[0].apiKey`). `updateCommandCodeConfigByKey`/`updateFreebuffConfigByKey`
// find the record to replace via `matchesProviderKey`, which used to compare
// only against the top-level `api-key` field. Once that field is empty, the
// match silently fails: the `.map()` returns the list unchanged, the PUT
// round-trips the same data, the backend responds 200, and the UI shows a
// success toast while nothing was actually updated.
//
// This reproduces the exact second-edit scenario: a commandcode record whose
// credential lives only in `api-key-entries` (as it does after the first
// save) must still be found and replaced by a later update.

import { afterEach, describe, expect, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import type { ProviderKeyConfig } from '@/types';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

const entriesOnlyRecord = {
  'base-url': 'https://api.commandcode.ai',
  'api-key-entries': [{ 'api-key': 'cc-secret-key' }],
  models: [{ name: 'claude-sonnet-5' }],
};

describe('commandcode/freebuff update-by-key matches entries-only records', () => {
  test('updateCommandCodeConfigByKey replaces the record when api-key lives only in api-key-entries', async () => {
    let written: unknown;
    apiClient.get = (async () => ({ 'commandcode-api-key': [entriesOnlyRecord] })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, body: unknown) => {
      written = body;
      return {};
    }) as typeof apiClient.put;

    const nextConfig: ProviderKeyConfig = {
      apiKey: '',
      apiKeyEntries: [{ apiKey: 'cc-secret-key' }],
      baseUrl: 'https://api.commandcode.ai',
      models: [{ name: 'claude-opus-5' }],
    };

    await providersApi.updateCommandCodeConfigByKey(
      'cc-secret-key',
      'https://api.commandcode.ai',
      nextConfig
    );

    expect(Array.isArray(written)).toBe(true);
    const list = written as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    // Before the fix, matchesProviderKey never found the record (top-level
    // api-key was empty), so the list came back byte-identical to the
    // original with the stale model name still present.
    expect(list[0].models).toEqual([{ name: 'claude-opus-5' }]);
  });

  test('updateFreebuffConfigByKey replaces the record when api-key lives only in api-key-entries', async () => {
    let written: unknown;
    apiClient.get = (async () => ({
      'freebuff-api-key': [
        {
          'base-url': 'https://www.codebuff.com',
          'api-key-entries': [{ 'api-key': 'fb-secret-key' }],
          models: [{ name: 'base2' }],
        },
      ],
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, body: unknown) => {
      written = body;
      return {};
    }) as typeof apiClient.put;

    const nextConfig: ProviderKeyConfig = {
      apiKey: '',
      apiKeyEntries: [{ apiKey: 'fb-secret-key' }],
      baseUrl: 'https://www.codebuff.com',
      models: [{ name: 'base3' }],
    };

    await providersApi.updateFreebuffConfigByKey(
      'fb-secret-key',
      'https://www.codebuff.com',
      nextConfig
    );

    const list = written as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0].models).toEqual([{ name: 'base3' }]);
  });

  test('does not match a different api-key-entries record with the same base-url', async () => {
    let written: unknown;
    apiClient.get = (async () => ({
      'commandcode-api-key': [
        {
          'base-url': 'https://api.commandcode.ai',
          'api-key-entries': [{ 'api-key': 'other-key' }],
          models: [{ name: 'untouched' }],
        },
      ],
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, body: unknown) => {
      written = body;
      return {};
    }) as typeof apiClient.put;

    const nextConfig: ProviderKeyConfig = {
      apiKey: '',
      apiKeyEntries: [{ apiKey: 'cc-secret-key' }],
      baseUrl: 'https://api.commandcode.ai',
      models: [{ name: 'claude-opus-5' }],
    };

    await providersApi.updateCommandCodeConfigByKey(
      'cc-secret-key',
      'https://api.commandcode.ai',
      nextConfig
    );

    const list = written as Array<Record<string, unknown>>;
    expect(list[0].models).toEqual([{ name: 'untouched' }]);
  });
});
