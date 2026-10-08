import { describe, expect, test } from 'bun:test';
import {
  buildAuthFileFieldsPatch,
  isPolicyDraftValue,
  isPolicyField,
  type PrefixProxyEditorState,
} from '../src/features/authFiles/hooks/useAuthFilesPrefixProxyEditor';
import { readCredentialPolicy } from '../src/features/authFiles/credentialPolicy';

describe('policy channel is separated from the alias array', () => {
  test('only the policy fields are policy fields', () => {
    expect(isPolicyField('requestRetry')).toBe(true);
    expect(isPolicyField('modelAliases')).toBe(true);
    expect(isPolicyField('errorRules')).toBe(true);
    expect(isPolicyField('prefix')).toBe(false);
    expect(isPolicyField('headersText')).toBe(false);
  });

  test('a policy draft value is an object with a mode', () => {
    expect(isPolicyDraftValue({ mode: 'inherit', rows: null })).toBe(true);
    expect(isPolicyDraftValue({ mode: 'custom', rows: [] })).toBe(true);
    expect(isPolicyDraftValue({ mode: 'custom', value: '2' })).toBe(true);
  });

  test('rejects the bare alias array that used to corrupt the draft', () => {
    expect(isPolicyDraftValue([{ name: 'upstream', alias: 'public', fork: true }])).toBe(false);
    expect(isPolicyDraftValue([])).toBe(false);
    expect(isPolicyDraftValue('custom')).toBe(false);
    expect(isPolicyDraftValue(true)).toBe(false);
    expect(isPolicyDraftValue(null)).toBe(false);
  });

  test('deleting the last alias row still produces the alias patch', () => {
    const original = {
      model_aliases: [{ name: 'upstream', alias: 'public', fork: true }],
    };
    const editor = {
      json: original,
      providerKey: 'codex',
      prefix: '',
      proxyUrl: '',
      baseUrl: '',
      quotaUrl: '',
      priority: '',
      weight: '',
      policy: readCredentialPolicy(original),
    } as PrefixProxyEditorState;

    const rows = editor.policy!.modelAliases.rows!.slice(1);
    const withDelete = {
      ...editor,
      policy: {
        ...editor.policy!,
        modelAliases: { mode: 'custom' as const, rows },
        touched: { modelAliases: true },
      },
    } as PrefixProxyEditorState;

    expect(buildAuthFileFieldsPatch(withDelete, (key) => key)).toEqual({ model_aliases: [] });
  });
});
