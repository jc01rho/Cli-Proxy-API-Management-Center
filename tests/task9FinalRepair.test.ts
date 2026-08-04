import { describe, expect, test } from 'bun:test';
import axios from 'axios';
import { parseApiErrorResponse, shouldDispatchUnauthorizedLogout } from '../src/services/api/apiError';
import { getKeeperExportValidationErrors } from '../src/types/keeperExportVisual';
import { DEFAULT_KEEPER_EXPORT_VISUAL_VALUES } from '../src/types/keeperExportVisual';
import { getVisualSearchTargetIndex, searchConfigFields } from '../src/components/config/configSearchIndex';
import {
  beginKeeperStatusRequest,
  finishKeeperStatusRequest,
  type KeeperStatusFetchState,
} from '../src/components/config/keeperExportStatus';
import en from '../src/i18n/locales/en.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

function bundleTranslator(bundle: unknown) {
  return (key: string): string => {
    let value: unknown = bundle;
    for (const part of key.split('.')) {
      value = value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined;
    }
    return typeof value === 'string' ? value : key;
  };
}

const keeperEnvelope = JSON.stringify({
  protocolVersion: 'keeper-export/v1',
  error: { code: 'invalid_credential', message: 'REMOTE_SECRET_MARKER', retryable: false },
});

describe('final Task 9 repair RED contract', () => {
  test('raw Axios-like Keeper envelope is parsed before unauthorized classification', () => {
    const axiosError = new axios.AxiosError('Request failed with status code 401', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
      config: {} as never,
      data: keeperEnvelope,
    });
    const parsed = parseApiErrorResponse(axiosError.response?.data, axiosError.message);
    expect(parsed.apiCode).toBe('invalid_credential');
    expect(parsed.message).toBe('ingest credential is invalid');
    expect(shouldDispatchUnauthorizedLogout(401, parsed.apiCode)).toBe(false);
  });

  test('raw malformed or unknown Keeper envelopes fail generic without remote text', () => {
    const unknown = parseApiErrorResponse(JSON.stringify({ protocolVersion: 'keeper-export/v1', error: { code: 'unknown_code', message: 'REMOTE_SECRET_MARKER' } }), 'Network Error');
    const malformed = parseApiErrorResponse('{"protocolVersion":"keeper-export/v1",', 'Network Error');
    expect(unknown.apiCode).toBeUndefined();
    expect(unknown.message).toBe('keeper request failed');
    expect(malformed.message).toBe('keeper request failed');
    expect(malformed.message).not.toContain('REMOTE_SECRET_MARKER');
  });

  test('exact keeper search returns the four navigable Keeper anchors in order for every locale', () => {
    const expected = ['keeperExportEnabled', 'keeperUrl', 'keeperTokenEnv', 'keeperOutbox'];
    for (const bundle of [en, ru, zhCN, zhTW]) {
      expect(searchConfigFields('keeper', bundleTranslator(bundle)).slice(0, 4).map((entry) => entry.fieldId)).toEqual(expected);
    }
  });

  test('visual search uses a CURRENT match index with forward/backward wraparound', () => {
    expect(getVisualSearchTargetIndex(-1, 4, 'next')).toBe(0);
    expect(getVisualSearchTargetIndex(-1, 4, 'prev')).toBe(3);
    expect(getVisualSearchTargetIndex(0, 4, 'next')).toBe(1);
    expect(getVisualSearchTargetIndex(0, 4, 'prev')).toBe(3);
    expect(getVisualSearchTargetIndex(3, 4, 'next')).toBe(0);
    expect(getVisualSearchTargetIndex(3, 4, 'prev')).toBe(2);
    expect(getVisualSearchTargetIndex(1, 4, 'next')).toBe(2);
    expect(getVisualSearchTargetIndex(1, 4, 'prev')).toBe(0);
  });

  test('visual search has Keeper field matches and human-localized accessible labels in every locale', () => {
    const translate = (key: string) => key;
    expect(searchConfigFields('keeper url', translate).some((entry) => entry.fieldId === 'keeperUrl')).toBe(true);
    expect(searchConfigFields('token-env', translate).some((entry) => entry.fieldId === 'keeperTokenEnv')).toBe(true);
    expect(searchConfigFields('outbox', translate).some((entry) => entry.fieldId === 'keeperOutbox')).toBe(true);
    for (const bundle of [en, zhCN, zhTW, ru]) {
      expect(bundle.config_management.visual.search.placeholder).not.toContain('config_management');
      expect(bundle.config_management.visual.search.label).not.toContain('config_management');
      expect(bundle.config_management.visual.search.previous).not.toContain('config_management');
      expect(bundle.config_management.visual.search.next).not.toContain('config_management');
      expect(bundle.config_management.visual.sections.keeper_export.fields.auth_files).toBeString();
      expect(bundle.config_management.visual.sections.keeper_export.fields.api_keys).toBeString();
      expect(bundle.config_management.visual.sections.keeper_export.fields.provider_identities).toBeString();
    }
  });

  test('metadata categories retain stable serialized values and can be empty only when disabled', () => {
    const values = { ...DEFAULT_KEEPER_EXPORT_VISUAL_VALUES, enabled: true, mode: 'push' as const, metadata: { ...DEFAULT_KEEPER_EXPORT_VISUAL_VALUES.metadata, categories: [] } };
    expect(getKeeperExportValidationErrors(values, true)).toContain('keeper_metadata_categories');
  });

  test('visual layout uses one active section and natural mobile section height', async () => {
    const sectionStyles = await Bun.file('src/components/config/ConfigSection.module.scss').text();
    const editorStyles = await Bun.file('src/components/config/VisualConfigEditor.module.scss').text();
    expect(sectionStyles).not.toContain('overflow-y: auto');
    expect(sectionStyles).toContain('height: auto');
    expect(sectionStyles).toContain('line-height: 1.4');
    expect(editorStyles).toContain('overflow-x: hidden');
    expect(editorStyles).toContain('data-active-section');
    expect(editorStyles).toContain(':focus-visible');
  });

  test('status failure cannot leave a stale connected result after a newer request', () => {
    const connected = { state: 'connected', tokenConfigured: true } as never;
    let state: KeeperStatusFetchState = { requestId: 0, status: connected };
    const first = beginKeeperStatusRequest(state);
    state = first.state;
    const second = beginKeeperStatusRequest(state);
    state = second.state;
    state = finishKeeperStatusRequest(state, first.requestId, connected);
    expect(state.status).toBeNull();
    state = finishKeeperStatusRequest(state, second.requestId, null);
    expect(state.status).toBeNull();
  });
});
