import { apiClient } from './client';
import {
  buildUsageExportSettingsPutBody,
  decodeConnectionTestResponse,
  decodeKeeperExportBytes,
  decodeUsageExportSettingsResponse,
  decodeUsageExportStatusResponse,
  type ConnectionTestResponse,
  type KeeperErrorCode,
  type UsageExportSettings,
  type UsageExportSettingsResponse,
  type UsageExportStatusResponse,
} from '@/types/keeperExport';

const SETTINGS_PATH = '/usage-export/settings';
const TEST_PATH = '/usage-export/test';
const STATUS_PATH = '/usage-export/status';

const STABLE_ERROR_MESSAGES: Readonly<Record<KeeperErrorCode, string>> = {
  invalid_json: 'Request JSON is invalid', unknown_field: 'Request contains an unknown field', invalid_field: 'Request contains an invalid field', body_instance_forbidden: 'Instance identity must not be supplied by the request body', missing_credential: 'Ingest credential is required', invalid_credential: 'Ingest credential is invalid', insufficient_scope: 'Credential scope does not permit this operation', instance_disabled: 'Instance is disabled', instance_not_found: 'Instance was not found', credential_not_found: 'Credential was not found', method_not_allowed: 'Method is not allowed', conflicting_replay: 'Sequence was previously accepted with different payload', stale_revision: 'Metadata revision is older than the current revision', conflicting_revision: 'Metadata revision was previously accepted with different content', instance_state_conflict: 'Instance state does not permit this operation', request_too_large: 'Request exceeds the maximum size', unsupported_protocol_version: 'Protocol version is not supported', invalid_sequence_order: 'Event sequences must be strictly increasing', batch_limit_exceeded: 'Usage batch exceeds an item or payload limit', incomplete_snapshot: 'Metadata snapshot must be complete', duplicate_metadata_identity: 'Metadata snapshot contains a duplicate identity', invalid_settings: 'Usage export settings are invalid', token_env_unset: 'Configured token environment variable is not set', rate_limited: 'Request rate limit exceeded', storage_error: 'Durable storage operation failed', internal_error: 'Internal operation failed', keeper_unreachable: 'Keeper could not be reached', keeper_invalid_response: 'Keeper returned an invalid response', keeper_tls_error: 'Keeper TLS validation failed', service_unavailable: 'Service is temporarily unavailable', keeper_timeout: 'Keeper request timed out',
};

class UsageExportApiError extends Error {
  readonly name = 'UsageExportApiError';
  readonly apiCode: KeeperErrorCode | undefined;

  constructor(code: KeeperErrorCode | undefined, fallback: string) {
    super(code ? STABLE_ERROR_MESSAGES[code] : fallback);
    this.apiCode = code;
  }
}

function decodeJson<T>(data: unknown, decoder: (text: string) => T): T {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return decodeKeeperExportBytes(new TextEncoder().encode(text), decoder);
}

async function call<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error: unknown) {
    if (error instanceof Error) {
      const candidate = 'apiCode' in error && typeof error.apiCode === 'string' ? error.apiCode : undefined;
      const code = candidate && candidate in STABLE_ERROR_MESSAGES ? (candidate as KeeperErrorCode) : undefined;
      throw new UsageExportApiError(code, error.message);
    }
    throw error;
  }
}

export const usageExportApi = {
  async getSettings(): Promise<UsageExportSettingsResponse> {
    const response = await call(() => apiClient.getRaw(SETTINGS_PATH, { headers: { Accept: 'application/json' }, transformResponse: [(data: unknown) => data] }));
    return decodeJson(response.data, decodeUsageExportSettingsResponse);
  },

  async putSettings(settings: UsageExportSettings): Promise<UsageExportSettingsResponse> {
    const response = await call(() => apiClient.putRaw(SETTINGS_PATH, buildUsageExportSettingsPutBody(settings), { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, transformResponse: [(data: unknown) => data] }));
    return decodeJson(response.data, decodeUsageExportSettingsResponse);
  },

  async testConnection(settings: UsageExportSettings | null): Promise<ConnectionTestResponse> {
    const response = await call(() => apiClient.postRaw(TEST_PATH, { protocolVersion: 'keeper-export/v1', settings }, { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, transformResponse: [(data: unknown) => data] }));
    return decodeJson(response.data, decodeConnectionTestResponse);
  },

  async getStatus(): Promise<UsageExportStatusResponse> {
    const response = await call(() => apiClient.getRaw(STATUS_PATH, { headers: { Accept: 'application/json' }, transformResponse: [(data: unknown) => data] }));
    return decodeJson(response.data, decodeUsageExportStatusResponse);
  },
};
