import { expect, test } from 'bun:test';
import {
  parseMetaMuseQuotaPayload,
  selectMetaMuseQuota,
} from '../src/features/quota/providers/meta/parse';

test('parseMetaMuseQuotaPayload normalizes cached five-hour and weekly snapshots', () => {
  // Given
  const payload = {
    auth_index: 'meta-account',
    five_hour_used_percent: 42.5,
    five_hour_reset_at: '2026-09-03T10:39:48Z',
    weekly_used_percent: 63,
    weekly_reset_at: '2026-09-06T23:20:00Z',
    observed_at: '2026-09-03T05:00:00Z',
  };

  // When
  const quota = parseMetaMuseQuotaPayload(payload);

  // Then
  expect(quota).toEqual({
    authIndex: 'meta-account',
    fiveHour: { usedPercent: 42.5, remainingPercent: 57.5, resetAt: '2026-09-03T10:39:48Z' },
    weekly: { usedPercent: 63, remainingPercent: 37, resetAt: '2026-09-06T23:20:00Z' },
    observedAt: '2026-09-03T05:00:00Z',
  });
});

test('parseMetaMuseQuotaPayload rejects cache payloads without an account identity', () => {
  // Given
  const payload = {
    five_hour_used_percent: 42.5,
    observed_at: '2026-09-03T05:00:00Z',
  };

  // When
  const quota = parseMetaMuseQuotaPayload(payload);

  // Then
  expect(quota).toBeNull();
});

test('selectMetaMuseQuota treats a legacy persisted store as an empty cache', () => {
  // Given
  const legacyState = {};

  // When
  const quota = selectMetaMuseQuota(legacyState);

  // Then
  expect(quota).toEqual({});
});
