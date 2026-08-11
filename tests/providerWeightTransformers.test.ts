import { afterEach, describe, expect, test } from 'bun:test';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import {
  normalizeGeminiKeyConfig,
  normalizeOpenAIProvider,
  normalizeProviderKeyConfig,
} from '../src/services/api/transformers';

const originalGet = apiClient.get;
const originalPut = apiClient.put;
const originalPatch = apiClient.patch;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
  apiClient.patch = originalPatch;
});

describe('provider credential weight normalization', () => {
  test('reads weight for direct API key credentials', () => {
    expect(normalizeGeminiKeyConfig({ 'api-key': 'gemini-key', weight: 5 })?.weight).toBe(5);
    expect(normalizeProviderKeyConfig({ 'api-key': 'provider-key', weight: 0 })?.weight).toBe(0);
  });

  test('reads per-key weight for OpenAI-compatible providers', () => {
    const provider = normalizeOpenAIProvider({
      name: 'example',
      'base-url': 'https://example.com/v1',
      'api-key-entries': [{ 'api-key': 'key-a', weight: 3 }, { 'api-key': 'key-b' }],
    });

    expect(provider?.apiKeyEntries[0]?.weight).toBe(3);
    expect(provider?.apiKeyEntries[1]?.weight).toBeUndefined();
  });

  test('removes a cleared Vertex weight while preserving unknown fields', async () => {
    let written: unknown;
    apiClient.get = (async () => ({
      'vertex-api-key': [
        {
          'api-key': 'vertex-key',
          'base-url': 'https://vertex.example',
          weight: 9,
          'future-field': 'keep',
        },
      ],
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, data?: unknown) => {
      written = data;
      return undefined;
    }) as typeof apiClient.put;

    await providersApi.saveVertexConfigs([
      {
        apiKey: 'vertex-key',
        baseUrl: 'https://vertex.example',
        weight: undefined,
      },
    ]);

    expect(written).toEqual([
      {
        'api-key': 'vertex-key',
        'base-url': 'https://vertex.example',
        'future-field': 'keep',
      },
    ]);
  });

  test('writes and clears nested OpenAI-compatible key weights', async () => {
    let written: unknown;
    apiClient.get = (async () => ({
      'openai-compatibility': [
        {
          name: 'example',
          'base-url': 'https://example.com/v1',
          'api-key-entries': [
            { 'api-key': 'key-a', weight: 8, custom: 'keep-a' },
            { 'api-key': 'key-b', custom: 'keep-b' },
          ],
        },
      ],
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, data?: unknown) => {
      written = data;
      return undefined;
    }) as typeof apiClient.put;

    await providersApi.saveOpenAIProviders([
      {
        name: 'example',
        baseUrl: 'https://example.com/v1',
        apiKeyEntries: [
          { apiKey: 'key-a', weight: undefined },
          { apiKey: 'key-b', weight: 4 },
        ],
      },
    ]);

    expect(written).toEqual([
      {
        name: 'example',
        'base-url': 'https://example.com/v1',
        'api-key-entries': [
          { 'api-key': 'key-a', custom: 'keep-a' },
          { 'api-key': 'key-b', custom: 'keep-b', weight: 4 },
        ],
      },
    ]);
  });

  test('round-trips CommandCode API key entries through GET, PUT, and PATCH', async () => {
    const writes: Array<{ method: string; data: unknown }> = [];
    apiClient.get = (async () => ({
      'commandcode-api-key': [
        {
          'base-url': 'https://commandcode.example/v1',
          'api-key-entries': [
            {
              'api-key': 'key-a',
              weight: 3,
              'proxy-url': 'socks5://proxy-a.example:1080',
              comment: 'primary',
            },
            { 'api-key': 'key-b', weight: 1, comment: 'secondary' },
          ],
        },
      ],
    })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, data?: unknown) => {
      writes.push({ method: 'PUT', data });
      return undefined;
    }) as typeof apiClient.put;
    apiClient.patch = (async (_url: string, data?: unknown) => {
      writes.push({ method: 'PATCH', data });
      return undefined;
    }) as typeof apiClient.patch;

    const configs = await providersApi.getCommandCodeConfigs();
    expect(configs).toEqual([
      {
        apiKey: '',
        baseUrl: 'https://commandcode.example/v1',
        apiKeyEntries: [
          {
            apiKey: 'key-a',
            weight: 3,
            proxyUrl: 'socks5://proxy-a.example:1080',
            comment: 'primary',
          },
          { apiKey: 'key-b', weight: 1, proxyUrl: undefined, comment: 'secondary' },
        ],
      },
    ]);

    await providersApi.saveCommandCodeConfigs(configs);
    await providersApi.updateCommandCodeConfig(0, configs[0]!);

    const serialized = {
      'base-url': 'https://commandcode.example/v1',
      'api-key-entries': [
        {
          'api-key': 'key-a',
          weight: 3,
          'proxy-url': 'socks5://proxy-a.example:1080',
          comment: 'primary',
        },
        { 'api-key': 'key-b', weight: 1, comment: 'secondary' },
      ],
    };
    expect(writes).toEqual([
      { method: 'PUT', data: [serialized] },
      { method: 'PATCH', data: { index: 0, value: serialized } },
    ]);
  });
});
