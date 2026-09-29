import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { openaiToResource } from '../src/features/providers/adapters';
import { BaseProviderForm } from '../src/features/providers/sheets/forms/BaseProviderForm';
import { buildOpenAIConfig } from '../src/features/providers/useProviderWorkbench';
import type { ProviderEntryFormInput } from '../src/features/providers/types';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { normalizeOpenAIProvider } from '../src/services/api/transformers';
import { useConfigStore } from '../src/stores/useConfigStore';
import type { OpenAIProviderConfig } from '../src/types';
import '../src/i18n';

const provider = {
  name: 'endpoints-fixture',
  'base-url': 'https://example.invalid/v1',
  'api-key-entries': [{ 'api-key': 'fixture-key' }],
  models: [{ name: 'model-a' }, { name: 'model-b' }],
};

const formInput = (endpoints: string[] | undefined): ProviderEntryFormInput => ({
  apiKey: '',
  name: provider.name,
  baseUrl: provider['base-url'],
  proxyUrl: '',
  prefix: '',
  disabled: false,
  comment: '',
  models: [
    { name: 'model-a', alias: '', supportedEndpoints: endpoints },
    { name: 'model-b', alias: '' },
  ],
  headers: [],
  excludedModelsText: '',
  apiKeyEntries: [{ apiKey: '', existingApiKey: 'fixture-key', proxyUrl: '' }],
});

function renderForm(config: OpenAIProviderConfig | null) {
  return renderToStaticMarkup(
    createElement(BaseProviderForm, {
      brand: 'openaiCompatibility',
      resource: config ? openaiToResource(config, 0) : null,
      mode: config ? 'edit' : 'create',
      mutating: false,
      formId: 'provider-form',
      onSubmit: async () => {},
    })
  );
}

describe('per-model supported-endpoints', () => {
  test('normalizes supported-endpoints per model, legacy models stay unspecified', () => {
    const normalized = normalizeOpenAIProvider({
      ...provider,
      models: [
        { name: 'model-a', 'supported-endpoints': ['/responses'] },
        { name: 'model-b' },
      ],
    });
    expect(normalized?.models?.[0].supportedEndpoints).toEqual(['/responses']);
    expect(normalized?.models?.[1].supportedEndpoints).toBeUndefined();
  });

  test('renders an accessible labelled selector per model row', () => {
    const normalized = normalizeOpenAIProvider({
      ...provider,
      models: [{ name: 'model-a', 'supported-endpoints': ['/responses'] }],
    });
    const markup = renderForm(normalized);
    const selector = markup.match(/<button\b[^>]*id="[^"]*-model-endpoints-0"[^>]*>/)?.[0];
    expect(selector).toBeDefined();
    expect(selector).toContain('aria-haspopup="listbox"');
    expect(selector).toMatch(/aria-label="[^"]*model-a[^"]*"/);
    const hintId = selector?.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(hintId).toBeDefined();
    expect(markup).toContain(`id="${hintId}"`);
  });

  for (const endpoints of [
    ['/responses'],
    ['/chat/completions'],
    ['/responses', '/chat/completions'],
  ]) {
    test(`roundtrips ${endpoints.join(',')} through save, HTTP API, cache and reload`, async () => {
      let stored: unknown = [{ ...provider }];
      const writes: unknown[] = [];
      const server = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        async fetch(request) {
          const path = new URL(request.url).pathname;
          if (request.method === 'PUT' && path === '/v0/management/openai-compatibility') {
            stored = await request.json();
            writes.push(stored);
            return Response.json({ status: 'ok' });
          }
          if (request.method === 'GET' && (path === '/v0/management/config' || path === '/v0/management/openai-compatibility')) {
            return Response.json({ 'openai-compatibility': stored });
          }
          return new Response('Unexpected management request', { status: 404 });
        },
      });
      apiClient.setConfig({ apiBase: server.url.origin, managementKey: 'fixture-management-key' });
      useConfigStore.getState().clearCache();
      try {
        const existing = (await useConfigStore.getState().fetchConfig()).openaiCompatibility?.[0];
        const next = buildOpenAIConfig(formInput(endpoints), existing);
        await providersApi.saveOpenAIProviders([next]);
        useConfigStore.getState().updateConfigValue('openai-compatibility', [next]);

        const savedModels = (writes[0] as Array<{ models: Array<Record<string, unknown>> }>)[0].models;
        expect(savedModels[0]['supported-endpoints']).toEqual(endpoints);
        expect(savedModels[1]['supported-endpoints']).toBeUndefined();
        expect(useConfigStore.getState().isCacheValid()).toBe(false);
        const reloaded = (await useConfigStore.getState().fetchConfig()).openaiCompatibility?.[0];
        expect(reloaded?.models?.[0].supportedEndpoints).toEqual(endpoints);
        expect(reloaded?.models?.[1].supportedEndpoints).toBeUndefined();
        expect(
          (await providersApi.getOpenAIProviders())[0].models?.[0].supportedEndpoints
        ).toEqual(endpoints);
      } finally {
        useConfigStore.getState().clearCache();
        apiClient.setConfig({ apiBase: '', managementKey: '' });
        await server.stop(true);
      }
    });
  }

  test('automatic choice drops a previously saved restriction', async () => {
    let stored: unknown = [
      {
        ...provider,
        models: [
          { name: 'model-a', 'supported-endpoints': ['/responses'] },
          { name: 'model-b' },
        ],
      },
    ];
    const writes: unknown[] = [];
    const server = Bun.serve({
      port: 0,
      hostname: '127.0.0.1',
      async fetch(request) {
        const path = new URL(request.url).pathname;
        if (request.method === 'PUT' && path === '/v0/management/openai-compatibility') {
          stored = await request.json();
          writes.push(stored);
          return Response.json({ status: 'ok' });
        }
        if (request.method === 'GET' && (path === '/v0/management/config' || path === '/v0/management/openai-compatibility')) {
          return Response.json({ 'openai-compatibility': stored });
        }
        return new Response('Unexpected management request', { status: 404 });
      },
    });
    apiClient.setConfig({ apiBase: server.url.origin, managementKey: 'fixture-management-key' });
    useConfigStore.getState().clearCache();
    try {
      const existing = (await useConfigStore.getState().fetchConfig()).openaiCompatibility?.[0];
      expect(existing?.models?.[0].supportedEndpoints).toEqual(['/responses']);
      const next = buildOpenAIConfig(formInput(undefined), existing);
      await providersApi.saveOpenAIProviders([next]);
      const savedModels = (writes[0] as Array<{ models: Array<Record<string, unknown>> }>)[0].models;
      expect(savedModels[0]['supported-endpoints']).toBeUndefined();
      expect(savedModels[1]['supported-endpoints']).toBeUndefined();
    } finally {
      useConfigStore.getState().clearCache();
      apiClient.setConfig({ apiBase: '', managementKey: '' });
      await server.stop(true);
    }
  });

  test('does not expose the selector for other provider brands', () => {
    const markup = renderToStaticMarkup(
      createElement(BaseProviderForm, {
        brand: 'codex',
        resource: null,
        mode: 'create',
        mutating: false,
        formId: 'codex-form',
        onSubmit: async () => {},
      })
    );
    expect(markup).not.toMatch(/id="[^"]*-model-endpoints-\d+"/);
  });
});
