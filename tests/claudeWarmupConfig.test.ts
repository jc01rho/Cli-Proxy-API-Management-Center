import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseDocument } from 'yaml';
import i18n from '@/i18n';
import { ClaudeWarmupRunPanel } from '@/components/config/ClaudeWarmupRunPanel';
import { normalizeClaudeWarmupRunResult } from '@/services/api/claudeWarmup';
import { runVisualConfig } from './helpers/visualConfig';

await i18n.changeLanguage('en');

const yaml = `config-version: 8
claude-warmup:
  enabled: false
  schedule: "50 7 * * 1-5"
  timezone: Asia/Seoul
  max-tokens: 25
  jitter: 60s
future: retained # keep
`;

describe('claude-warmup visual config', () => {
  test('loads the claude-warmup root and leaves untouched YAML unchanged', () => {
    const loaded = runVisualConfig(yaml);
    expect(loaded.visualValues.claudeWarmupEnabled).toBe(false);
    expect(loaded.visualValues.claudeWarmupSchedule).toBe('50 7 * * 1-5');
    expect(loaded.visualValues.claudeWarmupTimezone).toBe('Asia/Seoul');
    expect(loaded.visualValues.claudeWarmupModel).toBe('');
    expect(loaded.visualValues.claudeWarmupMaxTokens).toBe('25');
    expect(loaded.visualValues.claudeWarmupJitter).toBe('60s');
    expect(loaded.applyVisualChangesToYaml(yaml)).toBe(yaml);
  });

  test('saves edits under claude-warmup and drops cleared keys', () => {
    const changed = runVisualConfig(yaml, [
      { claudeWarmupEnabled: true, claudeWarmupModel: 'claude-haiku-4-5-20251001' },
      { claudeWarmupMaxTokens: '30', claudeWarmupJitter: '' },
    ]);
    const output = changed.applyVisualChangesToYaml(yaml);
    const doc = parseDocument(output);
    expect(doc.getIn(['claude-warmup', 'enabled'])).toBe(true);
    expect(doc.getIn(['claude-warmup', 'model'])).toBe('claude-haiku-4-5-20251001');
    expect(doc.getIn(['claude-warmup', 'max-tokens'])).toBe(30);
    expect(doc.hasIn(['claude-warmup', 'jitter'])).toBe(false);
    expect(doc.getIn(['claude-warmup', 'schedule'])).toBe('50 7 * * 1-5');
    expect(output).toContain('future: retained # keep');
  });

  test('creates the root on a document without it and flags invalid max tokens', () => {
    const output = runVisualConfig('{}', [{ claudeWarmupEnabled: true }]).applyVisualChangesToYaml('{}');
    expect(parseDocument(output).getIn(['claude-warmup', 'enabled'])).toBe(true);
    const invalid = runVisualConfig(yaml, [{ claudeWarmupMaxTokens: '-1' }]);
    expect(invalid.visualValidationErrors.claudeWarmupMaxTokens).toBe('non_negative_integer');
  });
});

describe('claude-warmup run results', () => {
  test('normalizes the backend run payload', () => {
    const result = normalizeClaudeWarmupRunResult({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 25,
      results: [
        { auth_id: 'a.json', label: 'a@example.com', success: true, attempts: 1 },
        { auth_id: 'b.json', label: 'b@example.com', success: false, attempts: 1, http_status: 429, error: 'limited' },
        'garbage',
      ],
    });
    expect(result.maxTokens).toBe(25);
    expect(result.results).toEqual([
      { authId: 'a.json', label: 'a@example.com', success: true, attempts: 1, httpStatus: null, error: '' },
      { authId: 'b.json', label: 'b@example.com', success: false, attempts: 1, httpStatus: 429, error: 'limited' },
    ]);
  });

  test('renders the run button and per-account results', () => {
    const html = renderToStaticMarkup(
      createElement(ClaudeWarmupRunPanel, {
        disabled: false,
        initialResult: normalizeClaudeWarmupRunResult({
          model: 'claude-haiku-4-5-20251001',
          results: [
            { auth_id: 'a.json', label: 'a@example.com', success: true, attempts: 1 },
            { auth_id: 'b.json', label: 'b@example.com', success: false, attempts: 1, http_status: 429, error: 'limited' },
          ],
        }),
      })
    );
    expect(html).toContain('Run now');
    expect(html).toContain('1/2 accounts succeeded (claude-haiku-4-5-20251001)');
    expect(html).toContain('a@example.com');
    expect(html).toContain('HTTP 429 · limited');
  });
});
