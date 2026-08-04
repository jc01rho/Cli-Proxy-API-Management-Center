import { isMap, parse as parseYaml, parseDocument } from 'yaml';
import type { UsageExportSettings } from './keeperExport';

export type KeeperExportMode = 'disabled' | 'push';

export type KeeperExportVisualValues = {
  readonly enabled: boolean;
  readonly mode: KeeperExportMode;
  readonly keeper: {
    readonly url: string;
    readonly tokenEnv: string;
    readonly caFile: string;
    readonly clientCertFile: string;
    readonly clientKeyFile: string;
  };
  readonly outbox: { readonly path: string; readonly maxBytes: string };
  readonly delivery: {
    readonly maxBatchEvents: string;
    readonly maxBatchBytes: string;
    readonly flushIntervalMs: string;
    readonly requestTimeoutMs: string;
    readonly initialBackoffMs: string;
    readonly maxBackoffMs: string;
  };
  readonly metadata: {
    readonly enabled: boolean;
    readonly intervalMs: string;
    readonly categories: readonly string[];
  };
  readonly privacy: {
    readonly includeClientIp: boolean;
    readonly includeForwardedFor: boolean;
    readonly includeUserAgent: boolean;
  };
};

export type KeeperExportVisualValidationError =
  | 'usage_statistics_required'
  | 'keeper_url_https'
  | 'keeper_token_env'
  | 'keeper_url_required'
  | 'keeper_outbox_path'
  | 'keeper_outbox_bytes'
  | 'keeper_batch_events'
  | 'keeper_batch_bytes'
  | 'keeper_flush_interval'
  | 'keeper_request_timeout'
  | 'keeper_initial_backoff'
  | 'keeper_max_backoff'
  | 'keeper_metadata_interval'
  | 'keeper_metadata_categories';

const METADATA_CATEGORIES = ['auth_files', 'api_keys', 'provider_identities'] as const;

export const DEFAULT_KEEPER_EXPORT_VISUAL_VALUES: KeeperExportVisualValues = {
  enabled: false,
  mode: 'disabled',
  keeper: { url: '', tokenEnv: '', caFile: '', clientCertFile: '', clientKeyFile: '' },
  outbox: { path: '', maxBytes: '1073741824' },
  delivery: {
    maxBatchEvents: '500',
    maxBatchBytes: '1048576',
    flushIntervalMs: '1000',
    requestTimeoutMs: '15000',
    initialBackoffMs: '1000',
    maxBackoffMs: '60000',
  },
  metadata: {
    enabled: true,
    intervalMs: '300000',
    categories: [...METADATA_CATEGORIES],
  },
  privacy: { includeClientIp: false, includeForwardedFor: false, includeUserAgent: false },
};

type YamlRecord = Record<string, unknown>;

function asRecord(value: unknown): YamlRecord | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as YamlRecord;
}

function readString(record: YamlRecord | null, key: string, fallback: string): string {
  return typeof record?.[key] === 'string' ? record[key] : fallback;
}

function readInteger(record: YamlRecord | null, key: string, fallback: string): string {
  const value = record?.[key];
  return typeof value === 'number' || typeof value === 'string' ? String(value) : fallback;
}

function readBoolean(record: YamlRecord | null, key: string, fallback: boolean): boolean {
  return typeof record?.[key] === 'boolean' ? record[key] : fallback;
}

