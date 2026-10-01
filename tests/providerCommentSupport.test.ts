import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BaseProviderForm } from '../src/features/providers/sheets/forms/BaseProviderForm';
import type { ProviderBrand } from '../src/features/providers/types';
import { apiClient } from '../src/services/api/client';
import { providersApi } from '../src/services/api/providers';
import '../src/i18n';

const originalGet = apiClient.get;
const originalPut = apiClient.put;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.put = originalPut;
});

function renderCreateForm(brand: ProviderBrand) {
  return renderToStaticMarkup(
    createElement(BaseProviderForm, {
      brand,
      resource: null,
      mode: 'create',
      mutating: false,
      formId: `${brand}-form`,
      onSubmit: async () => {},
    })
  );
}

describe('provider comment support', () => {
  test('shows the provider comment input only where the backend stores it', () => {
    for (const brand of ['commandcode', 'freebuff', 'mistral', 'opencode'] as const) {
      expect(renderCreateForm(brand)).toMatch(/id="[^"]*-comment"/);
    }
    for (const brand of ['gemini', 'codex', 'claude', 'vertex', 'openaiCompatibility'] as const) {
      expect(renderCreateForm(brand)).not.toMatch(/id="[^"]*-comment"/);
    }
  });

  test('does not send a comment the v8 key schema rejects', async () => {
    let written: unknown;
    apiClient.get = (async () => ({ 'api-keys': { claude: [] } })) as typeof apiClient.get;
    apiClient.put = (async (_url: string, data?: unknown) => {
      written = data;
      return undefined;
    }) as typeof apiClient.put;

    await providersApi.createClaudeConfig({
      apiKey: 'claude-key',
      baseUrl: 'https://claude.example',
      comment: 'kept in the form only',
    });

    expect(JSON.stringify(written)).not.toContain('comment');
    expect(JSON.stringify(written)).toContain('claude-key');
  });
});
