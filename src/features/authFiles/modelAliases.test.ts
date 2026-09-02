import { describe, expect, test } from 'bun:test';
import { serializeOauthModelAliases } from '../../services/api/authFiles';
import {
  applyModelAliases,
  readModelAliases,
  validateModelAliasRows,
} from './modelAliases';

describe('serializeOauthModelAliases', () => {
  test('serializes name/alias/fork/force-mapping combos', () => {
    expect(
      serializeOauthModelAliases([
        { name: 'claude-opus-4', alias: 'claude-3-opus', fork: true },
        { name: 'claude-sonnet-4', alias: 'claude-3-sonnet' },
        { name: 'claude-haiku-4', alias: 'claude-3-haiku', forceMapping: true },
      ])
    ).toEqual([
      { name: 'claude-opus-4', alias: 'claude-3-opus', fork: true },
      { name: 'claude-sonnet-4', alias: 'claude-3-sonnet' },
      { name: 'claude-haiku-4', alias: 'claude-3-haiku', 'force-mapping': true },
    ]);
  });

  test('omits fork when false and force-mapping when undefined', () => {
    expect(serializeOauthModelAliases([{ name: 'a', alias: 'b', fork: false }])).toEqual([
      { name: 'a', alias: 'b' },
    ]);
  });
});

describe('validateModelAliasRows', () => {
  test('accepts valid rows', () => {
    expect(
      validateModelAliasRows([
        { name: 'claude-opus-4', alias: 'claude-3-opus' },
        { name: 'claude-sonnet-4', alias: 'claude-3-sonnet' },
      ])
    ).toBeNull();
  });

  test('rejects empty name', () => {
    expect(validateModelAliasRows([{ name: '', alias: 'x' }])).toBe(
      'auth_file_details.model_aliases.error_empty_name'
    );
  });

  test('rejects empty alias', () => {
    expect(validateModelAliasRows([{ name: 'x', alias: '' }])).toBe(
      'auth_file_details.model_aliases.error_empty_alias'
    );
  });

  test('rejects name equal to alias (case-insensitive)', () => {
    expect(validateModelAliasRows([{ name: 'Same', alias: 'same' }])).toBe(
      'auth_file_details.model_aliases.error_name_equals_alias'
    );
  });

  test('rejects duplicate alias within the same account', () => {
    expect(
      validateModelAliasRows([
        { name: 'a', alias: 'dup' },
        { name: 'b', alias: 'dup' },
      ])
    ).toBe('auth_file_details.model_aliases.error_duplicate_alias');
  });
});

describe('readModelAliases', () => {
  test('reads canonical model_aliases key', () => {
    expect(
      readModelAliases({
        model_aliases: [
          { name: 'claude-opus-4', alias: 'claude-3-opus', fork: true },
        ],
      })
    ).toEqual([{ name: 'claude-opus-4', alias: 'claude-3-opus', fork: true }]);
  });

  test('falls back to legacy model-aliases key', () => {
    expect(
      readModelAliases({
        'model-aliases': [{ name: 'claude-opus-4', alias: 'claude-3-opus' }],
      })
    ).toEqual([{ name: 'claude-opus-4', alias: 'claude-3-opus' }]);
  });

  test('returns empty array when key is absent or not an array', () => {
    expect(readModelAliases({})).toEqual([]);
    expect(readModelAliases({ model_aliases: 'nope' })).toEqual([]);
  });

  test('drops rows with empty name or alias', () => {
    expect(
      readModelAliases({
        model_aliases: [
          { name: '', alias: 'x' },
          { name: 'y', alias: '' },
          { name: 'ok', alias: 'fine' },
        ],
      })
    ).toEqual([{ name: 'ok', alias: 'fine' }]);
  });
});

describe('applyModelAliases', () => {
  test('writes canonical key and removes legacy key', () => {
    const next = applyModelAliases(
      { 'model-aliases': [{ name: 'old', alias: 'x' }], prefix: 'p' },
      [{ name: 'claude-opus-4', alias: 'claude-3-opus', fork: true }]
    );
    expect(next).toEqual({
      prefix: 'p',
      model_aliases: [{ name: 'claude-opus-4', alias: 'claude-3-opus', fork: true }],
    });
    expect('model-aliases' in next).toBe(false);
  });

  test('removes the key entirely for an empty array', () => {
    const next = applyModelAliases({ model_aliases: [{ name: 'a', alias: 'b' }] }, []);
    expect(next).toEqual({});
  });
});
