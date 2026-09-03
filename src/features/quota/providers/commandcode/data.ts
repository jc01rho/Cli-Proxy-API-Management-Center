/**
 * Command Code quota data layer. React-free / SCSS-free.
 *
 * Reads the normalized quota payload from the proxy management API
 * (GET /v0/management/commandcode-quota?auth_index=...), which the backend
 * resolves against the configured Command Code API key — the UI never touches
 * api.commandcode.ai directly.
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, CommandCodeQuotaData, CommandCodeQuotaState } from '@/types';
import { apiClient } from '@/services/api';
import { isCommandCodeFile, isDisabledAuthFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

const asNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

/**
 * Backend unused windows are zero-filled (used=0, remaining=0, no reset).
 * Frontend emptyWindow() uses remaining=100 with an empty name.
 * A live 0% window still has a name and remaining=100.
 */
export const isCommandCodeWindowPresent = (
  win: CommandCodeQuotaData['fiveHour'] | null | undefined
): boolean => {
  if (!win) return false;
  const used = asNumber(win.used_percent);
  const remaining = asNumber(win.remaining_percent);
  const hasReset = Boolean(win.reset_at);
  if (used === 0 && remaining === 0 && !hasReset) return false;
  if (!win.name && used === 0 && !hasReset) return false;
  return true;
};

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
export const parseCommandCodeQuotaPayload = (payload: unknown): CommandCodeQuotaData | null => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const raw = payload as Record<string, unknown>;
  const authIndex = typeof raw.auth_index === 'string' ? raw.auth_index : '';
  if (!authIndex) return null;
  const str = (value: unknown): string => (typeof value === 'string' ? value : '');
  const creditsRaw = raw.credits_usd;
  const credits =
    creditsRaw && typeof creditsRaw === 'object' && !Array.isArray(creditsRaw)
      ? {
          used: asNumber((creditsRaw as Record<string, unknown>).used),
          limit: asNumber((creditsRaw as Record<string, unknown>).limit),
          remaining: asNumber((creditsRaw as Record<string, unknown>).remaining),
          percent: asNumber((creditsRaw as Record<string, unknown>).percent),
          expires_at: str((creditsRaw as Record<string, unknown>).expires_at) || null,
        }
      : null;
  return {
    authIndex,
    email: str(raw.email),
    fiveHour: { ...emptyWindow(), ...(raw.five_hour as object | undefined) },
    weekly: { ...emptyWindow(), ...(raw.weekly as object | undefined) },
    creditsUsd: credits,
  };
};

export const fetchCommandCodeQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<CommandCodeQuotaData> => {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) {
    throw new Error(t('commandcode_quota.missing_auth_index'));
  }

  const payload = await apiClient.get<unknown>('/commandcode-quota', {
    params: { auth_index: authIndex },
  });

  const data = parseCommandCodeQuotaPayload(payload);
  if (!data) {
    throw new Error(t('commandcode_quota.empty_data'));
  }
  return data;
};

const emptyCommandCodeQuotaData = (): CommandCodeQuotaData => ({
  authIndex: '',
  email: '',
  fiveHour: emptyWindow(),
  weekly: emptyWindow(),
  creditsUsd: null,
});

export const COMMANDCODE_CONFIG: QuotaProviderData<CommandCodeQuotaState, CommandCodeQuotaData> = {
  type: 'commandcode',
  i18nPrefix: 'commandcode_quota',
  filterFn: (file) => isCommandCodeFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchCommandCodeQuota,
  storeSelector: (state) => state.commandcodeQuota,
  storeSetter: 'setCommandCodeQuota',
  buildLoadingState: () => ({ status: 'loading', ...emptyCommandCodeQuotaData() }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    ...emptyCommandCodeQuotaData(),
    error: message,
    errorStatus: status,
  }),
};

export const commandCodeWindowPercentages = (data: CommandCodeQuotaData): number[] => [
  asNumber(data.fiveHour?.used_percent),
  asNumber(data.weekly?.used_percent),
  asNumber(data.creditsUsd?.percent),
];
