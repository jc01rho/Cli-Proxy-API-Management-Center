import { describe, expect, test } from 'bun:test';
import { PROVIDER_DESCRIPTORS } from '../src/features/providers/descriptors';
import { pickCommandCodeProbeModel } from '../src/features/providers/sheets/forms/useConnectivityTest';

describe('commandcode connectivity test model', () => {
  test('the provider form exposes the test-model picker', () => {
    expect(PROVIDER_DESCRIPTORS.commandcode.supportsTestModel).toBe(true);
  });

  test('a selected test model wins over the first configured model', () => {
    const models = [{ name: 'a-model', alias: '' }, { name: 'b-model', alias: '' }];
    expect(pickCommandCodeProbeModel('b-model', models)).toBe('b-model');
    expect(pickCommandCodeProbeModel('', models)).toBe('a-model');
  });
});
