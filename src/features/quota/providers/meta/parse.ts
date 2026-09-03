import type { MetaMuseQuotaData, MetaMuseQuotaState } from '@/types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const asPercent = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;

const asTimestamp = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
};

const quotaWindow = (usedPercent: number | null, resetAt: string | null) => ({
  usedPercent,
  remainingPercent: usedPercent === null ? null : Math.max(0, Math.min(100, 100 - usedPercent)),
  resetAt,
});

export const emptyMetaMuseQuotaData = (): MetaMuseQuotaData => ({
  authIndex: '',
  fiveHour: quotaWindow(null, null),
  weekly: quotaWindow(null, null),
  observedAt: null,
});

export const selectMetaMuseQuota = (state: {
  metaMuseQuota?: Record<string, MetaMuseQuotaState>;
}): Record<string, MetaMuseQuotaState> => state.metaMuseQuota ?? {};

export const parseMetaMuseQuotaPayload = (payload: unknown): MetaMuseQuotaData | null => {
  if (!isRecord(payload)) return null;
  const authIndex = typeof payload.auth_index === 'string' ? payload.auth_index.trim() : '';
  if (!authIndex) return null;

  return {
    authIndex,
    fiveHour: quotaWindow(
      asPercent(payload.five_hour_used_percent),
      asTimestamp(payload.five_hour_reset_at)
    ),
    weekly: quotaWindow(
      asPercent(payload.weekly_used_percent),
      asTimestamp(payload.weekly_reset_at)
    ),
    observedAt: asTimestamp(payload.observed_at),
  };
};