export function parseKeeperExportYaml(yamlContent: string): {
  readonly values: KeeperExportVisualValues;
  readonly present: boolean;
} {
  const parsed = asRecord(parseYaml(yamlContent) || {});
  const section = asRecord(parsed?.['usage-export']);
  const keeper = asRecord(section?.keeper);
  const outbox = asRecord(section?.outbox);
  const delivery = asRecord(section?.delivery);
  const metadata = asRecord(section?.metadata);
  const privacy = asRecord(section?.privacy);
  const rawCategories = metadata?.categories;
  const categories = Array.isArray(rawCategories)
    ? rawCategories.filter((category): category is string => typeof category === 'string')
    : DEFAULT_KEEPER_EXPORT_VISUAL_VALUES.metadata.categories;

  return {
    present: section !== null,
    values: {
      enabled: readBoolean(section, 'enabled', false),
      mode: section?.mode === 'push' ? 'push' : 'disabled',
      keeper: {
        url: readString(keeper, 'url', ''),
        tokenEnv: readString(keeper, 'token-env', ''),
        caFile: readString(keeper, 'ca-file', ''),
        clientCertFile: readString(keeper, 'client-cert-file', ''),
        clientKeyFile: readString(keeper, 'client-key-file', ''),
      },
      outbox: {
        path: readString(outbox, 'path', ''),
        maxBytes: readInteger(outbox, 'max-bytes', DEFAULT_KEEPER_EXPORT_VISUAL_VALUES.outbox.maxBytes),
      },
      delivery: {
        maxBatchEvents: readInteger(delivery, 'max-batch-events', '500'),
        maxBatchBytes: readInteger(delivery, 'max-batch-bytes', '1048576'),
        flushIntervalMs: readInteger(delivery, 'flush-interval-ms', '1000'),
        requestTimeoutMs: readInteger(delivery, 'request-timeout-ms', '15000'),
        initialBackoffMs: readInteger(delivery, 'initial-backoff-ms', '1000'),
        maxBackoffMs: readInteger(delivery, 'max-backoff-ms', '60000'),
      },
      metadata: {
        enabled: readBoolean(metadata, 'enabled', true),
        intervalMs: readInteger(metadata, 'interval-ms', '300000'),
        categories,
      },
      privacy: {
        includeClientIp: readBoolean(privacy, 'include-client-ip', false),
        includeForwardedFor: readBoolean(privacy, 'include-forwarded-for', false),
        includeUserAgent: readBoolean(privacy, 'include-user-agent', false),
      },
    },
  };
}

function setIfPresent(doc: ReturnType<typeof parseDocument>, path: string[], value: unknown): void {
  doc.setIn(path, value);
}

function hasMap(doc: ReturnType<typeof parseDocument>, path: string[]): boolean {
  return isMap(doc.getIn(path, true));
}

function setKeeperExportFields(
  doc: ReturnType<typeof parseDocument>,
  values: KeeperExportVisualValues
): void {
  setIfPresent(doc, ['usage-export', 'enabled'], values.enabled);
  setIfPresent(doc, ['usage-export', 'mode'], values.mode);
  setIfPresent(doc, ['usage-export', 'keeper', 'url'], values.keeper.url);
  setIfPresent(doc, ['usage-export', 'keeper', 'token-env'], values.keeper.tokenEnv);
  setIfPresent(doc, ['usage-export', 'keeper', 'ca-file'], values.keeper.caFile || null);
  setIfPresent(doc, ['usage-export', 'keeper', 'client-cert-file'], values.keeper.clientCertFile || null);
  setIfPresent(doc, ['usage-export', 'keeper', 'client-key-file'], values.keeper.clientKeyFile || null);
  setIfPresent(doc, ['usage-export', 'outbox', 'path'], values.outbox.path);
  setIfPresent(doc, ['usage-export', 'outbox', 'max-bytes'], Number(values.outbox.maxBytes));
  setIfPresent(doc, ['usage-export', 'delivery', 'max-batch-events'], Number(values.delivery.maxBatchEvents));
  setIfPresent(doc, ['usage-export', 'delivery', 'max-batch-bytes'], Number(values.delivery.maxBatchBytes));
  setIfPresent(doc, ['usage-export', 'delivery', 'flush-interval-ms'], Number(values.delivery.flushIntervalMs));
  setIfPresent(doc, ['usage-export', 'delivery', 'request-timeout-ms'], Number(values.delivery.requestTimeoutMs));
  setIfPresent(doc, ['usage-export', 'delivery', 'initial-backoff-ms'], Number(values.delivery.initialBackoffMs));
  setIfPresent(doc, ['usage-export', 'delivery', 'max-backoff-ms'], Number(values.delivery.maxBackoffMs));
  setIfPresent(doc, ['usage-export', 'metadata', 'enabled'], values.metadata.enabled);
  setIfPresent(doc, ['usage-export', 'metadata', 'interval-ms'], Number(values.metadata.intervalMs));
  setIfPresent(doc, ['usage-export', 'metadata', 'categories'], [...values.metadata.categories]);
  setIfPresent(doc, ['usage-export', 'privacy', 'include-client-ip'], values.privacy.includeClientIp);
  setIfPresent(doc, ['usage-export', 'privacy', 'include-forwarded-for'], values.privacy.includeForwardedFor);
  setIfPresent(doc, ['usage-export', 'privacy', 'include-user-agent'], values.privacy.includeUserAgent);
}

