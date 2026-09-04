import type { TFunction } from 'i18next';
import type { ApiError, AuthFileItem, MetaMuseQuotaData, MetaMuseQuotaState } from '@/types';
import { authFilesApi } from '@/services/api';
import { isDisabledAuthFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';
import {
  emptyMetaMuseQuotaData,
  parseMetaMuseQuotaPayload,
  selectMetaMuseQuota,
} from './parse';

/**
 * Read one string field from an axios-style error payload without letting a
 * foreign shape crash the mapper. ApiError.details holds the raw response
 * body; older CPA builds may return a bare string or an empty body.
 */
const readErrorBodyField = (err: unknown, field: string): string => {
  const body =
    typeof err === 'object' && err !== null && 'details' in err
      ? (err as { details?: unknown }).details
      : undefined;
  if (body !== null && typeof body === 'object' && !Array.isArray(body)) {
    const value = (body as Record<string, unknown>)[field];
    return typeof value === 'string' ? value.trim() : '';
  }
  if (field === 'error' && typeof body === 'string') {
    return body.trim();
  }
  return '';
};

/**
 * Meta's cache-only endpoint answers 404 for three different reasons and the
 * shared resolveQuotaErrorMessage maps every 404 to "update CPA". Distinguish
 * them here from the handler's JSON body so the card explains the actual
 * cause instead of blaming the CPA version:
 * - "meta muse quota not observed yet": no stream observation cached yet.
 *   This is the normal first-run state, not a version problem.
 * - "meta credential not found": the requested auth_index no longer matches
 *   a Meta credential; refreshing the file list resolves it.
 * - anything else (including an empty Gin NoRoute body): the endpoint is
 *   genuinely absent, so keep the shared status-based mapping and rethrow
 *   with the numeric status attached.
 */
export const resolveMetaMuseQuotaError = (err: unknown, t: TFunction): never => {
  const fallback = err instanceof Error ? err.message : t('common.unknown_error');
  const status =
    typeof err === 'object' && err !== null && 'status' in err
      ? (err as { status?: unknown }).status
      : undefined;
  if (status === 404) {
    const code = readErrorBodyField(err, 'error').toLowerCase();
    if (code.includes('not observed yet')) {
      throw new Error(t('meta_muse_quota.empty_data'));
    }
    if (code.includes('not found')) {
      throw new Error(t('meta_muse_quota.credential_not_found'));
    }
  }
  const mapped = new Error(fallback) as ApiError;
  if (typeof status === 'number' && Number.isFinite(status)) {
    mapped.status = status;
  }
  throw mapped;
};
const META_MUSE_PROVIDER = 'openai-compatible-meta';

export const isMetaMuseFile = (file: AuthFileItem): boolean =>
  typeof file.provider === 'string' &&
  file.provider.trim().toLowerCase() === META_MUSE_PROVIDER;

export const fetchMetaMuseQuota = async (
  file: AuthFileItem,
  t: TFunction
): Promise<MetaMuseQuotaData> => {
  const authIndex = normalizeAuthIndex(file.auth_index ?? file.authIndex);
  if (!authIndex) {
    throw new Error(t('meta_muse_quota.missing_auth_index'));
  }
  let payload: unknown;
  try {
    payload = await authFilesApi.getMetaMuseQuota(authIndex);
  } catch (err: unknown) {
    resolveMetaMuseQuotaError(err, t);
  }
  const quota = parseMetaMuseQuotaPayload(payload);
  if (!quota) {
    throw new Error(t('meta_muse_quota.empty_data'));
  }
  return quota;
};

export const META_MUSE_CONFIG: QuotaProviderData<MetaMuseQuotaState, MetaMuseQuotaData> = {
  type: 'meta',
  i18nPrefix: 'meta_muse_quota',
  filterFn: (file) => isMetaMuseFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchMetaMuseQuota,
  storeSelector: selectMetaMuseQuota,
  storeSetter: 'setMetaMuseQuota',
  buildLoadingState: () => ({ status: 'loading', ...emptyMetaMuseQuotaData() }),
  buildSuccessState: (data) => ({ status: 'success', ...data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    ...emptyMetaMuseQuotaData(),
    error: message,
    errorStatus: status,
  }),
};
