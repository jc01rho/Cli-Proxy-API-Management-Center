import { describe, expect, test } from 'bun:test';
import { parseApiErrorResponse } from '../src/services/api/apiError';
import {
  decodeUsageExportStatusResponse,
  KeeperProtocolError,
} from '../src/types/keeperExport';
import {
  DEFAULT_KEEPER_EXPORT_VISUAL_VALUES,
  getKeeperExportValidationErrors,
} from '../src/types/keeperExportVisual';
import { CONFIG_FIELD_SEARCH_INDEX } from '../src/components/config/configSearchIndex';
import en from '../src/i18n/locales/en.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

const locales = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru };
const baseStatus = {
  protocolVersion: 'keeper-export/v1', state: 'connected', enabled: true, tokenConfigured: true,
  instance: { instanceId: '0198aa10-4d88-7a20-8f4e-8c8de4a9cb11', displayName: 'QA instance' },
  streamId: '0198aa11-1055-7f12-8a00-e843d1e17522', nextSequence: 13,
  acknowledgedThrough: 12, nextExpectedSequence: 13, backlogEvents: 0, backlogBytes: 0,
  oldestBacklogAt: null, lastAttemptAt: '2026-08-03T12:39:59.000Z', lastSuccessAt: '2026-08-03T12:39:59.100Z',
  nextRetryAt: null, metadataRevisions: { auth_files: 7, api_keys: 3, provider_identities: 9 }, lastError: null,
};

const decode = (value: Record<string, unknown>) => decodeUsageExportStatusResponse(JSON.stringify(value));
const expectProtocolReject = (value: Record<string, unknown>) => {
  expect(() => decode(value)).toThrow(KeeperProtocolError);
};

describe('Task 9 repair contract', () => {
  test('keeper 401 errors use stable local text and do not trust remote markers', () => {
    const result = parseApiErrorResponse({
      protocolVersion: 'keeper-export/v1',
      error: { code: 'invalid_credential', message: 'REMOTE_SECRET_MARKER', retryable: false },
    }, 'Request failed');
    expect(result).toEqual({ message: 'ingest credential is invalid', apiCode: 'invalid_credential' });
  });

  test('status accepts connected with pending backlog and exact metadata keys', () => {
    const status = decode({ ...baseStatus, backlogEvents: 2, backlogBytes: 20, oldestBacklogAt: '2026-08-03T12:39:00.000Z' });
    expect(status.state).toBe('connected');
    expect(status.backlogEvents).toBe(2);
  });

  test('status rejects invalid state combinations', () => {
    expectProtocolReject({ ...baseStatus, state: 'starting', instance: baseStatus.instance });
    expectProtocolReject({ ...baseStatus, state: 'disabled', instance: baseStatus.instance });
    expectProtocolReject({ ...baseStatus, state: 'connected', instance: null });
    expectProtocolReject({ ...baseStatus, state: 'degraded', lastError: null });
    expectProtocolReject({ ...baseStatus, state: 'blocked', nextRetryAt: '2026-08-03T12:40:00.000Z' });
    expectProtocolReject({ ...baseStatus, metadataRevisions: { auth_files: 1, api_keys: 2, provider_identities: 3, unknown: 4 } });
    expectProtocolReject({ ...baseStatus, backlogEvents: 0, backlogBytes: 1 });
    expectProtocolReject({ ...baseStatus, backlogEvents: 1, backlogBytes: 0 });
  });

  test('metadata category defaults and selector validation cover all contract categories', () => {
    expect(DEFAULT_KEEPER_EXPORT_VISUAL_VALUES.metadata.categories).toEqual(['auth_files', 'api_keys', 'provider_identities']);
    expect(getKeeperExportValidationErrors({ ...DEFAULT_KEEPER_EXPORT_VISUAL_VALUES, enabled: true, mode: 'push', metadata: { ...DEFAULT_KEEPER_EXPORT_VISUAL_VALUES.metadata, categories: [] } }, true)).toContain('keeper_metadata_categories');
  });

  test('search index exposes every rendered keeper field anchor', () => {
    const ids = CONFIG_FIELD_SEARCH_INDEX.filter((entry) => entry.sectionId === 'keeperExport').map((entry) => entry.fieldId);
    expect(ids).toEqual(expect.arrayContaining(['keeperExportEnabled', 'keeperUrl', 'keeperTokenEnv', 'keeperOutbox', 'keeperDelivery', 'keeperMetadata', 'keeperPrivacy', 'keeperBacklog']));
  });

  test('all eight repair validation messages are present in every locale', () => {
    const keys = ['keeper_url_required', 'keeper_url_https', 'keeper_token_env', 'keeper_outbox_path', 'keeper_outbox_bytes', 'keeper_batch_events', 'keeper_batch_bytes', 'keeper_flush_interval', 'keeper_request_timeout', 'keeper_initial_backoff', 'keeper_max_backoff', 'keeper_metadata_interval', 'keeper_metadata_categories', 'usage_statistics_required'];
    for (const [locale, bundle] of Object.entries(locales)) {
      for (const key of keys) {
        const value = bundle.config_management.visual.validation[key as keyof typeof bundle.config_management.visual.validation];
        expect(typeof value, `${locale}:${key}`).toBe('string');
      }
    }
  });
});
