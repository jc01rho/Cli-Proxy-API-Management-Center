/**
 * Claude 额度数据层：用量窗口 + 套餐 + 额外用量。
 * React-free / SCSS-free —— 由 tests/claudeFableQuota.test.ts 直接消费。
 */

import type { TFunction } from 'i18next';
import type {
  AuthFileItem,
  ClaudeExtraUsage,
  ClaudeProfileResponse,
  ClaudeQuotaState,
  ClaudeQuotaWindow,
  ClaudeUsagePayload,
} from '@/types';
import { apiCallApi, getApiCallErrorMessage, type ApiCallResult } from '@/services/api';
import {
  CLAUDE_PROFILE_URL,
  CLAUDE_USAGE_URL,
  CLAUDE_REQUEST_HEADERS,
  CLAUDE_USAGE_WINDOW_KEYS,
  claudePeriodHours,
  normalizeNumberValue,
  normalizeStringValue,
  parseClaudeUsagePayload,
  formatQuotaResetTime,
  resolveResetMs,
  createStatusError,
  isClaudeFile,
  isDisabledAuthFile,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

export type ClaudeQuotaData = {
  windows: ClaudeQuotaWindow[];
  extraUsage?: ClaudeExtraUsage | null;
  planType?: string | null;
};

interface ThirdPartyClaudeLimit {
  limit_type?: string;
  limit_window?: string;
  max_value?: number;
  current_value?: number;
  remaining_value?: number;
  used_percent?: number;
  model_filter?: string | null;
  reset_at?: string;
}

const isThirdPartyLimits = (limits: unknown[]): limits is ThirdPartyClaudeLimit[] =>
  limits.length > 0 &&
  typeof limits[0] === 'object' &&
  limits[0] !== null &&
  ('limit_window' in limits[0] || 'limit_type' in limits[0]);

const parseLimitWindowHours = (window: string): number => {
  const trimmed = window.trim().toLowerCase();
  if (trimmed === 'daily' || trimmed === 'day') return 24;
  if (trimmed === 'weekly' || trimmed === 'week') return 168;
  if (trimmed === 'monthly' || trimmed === 'month') return 720;
  const match = trimmed.match(/^(\d+)\s*h(?:our)?s?$/);
  if (match) return Number(match[1]);
  return 24;
};

const formatLimitWindowLabel = (window: string, t: TFunction): string => {
  const trimmed = window.trim().toLowerCase();
  if (trimmed === '3h') return t('claude_quota.three_hour', '3-hour limit');
  if (trimmed === '5h') return t('claude_quota.five_hour');
  if (trimmed === 'daily' || trimmed === 'day') return t('claude_quota.daily', 'Daily limit');
  if (trimmed === 'weekly' || trimmed === 'week') return t('claude_quota.seven_day');
  return window;
};

export const resolveClaudeUsageUrl = (file: AuthFileItem): string => {
  const quotaUrl =
    (typeof file.quota_url === 'string' && file.quota_url.trim()) ||
    (typeof file['quota_url'] === 'string' && (file['quota_url'] as string).trim()) ||
    (typeof file['quota-url'] === 'string' && (file['quota-url'] as string).trim()) ||
    '';
  if (quotaUrl) return quotaUrl;

  const baseUrl =
    (typeof file.baseUrl === 'string' && file.baseUrl.trim()) ||
    (typeof file.base_url === 'string' && file.base_url.trim()) ||
    (typeof file['base_url'] === 'string' && (file['base_url'] as string).trim()) ||
    (typeof file['base-url'] === 'string' && (file['base-url'] as string).trim()) ||
    '';
  if (baseUrl) {
    const trimmed = baseUrl.replace(/\/+$/, '');
    if (!trimmed.includes('api.anthropic.com')) {
      return `${trimmed}/v1/usage/self`;
    }
  }

  return CLAUDE_USAGE_URL;
};

const findFableUsageLimit = (payload: ClaudeUsagePayload) => {
  if (!Array.isArray(payload.limits)) return null;

  const candidates = payload.limits.filter((limit) => {
    const kind = (normalizeStringValue(limit?.kind) ?? '').trim().toLowerCase();
    const modelName = (normalizeStringValue(limit?.scope?.model?.display_name) ?? '')
      .trim()
      .toLowerCase();
    const isFable = modelName === 'fable' || modelName === 'fable 5';
    return kind === 'weekly_scoped' && isFable && normalizeNumberValue(limit?.percent) !== null;
  });

  return candidates.find((limit) => limit.is_active === true) ?? candidates[0] ?? null;
};

export const buildClaudeQuotaWindows = (
  payload: ClaudeUsagePayload & { limits?: unknown[] | null },
  t: TFunction
): ClaudeQuotaWindow[] => {
  const rawLimits = Array.isArray(payload.limits) ? payload.limits : [];
  if (isThirdPartyLimits(rawLimits)) {
    return rawLimits.map((limit, index) => {
      const usedPercent = normalizeNumberValue(limit.used_percent);
      const windowStr = (limit.limit_window ?? '').trim();
      const modelFilter = (limit.model_filter ?? '').trim();
      const windowLabel = formatLimitWindowLabel(windowStr, t);
      const label = modelFilter ? `${modelFilter} (${windowLabel})` : windowLabel;
      const resetLabel = formatQuotaResetTime(limit.reset_at);
      const resetAtMs = resolveResetMs([limit.reset_at]);
      const periodHours = parseLimitWindowHours(windowStr);

      return {
        id: `third-party-${modelFilter || 'all'}-${windowStr || 'window'}-${index}`,
        label,
        usedPercent,
        resetLabel,
        resetAtMs,
        periodHours,
      };
    });
  }

  const windows: ClaudeQuotaWindow[] = [];
  const fableLimit = findFableUsageLimit(payload);

  for (const { key, id, labelKey } of CLAUDE_USAGE_WINDOW_KEYS) {
    if (key === 'iguana_necktie' && fableLimit) continue;
    const window = payload[key as keyof ClaudeUsagePayload];
    if (!window || typeof window !== 'object' || !('utilization' in window)) continue;
    const typedWindow = window as { utilization: number; resets_at: string | null };
    const usedPercent = normalizeNumberValue(typedWindow.utilization);
    const resetLabel = formatQuotaResetTime(typedWindow.resets_at ?? undefined);
    windows.push({
      id,
      label: t(labelKey),
      labelKey,
      usedPercent,
      resetLabel,
      // Claude states the period nowhere in the payload, so it comes from the
      // key: `five_hour` is the rolling window, everything else is weekly.
      resetAtMs: resolveResetMs([typedWindow.resets_at]),
      periodHours: claudePeriodHours(key),
    });
  }

  if (fableLimit) {
    const usedPercent = normalizeNumberValue(fableLimit.percent);
    if (usedPercent !== null) {
      windows.push({
        id: 'seven-day-fable',
        label: t('claude_quota.seven_day_fable'),
        labelKey: 'claude_quota.seven_day_fable',
        usedPercent,
        resetLabel: formatQuotaResetTime(fableLimit.resets_at ?? undefined),
        // `weekly_scoped` is a 7-day window by definition, so the timeline can
        // place this row alongside the ones derived from the named keys.
        resetAtMs: resolveResetMs([fableLimit.resets_at]),
        periodHours: claudePeriodHours('seven_day'),
      });
    }
  }

  return windows;
};

const normalizeFlagValue = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(trimmed)) return false;
  }
  return undefined;
};

