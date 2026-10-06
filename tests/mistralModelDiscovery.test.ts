import { afterEach, describe, expect, spyOn, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildMistralChatCompletionsEndpoint } from '../src/components/providers/utils';
import { PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import {
  useConnectivityTest,
  type ConnectivityErrorMessages,
} from '../src/features/providers/sheets/forms/useConnectivityTest';
import {
  MODEL_DISCOVERY_BRANDS,
  useModelDiscovery,
} from '../src/features/providers/sheets/forms/useModelDiscovery';
import { apiCallApi } from '../src/services/api/apiCall';

function captureHook<T>(hook: () => T): T {
  let result: T;
  function Harness() {
    result = hook();
    return null;
  }
  renderToStaticMarkup(createElement(Harness));
  return result!;
}

const messages: ConnectivityErrorMessages = {
  baseUrlRequired: 'base required',
  endpointInvalid: 'invalid endpoint',
  apiKeyRequired: 'key required',
  modelRequired: 'model required',
  timeout: () => 'timeout',
  requestFailed: 'failed',
};

let requestSpy: ReturnType<typeof spyOn<typeof apiCallApi, 'request'>> | undefined;
afterEach(() => requestSpy?.mockRestore());

describe('Mistral model discovery and connectivity', () => {
  test('exposes the model list and test controls', () => {
    expect(PROVIDER_DESCRIPTORS.mistral.supportsTestModel).toBe(true);
    expect(PROVIDER_DESCRIPTORS.mistral.supportsModels).toBe(true);
    expect(MODEL_DISCOVERY_BRANDS).toContain('mistral');
  });

  test('builds the official chat completions URL from the host root', () => {
    expect(buildMistralChatCompletionsEndpoint('https://api.mistral.ai')).toBe(
      'https://api.mistral.ai/v1/chat/completions'
    );
    expect(buildMistralChatCompletionsEndpoint('https://api.mistral.ai/v1')).toBe(
      'https://api.mistral.ai/v1/chat/completions'
    );
    expect(buildMistralChatCompletionsEndpoint('https://api.mistral.ai/v1/models')).toBe(
      'https://api.mistral.ai/v1/chat/completions'
    );
  });

  test('lists models from GET /v1/models', async () => {
    requestSpy = spyOn(apiCallApi, 'request').mockResolvedValue({
      statusCode: 200,
      header: {},
      bodyText: '',
      body: { data: [{ id: 'mistral-small-latest' }] },
    });
    const hook = captureHook(() =>
      useModelDiscovery({
        brand: 'mistral',
        baseUrl: 'https://api.mistral.ai',
        apiKey: 'fixture-key',
        formHeaders: [],
      })
    );
    await hook.fetch();
    const request = requestSpy.mock.calls[0][0];
    expect(request.method).toBe('GET');
    expect(request.url).toBe('https://api.mistral.ai/v1/models');
    expect(request.header?.Authorization).toBe('Bearer fixture-key');
  });

  test('tests a model with POST /v1/chat/completions', async () => {
    requestSpy = spyOn(apiCallApi, 'request').mockResolvedValue({
      statusCode: 200,
      header: {},
      bodyText: '',
      body: {},
    });
    const hook = captureHook(() =>
      useConnectivityTest(
        {
          brand: 'mistral',
          baseUrl: 'https://api.mistral.ai',
          apiKey: 'fixture-key',
          testModel: 'mistral-small-latest',
          models: [],
          formHeaders: [],
        },
        messages
      )
    );
    await hook.runMistral();
    const request = requestSpy.mock.calls[0][0];
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(request.header?.Authorization).toBe('Bearer fixture-key');
    expect(JSON.parse(String(request.data))).toMatchObject({
      model: 'mistral-small-latest',
      stream: false,
    });
  });
});
