import { describe, expect, test } from 'bun:test';
import {
  buildFreebuffModelsEndpoint,
  DEFAULT_FREEBUFF_BASE_URL,
} from '../src/components/providers/utils';
import { MODEL_DISCOVERY_BRANDS } from '../src/features/providers/sheets/forms/useModelDiscovery';

describe('Freebuff model discovery', () => {
  test('includes freebuff in discovery brands', () => {
    expect(MODEL_DISCOVERY_BRANDS).toContain('freebuff');
  });

  test('defaults Freebuff host to official Codebuff origin', () => {
    expect(DEFAULT_FREEBUFF_BASE_URL).toBe('https://www.codebuff.com');
    expect(buildFreebuffModelsEndpoint('')).toBe('https://www.codebuff.com/api/v1/models');
    expect(buildFreebuffModelsEndpoint('https://www.codebuff.com')).toBe(
      'https://www.codebuff.com/api/v1/models',
    );
    expect(buildFreebuffModelsEndpoint('https://www.codebuff.com/')).toBe(
      'https://www.codebuff.com/api/v1/models',
    );
    expect(buildFreebuffModelsEndpoint('https://www.codebuff.com/v1')).toBe(
      'https://www.codebuff.com/api/v1/models',
    );
    expect(buildFreebuffModelsEndpoint('https://www.codebuff.com/api/v1')).toBe(
      'https://www.codebuff.com/api/v1/models',
    );
    expect(buildFreebuffModelsEndpoint('https://www.codebuff.com/api/v1/models')).toBe(
      'https://www.codebuff.com/api/v1/models',
    );
  });

  test('keeps a custom Freebuff host and still targets /api/v1/models', () => {
    expect(buildFreebuffModelsEndpoint('https://mock.freebuff.test/v1')).toBe(
      'https://mock.freebuff.test/api/v1/models',
    );
  });
});