export function serializeKeeperExportYaml(
  currentYaml: string,
  values: KeeperExportVisualValues,
  dirty: boolean
): string {
  if (!dirty) return currentYaml;
  const doc = parseDocument(currentYaml);
  if (doc.errors.length > 0) return currentYaml;
  if (!values.enabled && values.mode === 'disabled') {
    if (doc.hasIn(['usage-export'])) doc.deleteIn(['usage-export']);
    return doc.toString({ indent: 2, lineWidth: 120, minContentWidth: 0 });
  }
  if (!hasMap(doc, ['usage-export'])) doc.setIn(['usage-export'], doc.createNode({}));
  setKeeperExportFields(doc, values);
  return doc.toString({ indent: 2, lineWidth: 120, minContentWidth: 0 });
}

function integerInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= min && number <= max;
}

export function getKeeperExportValidationErrors(
  values: KeeperExportVisualValues,
  usageStatisticsEnabled: boolean
): KeeperExportVisualValidationError[] {
  if (!values.enabled || values.mode === 'disabled') return [];
  const errors: KeeperExportVisualValidationError[] = [];
  if (!usageStatisticsEnabled) errors.push('usage_statistics_required');
  if (!values.keeper.url.trim()) errors.push('keeper_url_required');
  else {
    try {
      const url = new URL(values.keeper.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        errors.push('keeper_url_https');
      }
    } catch {
      errors.push('keeper_url_https');
    }
  }
  if (!/^[A-Z_][A-Z0-9_]{0,127}$/.test(values.keeper.tokenEnv)) errors.push('keeper_token_env');
  if (!values.outbox.path.startsWith('/')) errors.push('keeper_outbox_path');
  if (!integerInRange(values.outbox.maxBytes, 16 * 1024 * 1024, 1024 * 1024 * 1024 * 1024)) errors.push('keeper_outbox_bytes');
  if (!integerInRange(values.delivery.maxBatchEvents, 1, 500)) errors.push('keeper_batch_events');
  if (!integerInRange(values.delivery.maxBatchBytes, 65536, 1048576)) errors.push('keeper_batch_bytes');
  if (!integerInRange(values.delivery.flushIntervalMs, 100, 60000)) errors.push('keeper_flush_interval');
  if (!integerInRange(values.delivery.requestTimeoutMs, 1000, 120000)) errors.push('keeper_request_timeout');
  if (!integerInRange(values.delivery.initialBackoffMs, 100, 60000)) errors.push('keeper_initial_backoff');
  if (!integerInRange(values.delivery.maxBackoffMs, Number(values.delivery.initialBackoffMs) || 0, 900000)) errors.push('keeper_max_backoff');
  if (!integerInRange(values.metadata.intervalMs, 60000, 86400000)) errors.push('keeper_metadata_interval');
  if (values.metadata.enabled && values.metadata.categories.length === 0) errors.push('keeper_metadata_categories');
  return errors;
}

export function keeperExportVisualToSettings(values: KeeperExportVisualValues): UsageExportSettings {
  return {
    enabled: values.enabled,
    mode: values.mode,
    keeper: {
      url: values.keeper.url,
      tokenEnv: values.keeper.tokenEnv,
      caFile: values.keeper.caFile || null,
      clientCertFile: values.keeper.clientCertFile || null,
      clientKeyFile: values.keeper.clientKeyFile || null,
    },
    outbox: { path: values.outbox.path, maxBytes: Number(values.outbox.maxBytes) },
    delivery: {
      maxBatchEvents: Number(values.delivery.maxBatchEvents),
      maxBatchBytes: Number(values.delivery.maxBatchBytes),
      flushIntervalMs: Number(values.delivery.flushIntervalMs),
      requestTimeoutMs: Number(values.delivery.requestTimeoutMs),
      initialBackoffMs: Number(values.delivery.initialBackoffMs),
      maxBackoffMs: Number(values.delivery.maxBackoffMs),
    },
    metadata: {
      enabled: values.metadata.enabled,
      intervalMs: Number(values.metadata.intervalMs),
      categories: values.metadata.categories.filter(
        (category): category is (typeof METADATA_CATEGORIES)[number] => METADATA_CATEGORIES.includes(category as (typeof METADATA_CATEGORIES)[number])
      ),
    },
    privacy: { ...values.privacy },
  };
}
