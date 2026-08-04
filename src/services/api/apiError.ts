import { isRecord } from '@/utils/helpers';

export interface ParsedApiErrorResponse {
  message: string;
  apiCode?: string;
}

const KEEPER_ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_json: 'request JSON is invalid',
  unknown_field: 'request contains an unknown field',
  invalid_field: 'request contains an invalid field',
  body_instance_forbidden: 'instance identity must not be supplied by the request body',
  missing_credential: 'ingest credential is required',
  invalid_credential: 'ingest credential is invalid',
  insufficient_scope: 'credential scope does not permit this operation',
  instance_disabled: 'instance is disabled',
  instance_not_found: 'instance was not found',
  credential_not_found: 'credential was not found',
  method_not_allowed: 'method is not allowed',
  conflicting_replay: 'sequence was previously accepted with different payload',
  stale_revision: 'metadata revision is older than the current revision',
  conflicting_revision: 'metadata revision was previously accepted with different content',
  instance_state_conflict: 'instance state does not permit this operation',
  request_too_large: 'request exceeds the maximum size',
  unsupported_protocol_version: 'protocol version is not supported',
  invalid_sequence_order: 'event sequences must be strictly increasing',
  batch_limit_exceeded: 'usage batch exceeds an item or payload limit',
  incomplete_snapshot: 'metadata snapshot must be complete',
  duplicate_metadata_identity: 'metadata snapshot contains a duplicate identity',
  invalid_settings: 'usage export settings are invalid',
  token_env_unset: 'configured token environment variable is not set',
  rate_limited: 'request rate limit exceeded',
  storage_error: 'durable storage operation failed',
  keeper_unreachable: 'keeper could not be reached',
  keeper_invalid_response: 'keeper returned an invalid response',
  keeper_tls_error: 'keeper TLS validation failed',
  service_unavailable: 'service is temporarily unavailable',
  keeper_timeout: 'keeper request timed out',
  internal_error: 'internal operation failed',
};

export function isKeeperExportErrorResponse(responseData: unknown): boolean {
  return isRecord(responseData) && responseData.protocolVersion === 'keeper-export/v1' && isRecord(responseData.error);
}

export function shouldDispatchUnauthorizedLogout(status: number | undefined, apiCode?: string): boolean {
  return status === 401 && apiCode !== 'invalid_credential';
}

const readString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

function parseKeeperEnvelopeString(value: string): Record<string, unknown> | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return isKeeperExportErrorResponse(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Parse the Management API's error envelope.
 *
 * Newer endpoints use `error` as a stable machine-readable code and `message`
 * as the human-readable detail. Older endpoints may put the only useful text
 * directly in `error`, so that remains a fallback.
 */
export const parseApiErrorResponse = (
  responseData: unknown,
  fallbackMessage: string
): ParsedApiErrorResponse => {
  if (typeof responseData === 'string') {
    const keeperEnvelope = parseKeeperEnvelopeString(responseData);
    if (keeperEnvelope) {
      const code = isRecord(keeperEnvelope.error) && typeof keeperEnvelope.error.code === 'string'
        ? keeperEnvelope.error.code
        : undefined;
      if (!code || !Object.prototype.hasOwnProperty.call(KEEPER_ERROR_MESSAGES, code)) {
        return { message: 'keeper request failed' };
      }
      return parseApiErrorResponse(keeperEnvelope, fallbackMessage);
    }
    return {
      message: responseData.trim().startsWith('{') && responseData.includes('keeper-export/v1')
        ? 'keeper request failed'
        : responseData.trim().startsWith('{')
          ? readString(fallbackMessage) || 'Request failed'
          : readString(responseData) || readString(fallbackMessage) || 'Request failed',
    };
  }

  if (!isRecord(responseData)) {
    return {
      message: readString(responseData) || readString(fallbackMessage) || 'Request failed',
    };
  }

  const errorValue = responseData.error;
  const errorRecord = isRecord(errorValue) ? errorValue : null;
  const stringError = readString(errorValue);
  const rawApiCode = stringError || readString(errorRecord?.code) || undefined;
  const apiCode = isKeeperExportErrorResponse(responseData) && rawApiCode && !Object.prototype.hasOwnProperty.call(KEEPER_ERROR_MESSAGES, rawApiCode)
    ? undefined
    : rawApiCode;
  const keeperEnvelope = isKeeperExportErrorResponse(responseData);
  const keeperMessage = keeperEnvelope && apiCode ? KEEPER_ERROR_MESSAGES[apiCode] : undefined;
  const message =
    keeperMessage ||
    (keeperEnvelope ? 'keeper request failed' : readString(responseData.message)) ||
    readString(errorRecord?.message) ||
    stringError ||
    readString(fallbackMessage) ||
    'Request failed';

  return { message, apiCode };
};
