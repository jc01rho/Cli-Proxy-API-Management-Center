/**
 * Zcode (Z.AI coding plan) quota data layer. React-free / SCSS-free.
 *
 * Reads the normalized quota payload from the proxy management API
 * (GET /v0/management/zcode-quota?auth_index=...), which the backend
 * resolves against the provisioned Z.AI API key — the UI never touches
 * api.z.ai directly.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, ZcodeQuotaData, ZcodeQuotaState } from '@/types';
import { apiClient } from '@/services/api';
import { isDisabledAuthFile, isZcodeFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const emptyWindow = () => ({
  name: '',
  used_percent: 0,
  remaining_percent: 100,
  reset_at: null,
});

/**
 * The backend emits snake_case fields (used_percent, five_hour, ...). The
 * response is normalized defensively here so a future camelCase variant
 * still renders instead of silently showing zeros.
 */
export const parseZcodeQuotaPayload = (payload: unknown): ZcodeQuotaData | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = payload as Record<string, unknown>;
  const authIndex = typeof raw.auth_index === 'string' ? raw.auth_index : '';
  if (!authIndex) return null;
  const str = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    authIndex,
    email: str(raw.email),
    level: str(raw.level),
    fiveHour: { ...emptyWindow(), ...(raw.five_hour as object | undefined) },
    weekly: { ...emptyWindow(), ...(raw.weekly as object | undefined) },
    mcp: { ...emptyWindow(), ...(raw.mcp as object | undefined) },
    monthly: { ...emptyWindow(), ...(raw.monthly as object | undefined) },
  };
};

export const fetchZcodeQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<ZcodeQuotaData> => {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) {
    throw new Error(t('zcode_quota.missing_auth_index'));
  }

  const payload = await apiClient.get<unknown>('/zcode-quota', {
    params: { auth_index: authIndex },
  });

  const data = parseZcodeQuotaPayload(payload);
  if (!data) {
    throw new Error(t('zcode_quota.empty_data'));
  }
  return data;
};

const emptyZcodeQuotaData = (): ZcodeQuotaData => ({
  authIndex: '',
  email: '',
  level: '',
  fiveHour: emptyWindow(),
  weekly: emptyWindow(),
  mcp: emptyWindow(),
  monthly: emptyWindow(),
});

export const ZCODE_CONFIG: QuotaProviderData<ZcodeQuotaState, ZcodeQuotaData> = {
  type: 'zcode',
  i18nPrefix: 'zcode_quota',
  filterFn: (file) => isZcodeFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchZcodeQuota,
  storeSelector: (state) => state.zcodeQuota,
  storeSetter: 'setZcodeQuota',
  buildLoadingState: () => ({ status: 'loading', ...emptyZcodeQuotaData() }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    ...emptyZcodeQuotaData(),
    error: message,
    errorStatus: status,
  }),
};

export const zcodeWindowPercentages = (data: ZcodeQuotaData): number[] => [
  asNumber(data.fiveHour?.used_percent),
  asNumber(data.weekly?.used_percent),
  asNumber(data.mcp?.used_percent),
  asNumber(data.monthly?.used_percent),
];
