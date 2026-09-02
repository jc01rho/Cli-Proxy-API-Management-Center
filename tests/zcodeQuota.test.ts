/**
 * Zcode quota payload / window-presence contract.
 *
 * Given: a normalized zcode quota payload
 * When: unused monthly (backend zero-fill) or frontend emptyWindow is inspected
 * Then: only windows that actually came back from Z.AI are treated as present
 */

import { describe, expect, test } from 'bun:test';
import { isZcodeWindowPresent, parseZcodeQuotaPayload } from '@/features/quota/providers/zcode/data';

describe('isZcodeWindowPresent', () => {
  test('rejects the backend unused monthly zero-fill', () => {
    expect(
      isZcodeWindowPresent({
        name: 'monthly',
        used_percent: 0,
        remaining_percent: 0,
        reset_at: null,
      })
    ).toBe(false);
  });

  test('rejects the frontend emptyWindow placeholder', () => {
    expect(
      isZcodeWindowPresent({
        name: '',
        used_percent: 0,
        remaining_percent: 100,
        reset_at: null,
      })
    ).toBe(false);
  });

  test('keeps a live 0% window that still has a name', () => {
    expect(
      isZcodeWindowPresent({
        name: 'five_hour',
        used_percent: 0,
        remaining_percent: 100,
        reset_at: null,
      })
    ).toBe(true);
  });

  test('keeps a fully used window', () => {
    expect(
      isZcodeWindowPresent({
        name: 'weekly',
        used_percent: 100,
        remaining_percent: 0,
        reset_at: '2026-09-05T08:00:00.000Z',
      })
    ).toBe(true);
  });
});

describe('parseZcodeQuotaPayload', () => {
  test('maps snake_case windows onto the UI shape', () => {
    const data = parseZcodeQuotaPayload({
      auth_index: 'zcode-1',
      email: 'user@example.com',
      level: 'pro',
      five_hour: { name: 'five_hour', used_percent: 31, remaining_percent: 69, reset_at: '2026-09-02T09:00:00Z' },
      weekly: { name: 'weekly', used_percent: 100, remaining_percent: 0, reset_at: '2026-09-05T08:00:00Z' },
      mcp: { name: 'mcp', used_percent: 100, remaining_percent: 0, reset_at: '2026-09-05T08:00:00Z' },
      monthly: { name: 'monthly', used_percent: 0, remaining_percent: 0 },
    });

    expect(data?.level).toBe('pro');
    expect(data?.fiveHour.used_percent).toBe(31);
    expect(isZcodeWindowPresent(data?.monthly)).toBe(false);
    expect(isZcodeWindowPresent(data?.fiveHour)).toBe(true);
  });
});
