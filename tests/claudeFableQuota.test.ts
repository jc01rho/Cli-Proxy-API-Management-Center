import { describe, expect, test } from 'bun:test';
import type { TFunction } from 'i18next';
import { buildClaudeQuotaWindows, resolveClaudeUsageUrl } from '@/features/quota/providers/claude/data';
import type { ClaudeUsagePayload } from '@/types';
import { formatQuotaResetTime } from '@/utils/quota';

const t = ((key: string) => key) as TFunction;
const modernReset = '2026-07-27T10:00:00.000000+00:00';
const legacyReset = '2026-07-28T10:00:00.000000+00:00';

describe('Claude Fable quota', () => {
  test('builds a Fable window from the modern scoped limits payload', () => {
    const windows = buildClaudeQuotaWindows(
      {
        limits: [
          {
            kind: 'weekly_scoped',
            group: 'weekly',
            percent: 64,
            resets_at: modernReset,
            is_active: true,
            scope: { model: { id: null, display_name: 'Fable' } },
          },
        ],
      },
      t
    );

    expect(windows).toEqual([
      {
        id: 'seven-day-fable',
        label: 'claude_quota.seven_day_fable',
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent: 64,
        resetLabel: formatQuotaResetTime(modernReset),
        resetAtMs: Date.parse(modernReset),
        periodHours: 24 * 7,
      },
    ]);
  });

  test('falls back to the legacy Fable field', () => {
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: {
          utilization: 41,
          resets_at: legacyReset,
        },
      },
      t
    );

    expect(windows).toEqual([
      {
        id: 'seven-day-fable',
        label: 'claude_quota.seven_day_fable',
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent: 41,
        resetLabel: formatQuotaResetTime(legacyReset),
        resetAtMs: Date.parse(legacyReset),
        periodHours: 24 * 7,
      },
    ]);
  });

  test('falls back to the legacy field when the modern percent is invalid', () => {
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: {
          utilization: 41,
          resets_at: legacyReset,
        },
        limits: [
          {
            kind: 'weekly_scoped',
            percent: null,
            resets_at: modernReset,
            is_active: true,
            scope: { model: { display_name: 'Fable' } },
          },
        ],
      },
      t
    );

    expect(windows).toEqual([
      {
        id: 'seven-day-fable',
        label: 'claude_quota.seven_day_fable',
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent: 41,
        resetLabel: formatQuotaResetTime(legacyReset),
        resetAtMs: Date.parse(legacyReset),
        periodHours: 24 * 7,
      },
    ]);
  });

  test('prefers the active modern field without rendering a duplicate', () => {
    const windows = buildClaudeQuotaWindows(
      {
        iguana_necktie: {
          utilization: 41,
          resets_at: legacyReset,
        },
        limits: [
          {
            kind: 'weekly_scoped',
            percent: 12,
            resets_at: legacyReset,
            is_active: false,
            scope: { model: { display_name: 'Fable 5' } },
          },
          {
            kind: 'weekly_scoped',
            percent: 64,
            resets_at: modernReset,
            is_active: true,
            scope: { model: { display_name: 'Fable' } },
          },
        ],
      },
      t
    );

    expect(windows).toHaveLength(1);
    expect(windows[0]).toMatchObject({
      id: 'seven-day-fable',
      usedPercent: 64,
      resetLabel: formatQuotaResetTime(modernReset),
    });
  });

  test('uses a valid modern candidate when the preferred candidate is invalid', () => {
    const windows = buildClaudeQuotaWindows(
      {
        limits: [
          {
            kind: 'weekly_scoped',
            percent: null,
            resets_at: legacyReset,
            is_active: true,
            scope: { model: { display_name: 'Fable' } },
          },
          {
            kind: 'weekly_scoped',
            percent: 64,
            resets_at: modernReset,
            is_active: false,
            scope: { model: { display_name: 'Fable' } },
          },
        ],
      },
      t
    );

    expect(windows).toEqual([
      {
        id: 'seven-day-fable',
        label: 'claude_quota.seven_day_fable',
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent: 64,
        resetLabel: formatQuotaResetTime(modernReset),
        resetAtMs: Date.parse(modernReset),
        periodHours: 24 * 7,
      },
    ]);
  });

  test('ignores malformed and unrelated limits while preserving standard windows', () => {
    const payload = {
      five_hour: { utilization: 10, resets_at: null },
      seven_day: { utilization: 20, resets_at: legacyReset },
      limits: [
        null,
        { kind: 'weekly_scoped', percent: 35, scope: { model: { display_name: 'Sonnet' } } },
        { kind: 'session', percent: 50, scope: { model: { display_name: 'Fable' } } },
        { kind: 'weekly_scoped', percent: null, scope: { model: { display_name: 'Fable' } } },
      ],
    } as unknown as ClaudeUsagePayload;

    const windows = buildClaudeQuotaWindows(payload, t);

    expect(windows.map(({ id, usedPercent }) => ({ id, usedPercent }))).toEqual([
      { id: 'five-hour', usedPercent: 10 },
      { id: 'seven-day', usedPercent: 20 },
    ]);
  });
});

describe('Claude third-party quota format (e.g. nekos)', () => {
  test('parses third-party limits into ClaudeQuotaWindow list', () => {
    const payload = {
      request_count: 4684,
      total_tokens: 1405236445,
      cached_input_tokens: 1401864735,
      total_cost_usd: 3716.025941,
      limits: [
        {
          limit_type: 'cost_usd',
          limit_window: 'daily',
          max_value: 612500000,
          current_value: 0,
          remaining_value: 612500000,
          used_percent: 0.0,
          model_filter: 'claude-fable-5',
          reset_at: '2026-09-05T04:27:07.403949',
        },
        {
          limit_type: 'cost_usd',
          limit_window: '3h',
          max_value: 765625000,
          current_value: 1400516,
          remaining_value: 764224484,
          used_percent: 0.18,
          model_filter: null,
          reset_at: '2026-09-04T07:27:07.403949',
        },
      ],
    };

    const windows = buildClaudeQuotaWindows(payload as any, t);
    expect(windows).toHaveLength(2);
    expect(windows[0].label).toContain('claude-fable-5');
    expect(windows[0].usedPercent).toBe(0.0);
    expect(windows[0].periodHours).toBe(24);
    expect(windows[1].label).toBe('claude_quota.three_hour');
    expect(windows[1].usedPercent).toBe(0.18);
    expect(windows[1].periodHours).toBe(3);
  });
});

describe('resolveClaudeUsageUrl', () => {
  test('prefers explicit quota_url', () => {
    const file = {
      name: 'claude.json',
      quota_url: 'https://claude.nekos.me/v1/usage/self',
      base_url: 'https://other.example.com',
    } as any;
    expect(resolveClaudeUsageUrl(file)).toBe('https://claude.nekos.me/v1/usage/self');
  });

  test('derives quota_url from custom base_url', () => {
    const file = {
      name: 'claude.json',
      base_url: 'https://claude.nekos.me',
    } as any;
    expect(resolveClaudeUsageUrl(file)).toBe('https://claude.nekos.me/v1/usage/self');
  });

  test('falls back to official CLAUDE_USAGE_URL for empty or official base_url', () => {
    const file = {
      name: 'claude.json',
    } as any;
    expect(resolveClaudeUsageUrl(file)).toBe('https://api.anthropic.com/api/oauth/usage');
  });
});
