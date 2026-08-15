import { describe, expect, test } from 'bun:test';
import { apiKeyEntriesConnectivityKind } from '../src/features/providers/sheets/forms/useConnectivityTest';
import { DEFAULT_FREEBUFF_PROBE_MODEL, pickFreebuffProbeModel } from '../src/components/providers/utils';

describe('Freebuff API-key connectivity testers', () => {
  test('routes Freebuff Test All to the Freebuff runner, not OpenAI', () => {
    expect(apiKeyEntriesConnectivityKind('freebuff')).toBe('freebuff');
    expect(apiKeyEntriesConnectivityKind('commandcode')).toBe('commandcode');
    expect(apiKeyEntriesConnectivityKind('openaiCompatibility')).toBe('openaiCompatibility');
  });

  test('does not attach API-key batch testers to other brands', () => {
    expect(apiKeyEntriesConnectivityKind('claude')).toBeNull();
    expect(apiKeyEntriesConnectivityKind('gemini')).toBeNull();
    expect(apiKeyEntriesConnectivityKind('codex')).toBeNull();
    expect(apiKeyEntriesConnectivityKind('xai')).toBeNull();
  });

  test('defaults Freebuff probe model when no model is configured', () => {
    expect(pickFreebuffProbeModel(undefined, [])).toBe(DEFAULT_FREEBUFF_PROBE_MODEL);
    expect(pickFreebuffProbeModel('  ', [{ name: '  ' }])).toBe(DEFAULT_FREEBUFF_PROBE_MODEL);
  });

  test('prefers configured Freebuff model over probe default', () => {
    expect(pickFreebuffProbeModel('base3', [])).toBe('base3');
    expect(pickFreebuffProbeModel(undefined, [{ name: 'custom-alias' }])).toBe('custom-alias');
  });
});
