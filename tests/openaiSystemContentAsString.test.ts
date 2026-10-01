import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { openaiToResource } from '../src/features/providers/adapters';
import { BaseProviderForm } from '../src/features/providers/sheets/forms/BaseProviderForm';
import { buildOpenAIConfig } from '../src/features/providers/useProviderWorkbench';
import type { ProviderEntryFormInput } from '../src/features/providers/types';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import { normalizeOpenAIProvider } from '../src/services/api/transformers';
import { useConfigStore } from '../src/stores/useConfigStore';
import type { OpenAIProviderConfig } from '../src/types';
import { runVisualConfig } from './helpers/visualConfig';
import '../src/i18n';

const provider = {
  name: 'string-system-fixture',
  'base-url': 'https://example.invalid/v1',
  keys: [{ 'api-key': 'fixture-key' }],
  models: [{ name: 'fixture-model' }],
};

const formInput: ProviderEntryFormInput = {
  apiKey: '',
  name: provider.name,
  baseUrl: provider['base-url'],
  proxyUrl: '',
  prefix: '',
  disabled: false,
  comment: '',
  models: [{ name: 'fixture-model', alias: '' }],
  headers: [],
  excludedModelsText: '',
  apiKeyEntries: [{ apiKey: '', existingApiKey: 'fixture-key', proxyUrl: '' }],
};

function renderForm(config: OpenAIProviderConfig | null, mutating = false) {
  return renderToStaticMarkup(
    createElement(BaseProviderForm, {
      brand: 'openaiCompatibility',
      resource: config ? openaiToResource(config, 0) : null,
      mode: config ? 'edit' : 'create',
      mutating,
      formId: 'provider-form',
      onSubmit: async () => {},
    })
  );
}

function checkbox(markup: string) {
  const input = markup.match(/<input\b[^>]*name="systemContentAsString"[^>]*>/)?.[0];
  if (!input) throw new Error('Provider system-content checkbox missing');
  return input;
}

describe('OpenAI provider system content as string', () => {
  for (const value of [true, false]) {
    for (const field of ['system-content-as-string', 'systemContentAsString']) {
      test(`normalizes ${field}=${value} at provider level`, () => {
        const normalized = normalizeOpenAIProvider({ ...provider, [field]: value });
        expect(normalized?.systemContentAsString).toBe(value);
        expect(normalized?.models).toMatchObject([{ name: 'fixture-model' }]);
      });
    }

    test(`renders saved ${value} with a labelled checkbox and saving lock`, () => {
      const config = normalizeOpenAIProvider({ ...provider, 'system-content-as-string': value });
      const input = checkbox(renderForm(config, true));
      expect(input.includes('checked=""')).toBe(value);
      expect(input).toContain('disabled=""');
      expect(input).toContain('aria-labelledby=');
      expect(input).toContain('aria-describedby=');
    });

    test(`preserves ${value} through form save, HTTP API, cache and reload`, async () => {
      let stored: unknown = [{ ...provider, 'system-content-as-string': !value }];
      const writes: unknown[] = [];
      const server = Bun.serve({
        port: 0,
        hostname: '127.0.0.1',
        async fetch(request) {
          const path = new URL(request.url).pathname;
          if (request.method === 'PUT' && path === '/v8/management/config/api-keys/openai-compatibility') {
            stored = await request.json();
            writes.push(stored);
            return Response.json({ status: 'ok' });
          }
          if (request.method === 'GET' && path === '/v8/management/config') {
            return Response.json({ 'api-keys': { 'openai-compatibility': stored } });
          }
          return new Response('Unexpected management request', { status: 404 });
        },
      });
      apiClient.setConfig({ apiBase: server.url.origin, managementKey: 'fixture-management-key' });
      useConfigStore.getState().clearCache();
      try {
        const existing = (await useConfigStore.getState().fetchConfig()).openaiCompatibility?.[0];
        expect(existing?.systemContentAsString).toBe(!value);
        const next = buildOpenAIConfig({ ...formInput, systemContentAsString: value }, existing);

        await providersApi.updateOpenAIProvider(next.name, 0, next);
        useConfigStore.getState().updateConfigValue('openai-compatibility', [next]);

        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject([{ 'system-content-as-string': value }]);
        expect(useConfigStore.getState().config?.openaiCompatibility?.[0].systemContentAsString)
          .toBe(value);
        expect(useConfigStore.getState().isCacheValid()).toBe(false);
        const reloaded = (await useConfigStore.getState().fetchConfig()).openaiCompatibility?.[0];
        expect(reloaded?.systemContentAsString).toBe(value);
        expect(checkbox(renderForm(reloaded ?? null)).includes('checked=""')).toBe(value);
        expect((await providersApi.getOpenAIProviders())[0].systemContentAsString).toBe(value);

        // Disabling a provider uses another serializer path and must retain the override.
        const current = (await providersApi.getOpenAIProviders())[0];
        await providersApi.updateOpenAIProviderDisabled(0, true, current.source);
        expect((await providersApi.getOpenAIProviders())[0].systemContentAsString).toBe(value);
      } finally {
        useConfigStore.getState().clearCache();
        apiClient.setConfig({ apiBase: '', managementKey: '' });
        await server.stop(true);
      }
    });

    test(`preserves ${value} when saving unrelated visual YAML settings`, () => {
      const document = {
        'api-keys': { 'openai-compatibility': [{ ...provider, 'system-content-as-string': value }] },
      };
      const yaml = stringifyYaml(document);
      const visual = runVisualConfig(yaml, [{ debug: true }]);
      expect(parseYaml(visual.applyVisualChangesToYaml(yaml))).toEqual({
        ...document,
        observability: { logs: { debug: true } },
      });
    });
  }

  test('omitted option keeps new and existing providers unchecked', () => {
    const normalized = normalizeOpenAIProvider(provider);
    expect(normalized?.systemContentAsString).toBeUndefined();
    expect(checkbox(renderForm(normalized))).not.toContain('checked=""');
    expect(checkbox(renderForm(null))).not.toContain('checked=""');
    expect(buildOpenAIConfig(formInput).systemContentAsString).toBe(false);
  });

  test('does not expose the checkbox for other provider brands', () => {
    const markup = renderToStaticMarkup(createElement(BaseProviderForm, {
      brand: 'codex',
      resource: null,
      mode: 'create',
      mutating: false,
      formId: 'codex-form',
      onSubmit: async () => {},
    }));
    expect(markup).not.toContain('name="systemContentAsString"');
  });
});
