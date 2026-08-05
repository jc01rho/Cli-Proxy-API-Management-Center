import { describe, expect, test } from 'bun:test';
import { parseDocument } from 'yaml';
import {
  DEFAULT_KEEPER_EXPORT_VISUAL_VALUES,
  getKeeperExportValidationErrors,
  parseKeeperExportYaml,
  serializeKeeperExportYaml,
} from '../src/types/keeperExportVisual';
import { CONFIG_FIELD_SEARCH_INDEX } from '../src/components/config/configSearchIndex';
import { getKeeperExportStatusTone } from '../src/components/config/keeperExportStatus';
import { buildUsageExportSettingsPutBody } from '../src/types/keeperExport';
import en from '../src/i18n/locales/en.json';
import zhCN from '../src/i18n/locales/zh-CN.json';
import zhTW from '../src/i18n/locales/zh-TW.json';
import ru from '../src/i18n/locales/ru.json';

const localeBundles = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru };

describe('keeper export visual configuration', () => {
  test('parses and round-trips a complete YAML section using backend kebab-case keys', () => {
    const source = `usage-export:\n  enabled: true\n  mode: push\n  keeper:\n    url: https://keeper.example.com/export\n    token-env: CPA_KEEPER_INGEST_TOKEN\n    ca-file: /etc/cpa/keeper-ca.pem\n    client-cert-file: null\n    client-key-file: null\n  outbox:\n    path: /var/lib/cpa/keeper-outbox.db\n    max-bytes: 33554432\n  delivery:\n    max-batch-events: 250\n    max-batch-bytes: 524288\n    flush-interval-ms: 1500\n    request-timeout-ms: 12000\n    initial-backoff-ms: 500\n    max-backoff-ms: 30000\n  metadata:\n    enabled: true\n    interval-ms: 120000\n    categories: [auth_files, api_keys]\n  privacy:\n    include-client-ip: false\n    include-forwarded-for: true\n    include-user-agent: false\n`;

    const parsed = parseKeeperExportYaml(source);
    expect(parsed.present).toBe(true);
    expect(parsed.values.keeper.tokenEnv).toBe('CPA_KEEPER_INGEST_TOKEN');
    expect(parsed.values.delivery.maxBatchEvents).toBe('250');

    const roundTrip = serializeKeeperExportYaml(source, parsed.values, true);
    const output = parseDocument(roundTrip).toJSON() as Record<string, unknown>;
    expect(output['usage-export']).toEqual({
      enabled: true,
      mode: 'push',
      keeper: {
        url: 'https://keeper.example.com/export',
        'token-env': 'CPA_KEEPER_INGEST_TOKEN',
        'ca-file': '/etc/cpa/keeper-ca.pem',
        'client-cert-file': null,
        'client-key-file': null,
      },
      outbox: { path: '/var/lib/cpa/keeper-outbox.db', 'max-bytes': 33554432 },
      delivery: {
        'max-batch-events': 250,
        'max-batch-bytes': 524288,
        'flush-interval-ms': 1500,
        'request-timeout-ms': 12000,
        'initial-backoff-ms': 500,
        'max-backoff-ms': 30000,
      },
      metadata: { enabled: true, 'interval-ms': 120000, categories: ['auth_files', 'api_keys'] },
      privacy: {
        'include-client-ip': false,
        'include-forwarded-for': true,
        'include-user-agent': false,
      },
    });
  });

  test('does not materialize an absent untouched usage-export section', () => {
    const source = '# keep this comment\nusage-statistics-enabled: true\n';
    const parsed = parseKeeperExportYaml(source);

    expect(parsed.present).toBe(false);
    expect(serializeKeeperExportYaml(source, parsed.values, false)).toBe(source);
    expect(
      serializeKeeperExportYaml(
        source,
        { ...parsed.values, enabled: true, mode: 'push' },
        true
      )
    ).toContain('usage-export:');
    expect(serializeKeeperExportYaml(source, DEFAULT_KEEPER_EXPORT_VISUAL_VALUES, false)).not.toContain(
      'usage-export:'
    );
  });

  test('prunes an explicitly disabled section only after the visual section is dirty', () => {
    const source = 'usage-export:\n  enabled: true\n  mode: push\n  keeper:\n    url: https://keeper.example.com\n';
    const values = {
      ...parseKeeperExportYaml(source).values,
      enabled: false,
      mode: 'disabled' as const,
    };
    const output = serializeKeeperExportYaml(source, values, true);
    expect(output).not.toContain('usage-export:');
  });

  test('blocks push activation when required boundary values are invalid', () => {
    const errors = getKeeperExportValidationErrors(
      {
        ...DEFAULT_KEEPER_EXPORT_VISUAL_VALUES,
        enabled: true,
        mode: 'push',
        keeper: { ...DEFAULT_KEEPER_EXPORT_VISUAL_VALUES.keeper, url: 'ftp://keeper.invalid', tokenEnv: 'token' },
      },
      false
    );
    expect(errors).toEqual(
      expect.arrayContaining(['keeper_url_scheme', 'keeper_token_env', 'usage_statistics_required'])
    );
  });

  test('status tone is exhaustive and never color-only', () => {
    expect(getKeeperExportStatusTone('connected')).toEqual({ kind: 'success', icon: 'check' });
    expect(getKeeperExportStatusTone('retrying')).toEqual({ kind: 'warning', icon: 'retry' });
    expect(getKeeperExportStatusTone('blocked')).toEqual({ kind: 'error', icon: 'alert' });
    expect(getKeeperExportStatusTone('disabled')).toEqual({ kind: 'muted', icon: 'minus' });
  });

  test('search index includes anchored Keeper Export fields and mobile section id', () => {
    const keeperEntries = CONFIG_FIELD_SEARCH_INDEX.filter((entry) => entry.sectionId === 'keeperExport');
    expect(keeperEntries.map((entry) => entry.fieldId)).toEqual(
      expect.arrayContaining(['keeperExportEnabled', 'keeperUrl', 'keeperTokenEnv', 'keeperBacklog'])
    );
  });

  test('put body serializer cannot contain token material', () => {
    const body = buildUsageExportSettingsPutBody({
      enabled: false,
      mode: 'disabled',
      keeper: { url: '', tokenEnv: '', caFile: null, clientCertFile: null, clientKeyFile: null },
      outbox: { path: '/tmp/keeper-outbox.db', maxBytes: 16777216 },
      delivery: {
        maxBatchEvents: 500,
        maxBatchBytes: 1048576,
        flushIntervalMs: 1000,
        requestTimeoutMs: 15000,
        initialBackoffMs: 1000,
        maxBackoffMs: 60000,
      },
      metadata: { enabled: false, intervalMs: 300000, categories: [] },
      privacy: { includeClientIp: false, includeForwardedFor: false, includeUserAgent: false },
    });
    expect(body).not.toContain('tokenConfigured');
    expect(body).not.toContain('fixture_ingest_token_not_secret');
  });
});

test('all shipped locales contain the same Keeper Export key set', () => {
  const requiredKeys = [
    'config_management.visual.sections.keeper_export.title',
    'config_management.visual.sections.keeper_export.description',
    'config_management.visual.sections.keeper_export.fields.keeper_url',
    'config_management.visual.sections.keeper_export.fields.token_env',
    'config_management.visual.sections.keeper_export.status.connected',
    'config_management.visual.sections.keeper_export.status.retrying',
    'config_management.visual.sections.keeper_export.actions.test_connection',
  ];
  for (const [locale, bundle] of Object.entries(localeBundles)) {
    for (const key of requiredKeys) {
      let value: unknown = bundle;
      for (const segment of key.split('.')) {
        value = typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[segment] : undefined;
      }
      expect(value, `${locale} missing ${key}`).toBeString();
    }
  }
});
