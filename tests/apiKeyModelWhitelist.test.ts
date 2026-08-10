import { describe, expect, it } from 'vitest';
import {
  normalizeApiKeyModelWhitelists,
  parseApiKeyModelWhitelists,
} from '@/utils/apiKeyModelWhitelists';

describe('API key model whitelists', () => {
  it('parses configured patterns and removes empty or unknown key entries', () => {
    expect(
      parseApiKeyModelWhitelists(
        {
          'gpt-only': ['gpt-*', ' gpt-5.2 ', ''],
          unrestricted: [],
          stale: ['claude-*'],
        },
        ['gpt-only', 'unrestricted']
      )
    ).toEqual({
      'gpt-only': ['gpt-*', 'gpt-5.2'],
    });
  });

  it('keeps only non-empty deduplicated patterns for active keys', () => {
    expect(
      normalizeApiKeyModelWhitelists(
        {
          'gpt-only': ['gpt-*', 'gpt-*', ' gpt-5.* '],
          unrestricted: [],
        },
        ['gpt-only', 'unrestricted']
      )
    ).toEqual({
      'gpt-only': ['gpt-*', 'gpt-5.*'],
    });
  });
});
