import { describe, expect, test } from 'bun:test';
import {
  buildCommandCodeGenerateEndpoint,
  buildCommandCodeModelsEndpoint,
  DEFAULT_COMMANDCODE_BASE_URL,
} from '../src/components/providers/utils';
import { MODEL_DISCOVERY_BRANDS } from '../src/features/providers/sheets/forms/useModelDiscovery';

describe('CommandCode model catalog', () => {
  test('exposes commandcode in model discovery brands', () => {
    expect(MODEL_DISCOVERY_BRANDS).toContain('commandcode');
  });

  test('defaults to the public CommandCode host', () => {
    expect(DEFAULT_COMMANDCODE_BASE_URL).toBe('https://api.commandcode.ai');
  });

  test('builds generate and models URLs from supported base URL forms', () => {
    const cases = [
      '',
      'https://api.commandcode.ai',
      'https://api.commandcode.ai/',
      'https://api.commandcode.ai/v1',
      'https://api.commandcode.ai/v1/models',
      'https://api.commandcode.ai/provider',
      'https://api.commandcode.ai/provider/v1',
      'https://api.commandcode.ai/provider/v1/models',
    ];

    for (const input of cases) {
      expect(buildCommandCodeGenerateEndpoint(input)).toBe(
        'https://api.commandcode.ai/alpha/generate'
      );
      expect(buildCommandCodeModelsEndpoint(input)).toBe(
        'https://api.commandcode.ai/provider/v1/models'
      );
    }
  });

  test('keeps a custom host while rewriting catalog suffixes', () => {
    expect(buildCommandCodeGenerateEndpoint('https://mock.commandcode.test/v1')).toBe(
      'https://mock.commandcode.test/alpha/generate'
    );
    expect(buildCommandCodeModelsEndpoint('https://mock.commandcode.test/v1/models')).toBe(
      'https://mock.commandcode.test/provider/v1/models'
    );
  });
});
