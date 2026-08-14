/**
 * Kiro quota data layer. React-free / SCSS-free.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, KiroQuotaData, KiroQuotaState } from '@/types';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import {
  KIRO_DEFAULT_REGION,
  KIRO_REQUEST_HEADERS,
  KIRO_USAGE_PATH,
  buildKiroQuotaData,
  createStatusError,
  isDisabledAuthFile,
  isKiroFile,
  parseKiroUsagePayload,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

const toRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const firstString = (values: readonly unknown[]): string | null => {
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

const resolveKiroProfileArn = (file: AuthFileItem): string | null => {
  const metadata = toRecord(file.metadata);
  const attributes = toRecord(file.attributes);
  return firstString([
    file.profile_arn,
    file.profileArn,
    metadata?.profile_arn,
    metadata?.profileArn,
    attributes?.profile_arn,
    attributes?.profileArn,
  ]);
};

const regionFromProfileArn = (profileArn: string | null): string | null => {
  if (!profileArn) return null;
  const parts = profileArn.split(':');
  if (parts.length < 4 || parts[0] !== 'arn' || parts[2] !== 'codewhisperer') return null;
  return parts[3]?.trim() || null;
};

const resolveKiroRegion = (file: AuthFileItem, profileArn: string | null): string => {
  const metadata = toRecord(file.metadata);
  const attributes = toRecord(file.attributes);
  return (
    firstString([
      file.api_region,
      file.apiRegion,
      metadata?.api_region,
      metadata?.apiRegion,
      attributes?.api_region,
      attributes?.apiRegion,
    ]) ??
    regionFromProfileArn(profileArn) ??
    firstString([
      file.region,
      metadata?.region,
      attributes?.region,
    ]) ??
    KIRO_DEFAULT_REGION
  );
};

const buildKiroUsageUrl = (file: AuthFileItem): string => {
  const profileArn = resolveKiroProfileArn(file);
  const region = resolveKiroRegion(file, profileArn);
  const params = new URLSearchParams({
    isEmailRequired: 'true',
    origin: 'AI_EDITOR',
    resourceType: 'AGENTIC_REQUEST',
  });
  if (profileArn) {
    params.set('profileArn', profileArn);
  }
  return `https://q.${region}.amazonaws.com${KIRO_USAGE_PATH}?${params.toString()}`;
};

export const fetchKiroQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<KiroQuotaData> => {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) {
    throw new Error(t('kiro_quota.missing_auth_index'));
  }

  const result = await apiCallApi.request({
    authIndex,
    method: 'GET',
    url: buildKiroUsageUrl(file),
    header: { ...KIRO_REQUEST_HEADERS },
  });

  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw createStatusError(getApiCallErrorMessage(result), result.statusCode);
  }

  const payload = parseKiroUsagePayload(result.body ?? result.bodyText);
  if (!payload) {
    throw new Error(t('kiro_quota.empty_data'));
  }

  return buildKiroQuotaData(payload);
};

const emptyKiroQuotaData = (): KiroQuotaData => ({
  subscriptionTitle: null,
  subscriptionType: null,
  rows: [],
});

export const KIRO_CONFIG: QuotaProviderData<KiroQuotaState, KiroQuotaData> = {
  type: 'kiro',
  i18nPrefix: 'kiro_quota',
  filterFn: (file) => isKiroFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchKiroQuota,
  storeSelector: (state) => state.kiroQuota,
  storeSetter: 'setKiroQuota',
  buildLoadingState: () => ({ status: 'loading', ...emptyKiroQuotaData() }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    ...emptyKiroQuotaData(),
    error: message,
    errorStatus: status,
  }),
};
