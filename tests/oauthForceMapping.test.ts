import { describe, expect, test } from 'bun:test';
import {
  normalizeOauthModelAlias,
  serializeOauthModelAliases,
} from '../src/services/api/authFiles';

describe('OAuth model alias force mapping', () => {
  test('normalizes and serializes force-mapping without dropping it', () => {
    const normalized = normalizeOauthModelAlias({
      'oauth-model-alias': {
        codex: [
          { name: 'gpt-source', alias: 'gpt-alias', 'force-mapping': true },
          { name: 'gpt-source-2', alias: 'gpt-alias-2', forceMapping: false },
        ],
      },
    });

    expect(normalized.codex).toEqual([
      { name: 'gpt-source', alias: 'gpt-alias', forceMapping: true },
      { name: 'gpt-source-2', alias: 'gpt-alias-2', forceMapping: false },
    ]);
    expect(serializeOauthModelAliases(normalized.codex)).toEqual([
      { name: 'gpt-source', alias: 'gpt-alias', 'force-mapping': true },
      { name: 'gpt-source-2', alias: 'gpt-alias-2', 'force-mapping': false },
    ]);
  });

  test('preserves duplicate aliases within a channel through normalize and serialize', () => {
    const normalized = normalizeOauthModelAlias({
      'oauth-model-alias': {
        claude: [
          { name: 'claude-opus-4-8', alias: 'prio' },
          { name: 'claude-sonnet-4-5', alias: 'prio' },
        ],
      },
    });

    expect(normalized.claude).toEqual([
      { name: 'claude-opus-4-8', alias: 'prio' },
      { name: 'claude-sonnet-4-5', alias: 'prio' },
    ]);
    expect(serializeOauthModelAliases(normalized.claude)).toEqual([
      { name: 'claude-opus-4-8', alias: 'prio' },
      { name: 'claude-sonnet-4-5', alias: 'prio' },
    ]);
  });
});
