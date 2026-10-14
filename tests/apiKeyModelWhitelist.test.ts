import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { ApiKeysField } from '@/features/config/components/fields/sharedFields';
import { DEFAULT_VISUAL_VALUES } from '@/types/visualConfig';
import {
  normalizeApiKeyModelWhitelists,
  parseApiKeyModelWhitelists,
} from '@/utils/apiKeyModelWhitelists';

describe('API key model whitelists', () => {
  it('renders configured model patterns through the routed API key editor', () => {
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n: i18n.cloneInstance({ lng: 'en' }) },
        createElement(ApiKeysField, {
          values: {
            ...DEFAULT_VISUAL_VALUES,
            apiKeysText: 'test-key',
            apiKeyModelWhitelists: { 'test-key': ['gpt-*', 'claude-*'] },
          },
          disabled: false,
          onChange: () => {},
        })
      )
    );
    expect(markup).toContain('gpt-*');
    expect(markup).toContain('claude-*');
  });

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