const parseClaudeProfilePayload = (payload: unknown): ClaudeProfileResponse | null => {
  if (payload === undefined || payload === null) return null;
  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as ClaudeProfileResponse;
    } catch {
      return null;
    }
  }
  if (typeof payload === 'object') {
    return payload as ClaudeProfileResponse;
  }
  return null;
};

const resolveClaudePlanType = (profile: ClaudeProfileResponse | null): string | null => {
  if (!profile) return null;

  const hasClaudeMax = normalizeFlagValue(profile.account?.has_claude_max);
  if (hasClaudeMax) return 'plan_max';

  const hasClaudePro = normalizeFlagValue(profile.account?.has_claude_pro);
  if (hasClaudePro) return 'plan_pro';

  const organizationType = normalizeStringValue(
    profile.organization?.organization_type
  )?.toLowerCase();
  const subscriptionStatus = normalizeStringValue(
    profile.organization?.subscription_status
  )?.toLowerCase();

  if (organizationType === 'claude_team' && subscriptionStatus === 'active') {
    return 'plan_team';
  }

  if (hasClaudeMax === false && hasClaudePro === false) return 'plan_free';

  return null;
};

const fetchClaudeQuota = async (file: AuthFileItem, t: TFunction): Promise<ClaudeQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('claude_quota.missing_auth_index'));
  }

  const targetUsageUrl = resolveClaudeUsageUrl(file);
  const isCustomUrl = targetUsageUrl !== CLAUDE_USAGE_URL;

  // For custom quota/base URLs (e.g. 3rd-party mirrors like nekos), do not
  // request Anthropic's official profile endpoint with the 3rd-party token.
  const requests: [Promise<unknown>, Promise<unknown>?] = [
    apiCallApi.request({
      authIndex,
      method: 'GET',
      url: targetUsageUrl,
      header: isCustomUrl
        ? { Authorization: 'Bearer $TOKEN$', 'Content-Type': 'application/json' }
        : { ...CLAUDE_REQUEST_HEADERS },
    }),
  ];

  if (!isCustomUrl) {
    requests.push(
      apiCallApi.request({
        authIndex,
        method: 'GET',
        url: CLAUDE_PROFILE_URL,
        header: { ...CLAUDE_REQUEST_HEADERS },
      })
    );
  }

  const [usageResult, profileResult] = await Promise.allSettled(requests);

  if (usageResult.status === 'rejected') {
    throw usageResult.reason;
  }

  const result = usageResult.value as ApiCallResult;

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const rawBody = result.body ?? result.bodyText;
  const payload = parseClaudeUsagePayload(rawBody) as (ClaudeUsagePayload & Record<string, unknown>) | null;
  if (!payload) {
    throw new Error(t('claude_quota.empty_windows'));
  }

  const windows = buildClaudeQuotaWindows(payload, t);
  const planType =
    profileResult &&
    profileResult.status === 'fulfilled' &&
    (profileResult.value as { statusCode: number }).statusCode >= 200 &&
    (profileResult.value as { statusCode: number }).statusCode < 300
      ? resolveClaudePlanType(
          parseClaudeProfilePayload(
            (profileResult.value as { body?: unknown; bodyText?: string }).body ??
              (profileResult.value as { body?: unknown; bodyText?: string }).bodyText
          )
        )
      : null;

  let extraUsage = payload.extra_usage;
  // If third-party payload has total_cost_usd, synthesize extraUsage for display
  if (!extraUsage && typeof payload.total_cost_usd === 'number') {
    extraUsage = {
      is_enabled: true,
      monthly_limit: 0,
      used_credits: Math.round(payload.total_cost_usd * 100),
      utilization: null,
    };
  }

  return { windows, extraUsage, planType };
};

export const CLAUDE_CONFIG: QuotaProviderData<ClaudeQuotaState, ClaudeQuotaData> = {
  type: 'claude',
  i18nPrefix: 'claude_quota',
  filterFn: (file) => isClaudeFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchClaudeQuota,
  storeSelector: (state) => state.claudeQuota,
  storeSetter: 'setClaudeQuota',
  buildLoadingState: () => ({ status: 'loading', windows: [] }),
  buildSuccessState: (data) => ({
    status: 'success',
    windows: data.windows,
    extraUsage: data.extraUsage,
    planType: data.planType,
  }),
  buildErrorState: (message, status) => ({
    status: 'error',
    windows: [],
    error: message,
    errorStatus: status,
  }),
};
