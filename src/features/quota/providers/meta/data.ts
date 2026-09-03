import type { TFunction } from 'i18next';
import type { AuthFileItem, MetaMuseQuotaData, MetaMuseQuotaState } from '@/types';
import { authFilesApi } from '@/services/api';
import { isDisabledAuthFile } from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';
import {
  emptyMetaMuseQuotaData,
  parseMetaMuseQuotaPayload,
  selectMetaMuseQuota,
} from './parse';

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
  const quota = parseMetaMuseQuotaPayload(await authFilesApi.getMetaMuseQuota(authIndex));
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
