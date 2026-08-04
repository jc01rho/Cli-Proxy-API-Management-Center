/**
 * Strict keeper-export/v1 protocol types and decoders for the Management Center.
 *
 * Contract: .omo/start-work/task-1-protocol-spec.md (FROZEN). These decoders
 * implement the strict JSON rules of section 2 (duplicate keys, unknown fields,
 * safe integers, millisecond UTC timestamps, byte limits) and the management
 * response shapes of sections 5-9. They never persist, log, or re-emit token
 * material: the only decoder that accepts a `token` field is the one-time
 * instance registration response, and the settings PUT serializer
 * structurally cannot emit `token`/`tokenConfigured`.
 */

export const KEEPER_EXPORT_PROTOCOL_VERSION = 'keeper-export/v1' as const;

export const KEEPER_ERROR_CODES = [
  'invalid_json',
  'unknown_field',
  'invalid_field',
  'body_instance_forbidden',
  'missing_credential',
  'invalid_credential',
  'insufficient_scope',
  'instance_disabled',
  'instance_not_found',
  'credential_not_found',
  'method_not_allowed',
  'conflicting_replay',
  'stale_revision',
  'conflicting_revision',
  'instance_state_conflict',
  'request_too_large',
  'unsupported_protocol_version',
  'invalid_sequence_order',
  'batch_limit_exceeded',
  'incomplete_snapshot',
  'duplicate_metadata_identity',
  'invalid_settings',
  'token_env_unset',
  'rate_limited',
  'storage_error',
  'internal_error',
  'keeper_unreachable',
  'keeper_invalid_response',
  'keeper_tls_error',
  'service_unavailable',
  'keeper_timeout',
] as const;

export type KeeperErrorCode = (typeof KEEPER_ERROR_CODES)[number];

const KEEPER_ERROR_CODE_SET: ReadonlySet<string> = new Set(KEEPER_ERROR_CODES);

export class KeeperProtocolError extends Error {
  readonly code: KeeperErrorCode;

  constructor(code: KeeperErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'KeeperProtocolError';
    this.code = code;
  }
}

const fail = (code: KeeperErrorCode, detail?: string): never => {
  throw new KeeperProtocolError(code, detail);
};

/* --------------------------------------------------------------------------
 * Strict JSON parser (spec section 2.1).
 * Rejects duplicate object keys, trailing content, and non-JSON tokens with
 * `invalid_json`, and records source spans so raw payload byte limits can be
 * enforced on the exact received slice (spec section 6.1).
 * ------------------------------------------------------------------------ */

type JsonNode =
  | { kind: 'null'; start: number; end: number }
  | { kind: 'boolean'; value: boolean; start: number; end: number }
  | { kind: 'number'; value: number; start: number; end: number }
  | { kind: 'string'; value: string; start: number; end: number }
  | { kind: 'array'; items: JsonNode[]; start: number; end: number }
  | { kind: 'object'; entries: Map<string, JsonNode>; start: number; end: number };

const MAX_JSON_DEPTH = 200;

class StrictJsonParser {
  private index = 0;

  constructor(private readonly text: string) {}

  parse(): JsonNode {
    this.skipWhitespace();
    const node = this.parseValue(0);
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      fail('invalid_json', 'trailing content after JSON value');
    }
    return node;
  }

  private skipWhitespace(): void {
    while (this.index < this.text.length) {
      const ch = this.text[this.index];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.index += 1;
      } else {
        return;
      }
    }
  }

  private parseValue(depth: number): JsonNode {
    if (depth > MAX_JSON_DEPTH) fail('invalid_json', 'JSON nesting too deep');
    if (this.index >= this.text.length) fail('invalid_json', 'unexpected end of input');
    const ch = this.text[this.index];
    if (ch === '{') return this.parseObject(depth);
    if (ch === '[') return this.parseArray(depth);
    if (ch === '"') return this.parseString();
    if (ch === 't') return this.parseLiteral('true', { kind: 'boolean', value: true });
    if (ch === 'f') return this.parseLiteral('false', { kind: 'boolean', value: false });
    if (ch === 'n') return this.parseLiteral('null', { kind: 'null' });
    if (ch === '-' || (ch >= '0' && ch <= '9')) return this.parseNumber();
    return fail('invalid_json', `unexpected character ${JSON.stringify(ch)}`);
  }

  private parseLiteral(
    literal: 'true' | 'false' | 'null',
    value: { kind: 'boolean'; value: boolean } | { kind: 'null' }
  ): JsonNode {
    const start = this.index;
    if (!this.text.startsWith(literal, start)) fail('invalid_json', 'invalid literal');
    this.index += literal.length;
    return { ...value, start, end: this.index } as JsonNode;
  }

  private parseNumber(): JsonNode {
    const start = this.index;
    if (this.text[this.index] === '-') this.index += 1;
    if (this.text[this.index] === '0') {
      this.index += 1;
    } else if (this.text[this.index] >= '1' && this.text[this.index] <= '9') {
      while (this.text[this.index] >= '0' && this.text[this.index] <= '9') this.index += 1;
    } else {
      fail('invalid_json', 'invalid number');
    }
    if (this.text[this.index] === '.') {
      this.index += 1;
      if (!(this.text[this.index] >= '0' && this.text[this.index] <= '9')) {
        fail('invalid_json', 'invalid number fraction');
      }
      while (this.text[this.index] >= '0' && this.text[this.index] <= '9') this.index += 1;
    }
    if (this.text[this.index] === 'e' || this.text[this.index] === 'E') {
      this.index += 1;
      if (this.text[this.index] === '+' || this.text[this.index] === '-') this.index += 1;
      if (!(this.text[this.index] >= '0' && this.text[this.index] <= '9')) {
        fail('invalid_json', 'invalid number exponent');
      }
      while (this.text[this.index] >= '0' && this.text[this.index] <= '9') this.index += 1;
    }
    const value = Number(this.text.slice(start, this.index));
    if (!Number.isFinite(value)) fail('invalid_json', 'number out of range');
    return { kind: 'number', value, start, end: this.index };
  }

  private parseString(): Extract<JsonNode, { kind: 'string' }> {
    const start = this.index;
    this.index += 1; // opening quote
    let value = '';
    while (this.index < this.text.length) {
      const ch = this.text[this.index];
      if (ch === '"') {
        this.index += 1;
        return { kind: 'string', value, start, end: this.index };
      }
      if (ch === '\\') {
        this.index += 1;
        const esc = this.text[this.index];
        switch (esc) {
          case '"':
          case '\\':
          case '/':
            value += esc;
            this.index += 1;
            break;
          case 'b':
            value += '\b';
            this.index += 1;
            break;
          case 'f':
            value += '\f';
            this.index += 1;
            break;
          case 'n':
            value += '\n';
            this.index += 1;
            break;
          case 'r':
            value += '\r';
            this.index += 1;
            break;
          case 't':
            value += '\t';
            this.index += 1;
            break;
          case 'u':
            value += this.parseUnicodeEscape();
            break;
          default:
            fail('invalid_json', 'invalid string escape');
        }
        continue;
      }
      if (ch < ' ') fail('invalid_json', 'unescaped control character in string');
      value += ch;
      this.index += 1;
    }
    return fail('invalid_json', 'unterminated string');
  }

  private parseUnicodeEscape(): string {
    const hex = this.text.slice(this.index + 1, this.index + 5);
    if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('invalid_json', 'invalid unicode escape');
    this.index += 5;
    let code = parseInt(hex, 16);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (this.text[this.index] === '\\' && this.text[this.index + 1] === 'u') {
        const lowHex = this.text.slice(this.index + 2, this.index + 6);
        if (/^[0-9a-fA-F]{4}$/.test(lowHex)) {
          const low = parseInt(lowHex, 16);
          if (low >= 0xdc00 && low <= 0xdfff) {
            this.index += 6;
            code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
            return String.fromCodePoint(code);
          }
        }
      }
      fail('invalid_json', 'unpaired surrogate escape');
    }
    if (code >= 0xdc00 && code <= 0xdfff) fail('invalid_json', 'unpaired surrogate escape');
    return String.fromCharCode(code);
  }

  private parseArray(depth: number): JsonNode {
    const start = this.index;
    this.index += 1; // [
    const items: JsonNode[] = [];
    this.skipWhitespace();
    if (this.text[this.index] === ']') {
      this.index += 1;
      return { kind: 'array', items, start, end: this.index };
    }
    for (;;) {
      this.skipWhitespace();
      items.push(this.parseValue(depth + 1));
      this.skipWhitespace();
      const ch = this.text[this.index];
      if (ch === ',') {
        this.index += 1;
        continue;
      }
      if (ch === ']') {
        this.index += 1;
        return { kind: 'array', items, start, end: this.index };
      }
      fail('invalid_json', 'expected , or ] in array');
    }
  }

  private parseObject(depth: number): JsonNode {
    const start = this.index;
    this.index += 1; // {
    const entries = new Map<string, JsonNode>();
    this.skipWhitespace();
    if (this.text[this.index] === '}') {
      this.index += 1;
      return { kind: 'object', entries, start, end: this.index };
    }
    for (;;) {
      this.skipWhitespace();
      if (this.text[this.index] !== '"') fail('invalid_json', 'object key must be a string');
      const keyNode = this.parseString();
      if (entries.has(keyNode.value)) {
        fail('invalid_json', `duplicate object key ${JSON.stringify(keyNode.value)}`);
      }
      this.skipWhitespace();
      if (this.text[this.index] !== ':') fail('invalid_json', 'expected : in object');
      this.index += 1;
      this.skipWhitespace();
      entries.set(keyNode.value, this.parseValue(depth + 1));
      this.skipWhitespace();
      const ch = this.text[this.index];
      if (ch === ',') {
        this.index += 1;
        continue;
      }
      if (ch === '}') {
        this.index += 1;
        return { kind: 'object', entries, start, end: this.index };
      }
      fail('invalid_json', 'expected , or } in object');
    }
  }
}

const parseStrict = (text: string): JsonNode => new StrictJsonParser(text).parse();

const fatalUtf8Decoder = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

/**
 * Strict wire-byte boundary for keeper-export/v1 JSON.
 *
 * Network/file callers MUST enter through this helper while they still have the
 * original bytes. Invalid UTF-8 is rejected as invalid_json before a JavaScript
 * string exists, so no U+FFFD replacement can mask malformed wire input.
 * Existing string decoders remain available for trusted in-memory JSON.
 * `ignoreBOM:true` preserves a UTF-8 BOM as U+FEFF for the strict JSON parser to
 * reject rather than silently stripping it.
 */
export function decodeKeeperExportBytes<T>(
  bytes: Uint8Array,
  decodeString: (text: string) => T
): T {
  let text: string;
  try {
    text = fatalUtf8Decoder.decode(bytes);
  } catch {
    return fail('invalid_json', 'request JSON is not valid UTF-8');
  }
  return decodeString(text);
}

/* --------------------------------------------------------------------------
 * Field validators (spec sections 2.1-2.3).
 * ------------------------------------------------------------------------ */

const textEncoder = new TextEncoder();
const byteLength = (value: string): number => textEncoder.encode(value).length;

// eslint-disable-next-line no-control-regex -- control characters must be rejected per spec 2.3
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;
const FINGERPRINT = /^akf1_[0-9a-f]{64}$/;
const ENV_NAME = /^[A-Z_][A-Z0-9_]{0,127}$/;
const SAFE_INTEGER_MAX = 9007199254740991;

type ObjectEntries = Map<string, JsonNode>;

const asObject = (node: JsonNode, path: string): ObjectEntries => {
  if (node.kind !== 'object') return fail('invalid_field', `${path} must be an object`);
  return node.entries;
};

const asArray = (node: JsonNode, path: string): JsonNode[] => {
  if (node.kind !== 'array') return fail('invalid_field', `${path} must be an array`);
  return node.items;
};

/** Reject unknown keys. Runs before per-field validation at each object. */
const expectKeys = (entries: ObjectEntries, allowed: readonly string[], path: string): void => {
  const allowedSet = new Set(allowed);
  for (const key of entries.keys()) {
    if (!allowedSet.has(key)) fail('unknown_field', `${path} contains unknown field ${key}`);
  }
};

const required = (entries: ObjectEntries, key: string, path: string): JsonNode => {
  const node = entries.get(key);
  if (node === undefined) return fail('invalid_field', `${path}.${key} is required`);
  return node;
};

interface StringRule {
  minBytes?: number;
  maxBytes: number;
  pattern?: RegExp;
  enum?: readonly string[];
  /** Reject leading/trailing whitespace (IDs, URLs, enums, names, paths, env names). */
  tight?: boolean;
}

const asString = (node: JsonNode, path: string, rule: StringRule): string => {
  if (node.kind !== 'string') return fail('invalid_field', `${path} must be a string`);
  const value = node.value;
  if (CONTROL_CHARS.test(value)) fail('invalid_field', `${path} contains a control character`);
  if (rule.tight && value !== value.trim()) {
    fail('invalid_field', `${path} has leading/trailing whitespace`);
  }
  const bytes = byteLength(value);
  if (rule.minBytes !== undefined && bytes < rule.minBytes) {
    fail('invalid_field', `${path} is below the minimum length`);
  }
  if (bytes > rule.maxBytes) fail('invalid_field', `${path} exceeds the maximum length`);
  if (rule.enum && !rule.enum.includes(value)) fail('invalid_field', `${path} is not allowed`);
  if (rule.pattern && !rule.pattern.test(value)) {
    fail('invalid_field', `${path} has an invalid format`);
  }
  return value;
};

const asBoolean = (node: JsonNode, path: string): boolean => {
  if (node.kind !== 'boolean') return fail('invalid_field', `${path} must be a boolean`);
  return node.value;
};

const asInteger = (node: JsonNode, path: string, min: number, max: number): number => {
  if (node.kind !== 'number' || !Number.isSafeInteger(node.value)) {
    return fail('invalid_field', `${path} must be a safe integer`);
  }
  if (node.value < min || node.value > max) {
    fail('invalid_field', `${path} is out of range`);
  }
  return node.value;
};

const asTimestamp = (node: JsonNode, path: string): string => {
  if (node.kind !== 'string') return fail('invalid_field', `${path} must be a timestamp string`);
  const match = TIMESTAMP.exec(node.value);
  if (!match) return fail('invalid_field', `${path} must be UTC RFC3339 with millisecond precision`);
  const [, year, month, day, hour, minute, second, millis] = match;
  const time = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millis)
  );
  const date = new Date(time);
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day) ||
    date.getUTCHours() !== Number(hour) ||
    date.getUTCMinutes() !== Number(minute) ||
    date.getUTCSeconds() !== Number(second)
  ) {
    fail('invalid_field', `${path} is not a real UTC instant`);
  }
  return node.value;
};

const asUuidV7 = (node: JsonNode, path: string): string =>
  asString(node, path, { maxBytes: 36, pattern: UUID_V7, tight: true });

const asFingerprint = (node: JsonNode, path: string): string =>
  asString(node, path, { minBytes: 69, maxBytes: 69, pattern: FINGERPRINT, tight: true });

const isNull = (node: JsonNode): boolean => node.kind === 'null';

/** Reject body-authoritative instance selectors at any depth (spec 2.4). */
const rejectBodyInstanceSelector = (node: JsonNode): void => {
  if (node.kind === 'object') {
    for (const [key, value] of node.entries) {
      if (key === 'instanceId' || key === 'instance_id') {
        fail('body_instance_forbidden', 'instance identity must not be supplied by the request body');
      }
      rejectBodyInstanceSelector(value);
    }
    return;
  }
  if (node.kind === 'array') {
    for (const item of node.items) rejectBodyInstanceSelector(item);
  }
};

const checkProtocolVersion = (entries: ObjectEntries, path: string): void => {
  const node = entries.get('protocolVersion');
  if (node === undefined) return fail('invalid_field', `${path}.protocolVersion is required`);
  if (node.kind !== 'string') return fail('invalid_field', `${path}.protocolVersion must be a string`);
  if (node.value !== KEEPER_EXPORT_PROTOCOL_VERSION) {
    fail('unsupported_protocol_version', 'protocol version is not supported');
  }
};

/* --------------------------------------------------------------------------
 * Public protocol types.
 * ------------------------------------------------------------------------ */

export type KeeperScope = 'usage:push' | 'metadata:push' | 'identity:test';
const KEEPER_SCOPES: readonly string[] = ['usage:push', 'metadata:push', 'identity:test'];

export interface InstanceRef {
  instanceId: string;
  displayName: string;
}

export interface IdentityResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  instance: InstanceRef;
  credential: { credentialId: string; scopes: KeeperScope[] };
  serverTime: string;
}

export interface InstanceRegistrationResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  instance: InstanceRef & { enabled: boolean; createdAt: string; updatedAt: string };
  credential: {
    credentialId: string;
    name: string;
    scopes: KeeperScope[];
    /** One-time disclosed raw token. Never persist beyond the registration flow. */
    token: string;
    createdAt: string;
    expiresAt: string | null;
  };
}

export interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_read_tokens: number;
  cache_read_tokens_present: boolean;
  cache_creation_tokens: number;
  total_tokens: number;
}

export interface UsagePayload {
  timestamp: string;
  latency_ms: number;
  ttft_ms: number | null;
  source: string;
  auth_index: string;
  client_ip: string | null;
  x_forwarded_for: string | null;
  user_agent: string | null;
  tokens: UsageTokens;
  failed: boolean;
  generate: boolean;
  fail: {
    status_code: number;
    code:
      | 'upstream_http_error'
      | 'upstream_timeout'
      | 'upstream_transport_error'
      | 'client_cancelled'
      | 'internal_error'
      | null;
  };
  accounting_version: number;
  token_breakdown: {
    input: number;
    cached: number;
    cache_read: number;
    cache_creation: number;
    reasoning: number;
    output: number;
  };
  provider: string;
  executor_type: string;
  model: string;
  alias: string;
  endpoint: string;
  auth_type: string;
  api_key_fingerprint: string | null;
  /** Correlation only; never a delivery/dedup key. */
  request_id: string;
  reasoning_effort: string;
  service_tier: string;
  response_service_tier: string | null;
  response_headers: Record<string, string[]> | null;
}

export interface UsageBatchRequest {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  streamId: string;
  events: Array<{ sequence: number; payload: UsagePayload }>;
}

export interface UsageAckResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  streamId: string;
  acknowledgedThrough: number;
  nextExpectedSequence: number;
  acceptedCount: number;
  replayedCount: number;
}

export type MetadataCategory = 'auth_files' | 'api_keys' | 'provider_identities';
const METADATA_CATEGORIES: readonly string[] = ['auth_files', 'api_keys', 'provider_identities'];

export interface AuthFileItem {
  authIndex: string;
  name: string;
  displayName: string;
  type: string;
  provider: string;
  prefix: string;
  priority: number | null;
  disabled: boolean | null;
  note: string | null;
  accountId: string | null;
  projectId: string | null;
  xaiUserId: string | null;
  activeStart: string | null;
  activeUntil: string | null;
  planType: string | null;
}

export interface ApiKeyItem {
  fingerprint: string;
  displayKey: string;
  alias: string;
}

export interface ProviderIdentityItem {
  authIndex: string;
  providerType: string;
  displayName: string;
  prefix: string;
  baseUrl: string | null;
  priority: number | null;
  disabled: boolean | null;
  note: string | null;
  apiKeyFingerprint: string | null;
}

export interface MetadataSnapshotRequest {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  revision: number;
  complete: true;
  generatedAt: string;
  items: Array<AuthFileItem | ApiKeyItem | ProviderIdentityItem>;
}

export interface MetadataResultResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  category: MetadataCategory;
  revision: number;
  applied: boolean;
  itemCount: number;
  serverTime: string;
}

export interface UsageExportSettings {
  enabled: boolean;
  mode: 'disabled' | 'push';
  keeper: {
    url: string;
    tokenEnv: string;
    caFile: string | null;
    clientCertFile: string | null;
    clientKeyFile: string | null;
  };
  outbox: { path: string; maxBytes: number };
  delivery: {
    maxBatchEvents: number;
    maxBatchBytes: number;
    flushIntervalMs: number;
    requestTimeoutMs: number;
    initialBackoffMs: number;
    maxBackoffMs: number;
  };
  metadata: { enabled: boolean; intervalMs: number; categories: MetadataCategory[] };
  privacy: { includeClientIp: boolean; includeForwardedFor: boolean; includeUserAgent: boolean };
}

export type UsageExportSettingsResponse = {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  settings: UsageExportSettings & { keeper: { tokenConfigured: boolean } };
};

export interface UsageExportSettingsPutBody {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  settings: UsageExportSettings;
}

export interface ConnectionTestResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  ok: true;
  instance: InstanceRef;
  credentialScopes: KeeperScope[];
  latencyMs: number;
  testedAt: string;
}

export type UsageExportState =
  | 'disabled'
  | 'starting'
  | 'connected'
  | 'retrying'
  | 'degraded'
  | 'blocked';

export interface UsageExportStatusResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  state: UsageExportState;
  enabled: boolean;
  tokenConfigured: boolean;
  instance: InstanceRef | null;
  streamId: string | null;
  nextSequence: number | null;
  acknowledgedThrough: number | null;
  nextExpectedSequence: number | null;
  backlogEvents: number;
  backlogBytes: number;
  oldestBacklogAt: string | null;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextRetryAt: string | null;
  metadataRevisions: Record<MetadataCategory, number>;
  lastError: { code: KeeperErrorCode; message: string; retryable: boolean; at: string } | null;
}

export interface ProtocolErrorResponse {
  protocolVersion: typeof KEEPER_EXPORT_PROTOCOL_VERSION;
  error: { code: KeeperErrorCode; message: string; retryable: boolean };
}

export interface FingerprintVectors {
  fingerprintSecretHex: string;
  vectors: Array<{ rawKeyUtf8: string; fingerprint: string | null }>;
}

export interface CreateInstanceRequest {
  displayName: string;
  credential: { name: string; scopes: KeeperScope[] };
}

/* --------------------------------------------------------------------------
 * Decoders.
 * ------------------------------------------------------------------------ */

const parseRootObject = (text: string): ObjectEntries => {
  const root = parseStrict(text);
  if (root.kind !== 'object') return fail('invalid_json', 'top-level JSON value must be an object');
  return root.entries;
};

/**
 * Request-side root: same invalid_json top-level-object rule as the response
 * decoders and both Go reference decoders (spec 2.1), plus the
 * body_instance_forbidden scan. The object check runs first, so a non-object
 * top level can never surface as invalid_field or body_instance_forbidden.
 */
const parseRequestRootObject = (text: string): ObjectEntries => {
  const root = parseStrict(text);
  if (root.kind !== 'object') return fail('invalid_json', 'top-level JSON value must be an object');
  rejectBodyInstanceSelector(root);
  return root.entries;
};

const decodeScopes = (node: JsonNode, path: string): KeeperScope[] => {
  const items = asArray(node, path);
  if (items.length < 1 || items.length > 3) fail('invalid_field', `${path} must have 1..3 scopes`);
  const scopes = items.map((item, i) =>
    asString(item, `${path}[${i}]`, { maxBytes: 64, enum: KEEPER_SCOPES, tight: true })
  );
  if (new Set(scopes).size !== scopes.length) fail('invalid_field', `${path} has duplicate scopes`);
  return scopes as KeeperScope[];
};

const decodeInstanceRef = (node: JsonNode, path: string): InstanceRef => {
  const entries = asObject(node, path);
  expectKeys(entries, ['instanceId', 'displayName'], path);
  return {
    instanceId: asUuidV7(required(entries, 'instanceId', path), `${path}.instanceId`),
    displayName: asString(required(entries, 'displayName', path), `${path}.displayName`, {
      minBytes: 1,
      maxBytes: 128,
      tight: true,
    }),
  };
};

export function decodeIdentityResponse(text: string): IdentityResponse {
  const root = parseRootObject(text);
  expectKeys(root, ['protocolVersion', 'instance', 'credential', 'serverTime'], '$');
  checkProtocolVersion(root, '$');
  const credential = asObject(required(root, 'credential', '$'), '$.credential');
  expectKeys(credential, ['credentialId', 'scopes'], '$.credential');
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    instance: decodeInstanceRef(required(root, 'instance', '$'), '$.instance'),
    credential: {
      credentialId: asUuidV7(
        required(credential, 'credentialId', '$.credential'),
        '$.credential.credentialId'
      ),
      scopes: decodeScopes(required(credential, 'scopes', '$.credential'), '$.credential.scopes'),
    },
    serverTime: asTimestamp(required(root, 'serverTime', '$'), '$.serverTime'),
  };
}

export function decodeInstanceRegistrationResponse(text: string): InstanceRegistrationResponse {
  const root = parseRootObject(text);
  expectKeys(root, ['protocolVersion', 'instance', 'credential'], '$');
  checkProtocolVersion(root, '$');

  const instance = asObject(required(root, 'instance', '$'), '$.instance');
  expectKeys(
    instance,
    ['instanceId', 'displayName', 'enabled', 'createdAt', 'updatedAt'],
    '$.instance'
  );

  const credential = asObject(required(root, 'credential', '$'), '$.credential');
  // `token` is allowed exactly here: one-time disclosure of a reusable credential.
  expectKeys(
    credential,
    ['credentialId', 'name', 'scopes', 'token', 'createdAt', 'expiresAt'],
    '$.credential'
  );
  const expiresAt = required(credential, 'expiresAt', '$.credential');

  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    instance: {
      instanceId: asUuidV7(required(instance, 'instanceId', '$.instance'), '$.instance.instanceId'),
      displayName: asString(
        required(instance, 'displayName', '$.instance'),
        '$.instance.displayName',
        { minBytes: 1, maxBytes: 128, tight: true }
      ),
      enabled: asBoolean(required(instance, 'enabled', '$.instance'), '$.instance.enabled'),
      createdAt: asTimestamp(required(instance, 'createdAt', '$.instance'), '$.instance.createdAt'),
      updatedAt: asTimestamp(required(instance, 'updatedAt', '$.instance'), '$.instance.updatedAt'),
    },
    credential: {
      credentialId: asUuidV7(
        required(credential, 'credentialId', '$.credential'),
        '$.credential.credentialId'
      ),
      name: asString(required(credential, 'name', '$.credential'), '$.credential.name', {
        minBytes: 1,
        maxBytes: 128,
        tight: true,
      }),
      scopes: decodeScopes(required(credential, 'scopes', '$.credential'), '$.credential.scopes'),
      token: asString(required(credential, 'token', '$.credential'), '$.credential.token', {
        minBytes: 1,
        maxBytes: 2048,
      }),
      createdAt: asTimestamp(
        required(credential, 'createdAt', '$.credential'),
        '$.credential.createdAt'
      ),
      expiresAt: isNull(expiresAt) ? null : asTimestamp(expiresAt, '$.credential.expiresAt'),
    },
  };
}

const USAGE_PAYLOAD_KEYS = [
  'timestamp',
  'latency_ms',
  'ttft_ms',
  'source',
  'auth_index',
  'client_ip',
  'x_forwarded_for',
  'user_agent',
  'tokens',
  'failed',
  'generate',
  'fail',
  'accounting_version',
  'token_breakdown',
  'provider',
  'executor_type',
  'model',
  'alias',
  'endpoint',
  'auth_type',
  'api_key_fingerprint',
  'request_id',
  'reasoning_effort',
  'service_tier',
  'response_service_tier',
  'response_headers',
] as const;

const ALLOWED_RESPONSE_HEADERS: ReadonlySet<string> = new Set([
  'x-codex-primary-used-percent',
  'x-codex-primary-window-minutes',
  'x-codex-primary-reset-after-seconds',
  'x-codex-secondary-used-percent',
  'x-codex-secondary-window-minutes',
  'x-codex-secondary-reset-after-seconds',
]);

const FAIL_CODES = [
  'upstream_http_error',
  'upstream_timeout',
  'upstream_transport_error',
  'client_cancelled',
  'internal_error',
] as const;

const decodeUsagePayload = (node: JsonNode, path: string): UsagePayload => {
  const entries = asObject(node, path);
  expectKeys(entries, USAGE_PAYLOAD_KEYS, path);

  const tokens = asObject(required(entries, 'tokens', path), `${path}.tokens`);
  expectKeys(
    tokens,
    [
      'input_tokens',
      'output_tokens',
      'reasoning_tokens',
      'cached_tokens',
      'cache_read_tokens',
      'cache_read_tokens_present',
      'cache_creation_tokens',
      'total_tokens',
    ],
    `${path}.tokens`
  );
  const tokenInt = (key: string): number =>
    asInteger(required(tokens, key, `${path}.tokens`), `${path}.tokens.${key}`, 0, SAFE_INTEGER_MAX);

  const failNode = asObject(required(entries, 'fail', path), `${path}.fail`);
  expectKeys(failNode, ['status_code', 'code'], `${path}.fail`);
  const failCode = required(failNode, 'code', `${path}.fail`);

  const breakdown = asObject(
    required(entries, 'token_breakdown', path),
    `${path}.token_breakdown`
  );
  expectKeys(
    breakdown,
    ['input', 'cached', 'cache_read', 'cache_creation', 'reasoning', 'output'],
    `${path}.token_breakdown`
  );
  const breakdownInt = (key: string): number =>
    asInteger(
      required(breakdown, key, `${path}.token_breakdown`),
      `${path}.token_breakdown.${key}`,
      0,
      SAFE_INTEGER_MAX
    );

  const nullableString = (
    key: string,
    rule: StringRule
  ): string | null => {
    const child = required(entries, key, path);
    return isNull(child) ? null : asString(child, `${path}.${key}`, rule);
  };

  const headersNode = required(entries, 'response_headers', path);
  let responseHeaders: Record<string, string[]> | null = null;
  if (!isNull(headersNode)) {
    const headers = asObject(headersNode, `${path}.response_headers`);
    responseHeaders = {};
    for (const [key, value] of headers) {
      if (!ALLOWED_RESPONSE_HEADERS.has(key)) {
        fail('invalid_field', `${path}.response_headers.${key} is not an allowed header`);
      }
      const values = asArray(value, `${path}.response_headers.${key}`);
      if (values.length < 1 || values.length > 4) {
        fail('invalid_field', `${path}.response_headers.${key} must have 1..4 values`);
      }
      responseHeaders[key] = values.map((item, i) =>
        asString(item, `${path}.response_headers.${key}[${i}]`, { minBytes: 1, maxBytes: 64 })
      );
    }
  }

  const fingerprintNode = required(entries, 'api_key_fingerprint', path);
  const ttftNode = required(entries, 'ttft_ms', path);
  const responseTierNode = required(entries, 'response_service_tier', path);

  return {
    timestamp: asTimestamp(required(entries, 'timestamp', path), `${path}.timestamp`),
    latency_ms: asInteger(required(entries, 'latency_ms', path), `${path}.latency_ms`, 0, 86400000),
    ttft_ms: isNull(ttftNode)
      ? null
      : asInteger(ttftNode, `${path}.ttft_ms`, 0, 86400000),
    source: asString(required(entries, 'source', path), `${path}.source`, { maxBytes: 128 }),
    auth_index: asString(required(entries, 'auth_index', path), `${path}.auth_index`, {
      maxBytes: 256,
    }),
    client_ip: nullableString('client_ip', { minBytes: 1, maxBytes: 64 }),
    x_forwarded_for: nullableString('x_forwarded_for', { minBytes: 1, maxBytes: 512 }),
    user_agent: nullableString('user_agent', { minBytes: 1, maxBytes: 1024 }),
    tokens: {
      input_tokens: tokenInt('input_tokens'),
      output_tokens: tokenInt('output_tokens'),
      reasoning_tokens: tokenInt('reasoning_tokens'),
      cached_tokens: tokenInt('cached_tokens'),
      cache_read_tokens: tokenInt('cache_read_tokens'),
      cache_read_tokens_present: asBoolean(
        required(tokens, 'cache_read_tokens_present', `${path}.tokens`),
        `${path}.tokens.cache_read_tokens_present`
      ),
      cache_creation_tokens: tokenInt('cache_creation_tokens'),
      total_tokens: tokenInt('total_tokens'),
    },
    failed: asBoolean(required(entries, 'failed', path), `${path}.failed`),
    generate: asBoolean(required(entries, 'generate', path), `${path}.generate`),
    fail: {
      status_code: asInteger(
        required(failNode, 'status_code', `${path}.fail`),
        `${path}.fail.status_code`,
        0,
        599
      ),
      code: isNull(failCode)
        ? null
        : (asString(failCode, `${path}.fail.code`, {
            maxBytes: 64,
            enum: FAIL_CODES,
            tight: true,
          }) as UsagePayload['fail']['code']),
    },
    accounting_version: asInteger(
      required(entries, 'accounting_version', path),
      `${path}.accounting_version`,
      1,
      2147483647
    ),
    token_breakdown: {
      input: breakdownInt('input'),
      cached: breakdownInt('cached'),
      cache_read: breakdownInt('cache_read'),
      cache_creation: breakdownInt('cache_creation'),
      reasoning: breakdownInt('reasoning'),
      output: breakdownInt('output'),
    },
    provider: asString(required(entries, 'provider', path), `${path}.provider`, {
      minBytes: 1,
      maxBytes: 128,
      tight: true,
    }),
    executor_type: asString(required(entries, 'executor_type', path), `${path}.executor_type`, {
      minBytes: 1,
      maxBytes: 128,
      tight: true,
    }),
    model: asString(required(entries, 'model', path), `${path}.model`, {
      minBytes: 1,
      maxBytes: 128,
    }),
    alias: asString(required(entries, 'alias', path), `${path}.alias`, {
      minBytes: 1,
      maxBytes: 128,
    }),
    endpoint: asString(required(entries, 'endpoint', path), `${path}.endpoint`, {
      minBytes: 1,
      maxBytes: 512,
      tight: true,
    }),
    auth_type: asString(required(entries, 'auth_type', path), `${path}.auth_type`, {
      minBytes: 1,
      maxBytes: 128,
      tight: true,
    }),
    api_key_fingerprint: isNull(fingerprintNode)
      ? null
      : asFingerprint(fingerprintNode, `${path}.api_key_fingerprint`),
    request_id: asString(required(entries, 'request_id', path), `${path}.request_id`, {
      minBytes: 1,
      maxBytes: 256,
    }),
    reasoning_effort: asString(
      required(entries, 'reasoning_effort', path),
      `${path}.reasoning_effort`,
      { maxBytes: 64 }
    ),
    service_tier: asString(required(entries, 'service_tier', path), `${path}.service_tier`, {
      maxBytes: 64,
    }),
    response_service_tier: isNull(responseTierNode)
      ? null
      : asString(responseTierNode, `${path}.response_service_tier`, { minBytes: 1, maxBytes: 64 }),
    response_headers: responseHeaders,
  };
};

const MAX_BATCH_EVENTS = 500;
const MAX_PAYLOAD_BYTES = 65536;

export function decodeUsageBatchRequest(text: string): UsageBatchRequest {
  const rootEntries = parseRequestRootObject(text);
  checkProtocolVersion(rootEntries, '$');
  expectKeys(rootEntries, ['protocolVersion', 'streamId', 'events'], '$');

  const events = asArray(required(rootEntries, 'events', '$'), '$.events');
  if (events.length < 1) {
    // Empty batch is a payload-layer cardinality violation: 400 invalid_field
    // (spec sections 6.1 and 9); only >500 events is 422 batch_limit_exceeded.
    fail('invalid_field', '$.events must contain at least one event');
  }
  if (events.length > MAX_BATCH_EVENTS) {
    fail('batch_limit_exceeded', 'usage batch exceeds the event count limit');
  }

  let previousSequence = 0;
  const decoded = events.map((eventNode, index) => {
    const path = `$.events[${index}]`;
    const event = asObject(eventNode, path);
    expectKeys(event, ['sequence', 'payload'], path);
    const sequence = asInteger(
      required(event, 'sequence', path),
      `${path}.sequence`,
      1,
      SAFE_INTEGER_MAX
    );
    if (sequence <= previousSequence) {
      fail('invalid_sequence_order', 'event sequences must be strictly increasing');
    }
    previousSequence = sequence;

    const payloadNode = required(event, 'payload', path);
    // Raw received payload bytes are checked before field-level validation so
    // an oversized payload reports batch_limit_exceeded (spec section 11 #22).
    const rawPayload = text.slice(payloadNode.start, payloadNode.end);
    if (byteLength(rawPayload) > MAX_PAYLOAD_BYTES) {
      fail('batch_limit_exceeded', 'usage event payload exceeds the byte limit');
    }
    return { sequence, payload: decodeUsagePayload(payloadNode, `${path}.payload`) };
  });

  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    streamId: asUuidV7(required(rootEntries, 'streamId', '$'), '$.streamId'),
    events: decoded,
  };
}

export function decodeUsageAckResponse(text: string): UsageAckResponse {
  const root = parseRootObject(text);
  expectKeys(
    root,
    [
      'protocolVersion',
      'streamId',
      'acknowledgedThrough',
      'nextExpectedSequence',
      'acceptedCount',
      'replayedCount',
    ],
    '$'
  );
  checkProtocolVersion(root, '$');
  const acknowledgedThrough = asInteger(
    required(root, 'acknowledgedThrough', '$'),
    '$.acknowledgedThrough',
    0,
    SAFE_INTEGER_MAX
  );
  const nextExpectedSequence = asInteger(
    required(root, 'nextExpectedSequence', '$'),
    '$.nextExpectedSequence',
    1,
    SAFE_INTEGER_MAX
  );
  if (nextExpectedSequence !== acknowledgedThrough + 1) {
    fail('keeper_invalid_response', 'ACK invariant nextExpectedSequence != acknowledgedThrough + 1');
  }
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    streamId: asUuidV7(required(root, 'streamId', '$'), '$.streamId'),
    acknowledgedThrough,
    nextExpectedSequence,
    acceptedCount: asInteger(required(root, 'acceptedCount', '$'), '$.acceptedCount', 0, SAFE_INTEGER_MAX),
    replayedCount: asInteger(required(root, 'replayedCount', '$'), '$.replayedCount', 0, SAFE_INTEGER_MAX),
  };
}

const decodeAuthFileItem = (node: JsonNode, path: string): AuthFileItem => {
  const entries = asObject(node, path);
  expectKeys(
    entries,
    [
      'authIndex',
      'name',
      'displayName',
      'type',
      'provider',
      'prefix',
      'priority',
      'disabled',
      'note',
      'accountId',
      'projectId',
      'xaiUserId',
      'activeStart',
      'activeUntil',
      'planType',
    ],
    path
  );
  const str = (key: string, rule: StringRule): string =>
    asString(required(entries, key, path), `${path}.${key}`, rule);
  const nullableStr = (key: string, rule: StringRule): string | null => {
    const child = required(entries, key, path);
    return isNull(child) ? null : asString(child, `${path}.${key}`, rule);
  };
  const priority = required(entries, 'priority', path);
  const disabled = required(entries, 'disabled', path);
  const activeStart = required(entries, 'activeStart', path);
  const activeUntil = required(entries, 'activeUntil', path);
  return {
    authIndex: str('authIndex', { minBytes: 1, maxBytes: 256, tight: true }),
    name: str('name', { maxBytes: 256 }),
    displayName: str('displayName', { maxBytes: 256 }),
    type: str('type', { maxBytes: 128 }),
    provider: str('provider', { maxBytes: 256 }),
    prefix: str('prefix', { maxBytes: 256 }),
    priority: isNull(priority) ? null : asInteger(priority, `${path}.priority`, -1000000, 1000000),
    disabled: isNull(disabled) ? null : asBoolean(disabled, `${path}.disabled`),
    note: nullableStr('note', { maxBytes: 1024 }),
    accountId: nullableStr('accountId', { minBytes: 1, maxBytes: 256 }),
    projectId: nullableStr('projectId', { minBytes: 1, maxBytes: 256 }),
    xaiUserId: nullableStr('xaiUserId', { minBytes: 1, maxBytes: 256 }),
    activeStart: isNull(activeStart) ? null : asTimestamp(activeStart, `${path}.activeStart`),
    activeUntil: isNull(activeUntil) ? null : asTimestamp(activeUntil, `${path}.activeUntil`),
    planType: nullableStr('planType', { minBytes: 1, maxBytes: 256 }),
  };
};

const decodeApiKeyItem = (node: JsonNode, path: string): ApiKeyItem => {
  const entries = asObject(node, path);
  expectKeys(entries, ['fingerprint', 'displayKey', 'alias'], path);
  return {
    fingerprint: asFingerprint(required(entries, 'fingerprint', path), `${path}.fingerprint`),
    displayKey: asString(required(entries, 'displayKey', path), `${path}.displayKey`, {
      minBytes: 1,
      maxBytes: 128,
    }),
    alias: asString(required(entries, 'alias', path), `${path}.alias`, { maxBytes: 256 }),
  };
};

const decodeProviderIdentityItem = (node: JsonNode, path: string): ProviderIdentityItem => {
  const entries = asObject(node, path);
  expectKeys(
    entries,
    [
      'authIndex',
      'providerType',
      'displayName',
      'prefix',
      'baseUrl',
      'priority',
      'disabled',
      'note',
      'apiKeyFingerprint',
    ],
    path
  );
  const str = (key: string, rule: StringRule): string =>
    asString(required(entries, key, path), `${path}.${key}`, rule);
  const baseUrl = required(entries, 'baseUrl', path);
  const priority = required(entries, 'priority', path);
  const disabled = required(entries, 'disabled', path);
  const note = required(entries, 'note', path);
  const fingerprint = required(entries, 'apiKeyFingerprint', path);
  return {
    authIndex: str('authIndex', { minBytes: 1, maxBytes: 256, tight: true }),
    providerType: str('providerType', { minBytes: 1, maxBytes: 128, tight: true }),
    displayName: str('displayName', { maxBytes: 256 }),
    prefix: str('prefix', { maxBytes: 256 }),
    baseUrl: isNull(baseUrl) ? null : asHttpsUrl(baseUrl, `${path}.baseUrl`, 'invalid_field'),
    priority: isNull(priority) ? null : asInteger(priority, `${path}.priority`, -1000000, 1000000),
    disabled: isNull(disabled) ? null : asBoolean(disabled, `${path}.disabled`),
    note: isNull(note) ? null : asString(note, `${path}.note`, { maxBytes: 1024 }),
    apiKeyFingerprint: isNull(fingerprint)
      ? null
      : asFingerprint(fingerprint, `${path}.apiKeyFingerprint`),
  };
};

/** Absolute HTTPS URL: no userinfo, query, or fragment (spec sections 7.4, 8.1). */
const asHttpsUrl = (node: JsonNode, path: string, code: KeeperErrorCode): string => {
  if (node.kind !== 'string') return fail(code, `${path} must be a URL string`);
  const value = node.value;
  if (CONTROL_CHARS.test(value) || value !== value.trim() || byteLength(value) > 2048) {
    fail(code, `${path} is not a valid URL`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return fail(code, `${path} is not a valid URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    fail(code, `${path} must be an HTTPS URL without userinfo, query, or fragment`);
  }
  return value;
};

export function decodeMetadataSnapshotRequest(
  text: string,
  category: MetadataCategory
): MetadataSnapshotRequest {
  const rootEntries = parseRequestRootObject(text);
  checkProtocolVersion(rootEntries, '$');
  expectKeys(rootEntries, ['protocolVersion', 'revision', 'complete', 'generatedAt', 'items'], '$');

  const completeNode = required(rootEntries, 'complete', '$');
  if (completeNode.kind !== 'boolean' || completeNode.value !== true) {
    fail('incomplete_snapshot', 'metadata snapshot must be complete');
  }

  const items = asArray(required(rootEntries, 'items', '$'), '$.items');
  if (items.length > 5000) {
    fail('batch_limit_exceeded', '$.items exceeds the maximum item count');
  }

  const decodeItem =
    category === 'auth_files'
      ? decodeAuthFileItem
      : category === 'api_keys'
        ? decodeApiKeyItem
        : decodeProviderIdentityItem;
  const decoded = items.map((item, index) => decodeItem(item, `$.items[${index}]`));

  const identityOf = (item: AuthFileItem | ApiKeyItem | ProviderIdentityItem): string => {
    if (category === 'auth_files') return (item as AuthFileItem).authIndex;
    if (category === 'api_keys') return (item as ApiKeyItem).fingerprint;
    const provider = item as ProviderIdentityItem;
    return `${provider.providerType}${provider.authIndex}`;
  };
  const seen = new Set<string>();
  for (const item of decoded) {
    const identity = identityOf(item);
    if (seen.has(identity)) {
      fail('duplicate_metadata_identity', 'metadata snapshot contains a duplicate identity');
    }
    seen.add(identity);
  }

  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    revision: asInteger(required(rootEntries, 'revision', '$'), '$.revision', 1, SAFE_INTEGER_MAX),
    complete: true,
    generatedAt: asTimestamp(required(rootEntries, 'generatedAt', '$'), '$.generatedAt'),
    items: decoded,
  };
}

/**
 * Revision state evaluation for a complete snapshot (spec section 7.1).
 * Digests are SHA-256 hex over the exact UTF-8 request-body bytes.
 */
export function evaluateMetadataRevision(
  request: { revision: number; digestHex: string },
  current: { currentRevision: number; currentDigestHex: string }
): { applied: boolean } {
  if (request.revision > current.currentRevision) return { applied: true };
  if (request.revision < current.currentRevision) {
    fail('stale_revision', 'metadata revision is older than the current revision');
  }
  if (request.digestHex !== current.currentDigestHex) {
    fail('conflicting_revision', 'metadata revision was previously accepted with different content');
  }
  return { applied: false };
}

export function decodeMetadataResultResponse(text: string): MetadataResultResponse {
  const root = parseRootObject(text);
  expectKeys(
    root,
    ['protocolVersion', 'category', 'revision', 'applied', 'itemCount', 'serverTime'],
    '$'
  );
  checkProtocolVersion(root, '$');
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    category: asString(required(root, 'category', '$'), '$.category', {
      maxBytes: 64,
      enum: METADATA_CATEGORIES,
      tight: true,
    }) as MetadataCategory,
    revision: asInteger(required(root, 'revision', '$'), '$.revision', 1, SAFE_INTEGER_MAX),
    applied: asBoolean(required(root, 'applied', '$'), '$.applied'),
    itemCount: asInteger(required(root, 'itemCount', '$'), '$.itemCount', 0, SAFE_INTEGER_MAX),
    serverTime: asTimestamp(required(root, 'serverTime', '$'), '$.serverTime'),
  };
}

/* --------------------------------------------------------------------------
 * CPA management settings/test/status contracts (spec section 8).
 * ------------------------------------------------------------------------ */

const SETTINGS_LIMITS = {
  outboxMaxBytesMin: 16 * 1024 * 1024,
  outboxMaxBytesMax: 1024 * 1024 * 1024 * 1024,
} as const;

const invalidSettings = (detail: string): never => fail('invalid_settings', detail);

const asAbsolutePathOrNull = (node: JsonNode, path: string): string | null => {
  if (isNull(node)) return null;
  const value = asString(node, path, { minBytes: 1, maxBytes: 4096, tight: true });
  if (!value.startsWith('/')) invalidSettings(`${path} must be an absolute path`);
  return value;
};

const decodeSettingsObject = (
  node: JsonNode,
  path: string,
  mode: 'response' | 'put'
): UsageExportSettings | UsageExportSettingsResponse['settings'] => {
  const entries = asObject(node, path);
  expectKeys(entries, ['enabled', 'mode', 'keeper', 'outbox', 'delivery', 'metadata', 'privacy'], path);

  const keeper = asObject(required(entries, 'keeper', path), `${path}.keeper`);
  // `token` is never accepted; `tokenConfigured` is response-only (rejected in PUT).
  expectKeys(
    keeper,
    mode === 'response'
      ? ['url', 'tokenEnv', 'tokenConfigured', 'caFile', 'clientCertFile', 'clientKeyFile']
      : ['url', 'tokenEnv', 'caFile', 'clientCertFile', 'clientKeyFile'],
    `${path}.keeper`
  );

  const outbox = asObject(required(entries, 'outbox', path), `${path}.outbox`);
  expectKeys(outbox, ['path', 'maxBytes'], `${path}.outbox`);

  const delivery = asObject(required(entries, 'delivery', path), `${path}.delivery`);
  expectKeys(
    delivery,
    [
      'maxBatchEvents',
      'maxBatchBytes',
      'flushIntervalMs',
      'requestTimeoutMs',
      'initialBackoffMs',
      'maxBackoffMs',
    ],
    `${path}.delivery`
  );

  const metadata = asObject(required(entries, 'metadata', path), `${path}.metadata`);
  expectKeys(metadata, ['enabled', 'intervalMs', 'categories'], `${path}.metadata`);

  const privacy = asObject(required(entries, 'privacy', path), `${path}.privacy`);
  expectKeys(
    privacy,
    ['includeClientIp', 'includeForwardedFor', 'includeUserAgent'],
    `${path}.privacy`
  );

  const enabled = asBoolean(required(entries, 'enabled', path), `${path}.enabled`);
  const modeValue = asString(required(entries, 'mode', path), `${path}.mode`, {
    maxBytes: 16,
    enum: ['disabled', 'push'],
    tight: true,
  }) as UsageExportSettings['mode'];

  const caFile = asAbsolutePathOrNull(required(keeper, 'caFile', `${path}.keeper`), `${path}.keeper.caFile`);
  const clientCertFile = asAbsolutePathOrNull(
    required(keeper, 'clientCertFile', `${path}.keeper`),
    `${path}.keeper.clientCertFile`
  );
  const clientKeyFile = asAbsolutePathOrNull(
    required(keeper, 'clientKeyFile', `${path}.keeper`),
    `${path}.keeper.clientKeyFile`
  );
  if ((clientCertFile === null) !== (clientKeyFile === null)) {
    invalidSettings(`${path}.keeper client certificate and key must be both null or both set`);
  }

  const settings: UsageExportSettings = {
    enabled,
    mode: modeValue,
    keeper: {
      url: asString(required(keeper, 'url', `${path}.keeper`), `${path}.keeper.url`, {
        maxBytes: 2048,
        tight: true,
      }),
      tokenEnv: asString(
        required(keeper, 'tokenEnv', `${path}.keeper`),
        `${path}.keeper.tokenEnv`,
        { maxBytes: 128, tight: true }
      ),
      caFile,
      clientCertFile,
      clientKeyFile,
    },
    outbox: {
      path: asString(required(outbox, 'path', `${path}.outbox`), `${path}.outbox.path`, {
        minBytes: 1,
        maxBytes: 4096,
        tight: true,
      }),
      maxBytes: asInteger(
        required(outbox, 'maxBytes', `${path}.outbox`),
        `${path}.outbox.maxBytes`,
        1,
        SAFE_INTEGER_MAX
      ),
    },
    delivery: {
      maxBatchEvents: asInteger(
        required(delivery, 'maxBatchEvents', `${path}.delivery`),
        `${path}.delivery.maxBatchEvents`,
        1,
        MAX_BATCH_EVENTS
      ),
      maxBatchBytes: asInteger(
        required(delivery, 'maxBatchBytes', `${path}.delivery`),
        `${path}.delivery.maxBatchBytes`,
        65536,
        1048576
      ),
      flushIntervalMs: asInteger(
        required(delivery, 'flushIntervalMs', `${path}.delivery`),
        `${path}.delivery.flushIntervalMs`,
        100,
        60000
      ),
      requestTimeoutMs: asInteger(
        required(delivery, 'requestTimeoutMs', `${path}.delivery`),
        `${path}.delivery.requestTimeoutMs`,
        1000,
        120000
      ),
      initialBackoffMs: asInteger(
        required(delivery, 'initialBackoffMs', `${path}.delivery`),
        `${path}.delivery.initialBackoffMs`,
        100,
        60000
      ),
      maxBackoffMs: asInteger(
        required(delivery, 'maxBackoffMs', `${path}.delivery`),
        `${path}.delivery.maxBackoffMs`,
        1,
        900000
      ),
    },
    metadata: {
      enabled: asBoolean(required(metadata, 'enabled', `${path}.metadata`), `${path}.metadata.enabled`),
      intervalMs: asInteger(
        required(metadata, 'intervalMs', `${path}.metadata`),
        `${path}.metadata.intervalMs`,
        60000,
        86400000
      ),
      categories: asArray(required(metadata, 'categories', `${path}.metadata`), `${path}.metadata.categories`).map(
        (item, i) =>
          asString(item, `${path}.metadata.categories[${i}]`, {
            maxBytes: 64,
            enum: METADATA_CATEGORIES,
            tight: true,
          }) as MetadataCategory
      ),
    },
    privacy: {
      includeClientIp: asBoolean(
        required(privacy, 'includeClientIp', `${path}.privacy`),
        `${path}.privacy.includeClientIp`
      ),
      includeForwardedFor: asBoolean(
        required(privacy, 'includeForwardedFor', `${path}.privacy`),
        `${path}.privacy.includeForwardedFor`
      ),
      includeUserAgent: asBoolean(
        required(privacy, 'includeUserAgent', `${path}.privacy`),
        `${path}.privacy.includeUserAgent`
      ),
    },
  };

  validateSettingsSemantics(settings, path);

  if (mode === 'response') {
    return {
      ...settings,
      keeper: {
        ...settings.keeper,
        tokenConfigured: asBoolean(
          required(keeper, 'tokenConfigured', `${path}.keeper`),
          `${path}.keeper.tokenConfigured`
        ),
      },
    };
  }
  return settings;
};

const validateSettingsSemantics = (settings: UsageExportSettings, path: string): void => {
  if (settings.enabled !== (settings.mode === 'push')) {
    invalidSettings(`${path}: enabled/mode combination is not supported`);
  }

  const categories = settings.metadata.categories;
  if (new Set(categories).size !== categories.length) {
    invalidSettings(`${path}.metadata.categories contains duplicates`);
  }
  if (settings.metadata.enabled) {
    if (categories.length === 0) {
      invalidSettings(`${path}.metadata.categories must be nonempty when metadata is enabled`);
    }
    const canonical = METADATA_CATEGORIES.filter((category) => categories.includes(category as MetadataCategory));
    if (canonical.length !== categories.length || canonical.some((c, i) => c !== categories[i])) {
      invalidSettings(`${path}.metadata.categories must be in canonical order`);
    }
  }

  const { delivery, outbox } = settings;
  if (delivery.maxBackoffMs < delivery.initialBackoffMs) {
    invalidSettings(`${path}.delivery.maxBackoffMs must be >= initialBackoffMs`);
  }
  if (
    outbox.maxBytes < SETTINGS_LIMITS.outboxMaxBytesMin ||
    outbox.maxBytes > SETTINGS_LIMITS.outboxMaxBytesMax
  ) {
    invalidSettings(`${path}.outbox.maxBytes is out of range`);
  }

  if (!settings.enabled) return;

  // Push mode requirements (spec section 8.1).
  const urlNode: JsonNode = { kind: 'string', value: settings.keeper.url, start: 0, end: 0 };
  asHttpsUrl(urlNode, `${path}.keeper.url`, 'invalid_settings');
  if (!ENV_NAME.test(settings.keeper.tokenEnv)) {
    invalidSettings(`${path}.keeper.tokenEnv is not a valid environment variable name`);
  }
  if (!outbox.path.startsWith('/')) {
    invalidSettings(`${path}.outbox.path must be an absolute path`);
  }
};

export function decodeUsageExportSettingsResponse(text: string): UsageExportSettingsResponse {
  const root = parseRootObject(text);
  expectKeys(root, ['protocolVersion', 'settings'], '$');
  checkProtocolVersion(root, '$');
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    settings: decodeSettingsObject(
      required(root, 'settings', '$'),
      '$.settings',
      'response'
    ) as UsageExportSettingsResponse['settings'],
  };
}

export function decodeUsageExportSettingsPutBody(text: string): UsageExportSettingsPutBody {
  const rootEntries = parseRequestRootObject(text);
  checkProtocolVersion(rootEntries, '$');
  expectKeys(rootEntries, ['protocolVersion', 'settings'], '$');
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    settings: decodeSettingsObject(
      required(rootEntries, 'settings', '$'),
      '$.settings',
      'put'
    ) as UsageExportSettings,
  };
}

/**
 * Serialize a PUT body from typed settings. The `UsageExportSettings` type has
 * no `token` or `tokenConfigured` fields, so this structurally cannot emit
 * token material; the output round-trips through `decodeUsageExportSettingsPutBody`.
 */
export function buildUsageExportSettingsPutBody(settings: UsageExportSettings): string {
  return JSON.stringify(
    {
      protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
      settings: {
        enabled: settings.enabled,
        mode: settings.mode,
        keeper: {
          url: settings.keeper.url,
          tokenEnv: settings.keeper.tokenEnv,
          caFile: settings.keeper.caFile,
          clientCertFile: settings.keeper.clientCertFile,
          clientKeyFile: settings.keeper.clientKeyFile,
        },
        outbox: { path: settings.outbox.path, maxBytes: settings.outbox.maxBytes },
        delivery: {
          maxBatchEvents: settings.delivery.maxBatchEvents,
          maxBatchBytes: settings.delivery.maxBatchBytes,
          flushIntervalMs: settings.delivery.flushIntervalMs,
          requestTimeoutMs: settings.delivery.requestTimeoutMs,
          initialBackoffMs: settings.delivery.initialBackoffMs,
          maxBackoffMs: settings.delivery.maxBackoffMs,
        },
        metadata: {
          enabled: settings.metadata.enabled,
          intervalMs: settings.metadata.intervalMs,
          categories: [...settings.metadata.categories],
        },
        privacy: {
          includeClientIp: settings.privacy.includeClientIp,
          includeForwardedFor: settings.privacy.includeForwardedFor,
          includeUserAgent: settings.privacy.includeUserAgent,
        },
      },
    },
    null,
    2
  );
}

export function decodeConnectionTestResponse(text: string): ConnectionTestResponse {
  const root = parseRootObject(text);
  expectKeys(
    root,
    ['protocolVersion', 'ok', 'instance', 'credentialScopes', 'latencyMs', 'testedAt'],
    '$'
  );
  checkProtocolVersion(root, '$');
  const ok = required(root, 'ok', '$');
  if (ok.kind !== 'boolean' || ok.value !== true) {
    fail('invalid_field', '$.ok must be true; there is no ok:false success');
  }
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    ok: true,
    instance: decodeInstanceRef(required(root, 'instance', '$'), '$.instance'),
    credentialScopes: decodeScopes(required(root, 'credentialScopes', '$'), '$.credentialScopes'),
    latencyMs: asInteger(required(root, 'latencyMs', '$'), '$.latencyMs', 0, SAFE_INTEGER_MAX),
    testedAt: asTimestamp(required(root, 'testedAt', '$'), '$.testedAt'),
  };
}

const USAGE_EXPORT_STATES: readonly string[] = [
  'disabled',
  'starting',
  'connected',
  'retrying',
  'degraded',
  'blocked',
];

export function decodeUsageExportStatusResponse(text: string): UsageExportStatusResponse {
  const root = parseRootObject(text);
  // Strict key set: a `token` key (or any other unknown key) is rejected.
  expectKeys(
    root,
    [
      'protocolVersion',
      'state',
      'enabled',
      'tokenConfigured',
      'instance',
      'streamId',
      'nextSequence',
      'acknowledgedThrough',
      'nextExpectedSequence',
      'backlogEvents',
      'backlogBytes',
      'oldestBacklogAt',
      'lastAttemptAt',
      'lastSuccessAt',
      'nextRetryAt',
      'metadataRevisions',
      'lastError',
    ],
    '$'
  );
  checkProtocolVersion(root, '$');

  const nullableInt = (key: string, min: number): number | null => {
    const node = required(root, key, '$');
    return isNull(node) ? null : asInteger(node, `$.${key}`, min, SAFE_INTEGER_MAX);
  };
  const nullableTimestamp = (key: string): string | null => {
    const node = required(root, key, '$');
    return isNull(node) ? null : asTimestamp(node, `$.${key}`);
  };

  const instanceNode = required(root, 'instance', '$');
  const streamNode = required(root, 'streamId', '$');

  const revisions = asObject(required(root, 'metadataRevisions', '$'), '$.metadataRevisions');
  expectKeys(revisions, METADATA_CATEGORIES, '$.metadataRevisions');

  const lastErrorNode = required(root, 'lastError', '$');
  let lastError: UsageExportStatusResponse['lastError'] = null;
  if (!isNull(lastErrorNode)) {
    const errorEntries = asObject(lastErrorNode, '$.lastError');
    expectKeys(errorEntries, ['code', 'message', 'retryable', 'at'], '$.lastError');
    const code = asString(required(errorEntries, 'code', '$.lastError'), '$.lastError.code', {
      maxBytes: 64,
      tight: true,
    });
    if (!KEEPER_ERROR_CODE_SET.has(code)) {
      fail('invalid_field', '$.lastError.code is not a stable error code');
    }
    lastError = {
      code: code as KeeperErrorCode,
      message: asString(required(errorEntries, 'message', '$.lastError'), '$.lastError.message', {
        minBytes: 1,
        maxBytes: 256,
      }),
      retryable: asBoolean(
        required(errorEntries, 'retryable', '$.lastError'),
        '$.lastError.retryable'
      ),
      at: asTimestamp(required(errorEntries, 'at', '$.lastError'), '$.lastError.at'),
    };
  }

  const state = asString(required(root, 'state', '$'), '$.state', {
    maxBytes: 16,
    enum: USAGE_EXPORT_STATES,
    tight: true,
  }) as UsageExportState;
  const enabled = asBoolean(required(root, 'enabled', '$'), '$.enabled');
  const instance = isNull(instanceNode) ? null : decodeInstanceRef(instanceNode, '$.instance');
  const streamId = isNull(streamNode) ? null : asUuidV7(streamNode, '$.streamId');
  const nextSequence = nullableInt('nextSequence', 1);
  const acknowledgedThrough = nullableInt('acknowledgedThrough', 0);
  const nextExpectedSequence = nullableInt('nextExpectedSequence', 1);
  if ((streamId === null) !== (nextSequence === null) || (streamId === null) !== (acknowledgedThrough === null)) {
    fail('invalid_field', 'stream and watermark fields must be initialized together');
  }
  if (acknowledgedThrough !== null && nextExpectedSequence !== null && nextExpectedSequence !== acknowledgedThrough + 1) {
    fail('invalid_field', '$.nextExpectedSequence must equal acknowledgedThrough + 1');
  }
  const backlogEvents = asInteger(required(root, 'backlogEvents', '$'), '$.backlogEvents', 0, SAFE_INTEGER_MAX);
  const backlogBytes = asInteger(required(root, 'backlogBytes', '$'), '$.backlogBytes', 0, SAFE_INTEGER_MAX);
  const oldestBacklogAt = nullableTimestamp('oldestBacklogAt');
  if ((backlogEvents === 0) !== (oldestBacklogAt === null) || (backlogEvents === 0) !== (backlogBytes === 0)) {
    fail('invalid_field', 'backlog counts and oldestBacklogAt must agree');
  }
  if (state === 'disabled' && (enabled || instance !== null || streamId !== null || backlogEvents !== 0 || backlogBytes !== 0)) {
    fail('invalid_field', 'disabled status contains runtime state');
  }
  if (state === 'starting' && (!enabled || instance !== null || lastError !== null || nullableTimestamp('nextRetryAt') !== null)) {
    fail('invalid_field', 'starting status contains completed or failed runtime state');
  }
  if (state === 'connected' && (!enabled || instance === null || lastError !== null || nullableTimestamp('nextRetryAt') !== null)) {
    fail('invalid_field', 'connected status is incomplete');
  }
  if (state === 'retrying' && (!enabled || lastError === null || !lastError.retryable || nullableTimestamp('nextRetryAt') === null)) {
    fail('invalid_field', 'retrying status is incomplete');
  }
  if (state === 'degraded' && (!enabled || instance === null || lastError === null || lastError.retryable || nullableTimestamp('nextRetryAt') !== null)) {
    fail('invalid_field', 'degraded status is incomplete');
  }
  if (state === 'blocked' && (!enabled || lastError === null || lastError.retryable || nullableTimestamp('nextRetryAt') !== null)) {
    fail('invalid_field', 'blocked status is incomplete');
  }

  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    state,
    enabled,
    tokenConfigured: asBoolean(required(root, 'tokenConfigured', '$'), '$.tokenConfigured'),
    instance,
    streamId,
    nextSequence,
    acknowledgedThrough,
    nextExpectedSequence,
    backlogEvents,
    backlogBytes,
    oldestBacklogAt,
    lastAttemptAt: nullableTimestamp('lastAttemptAt'),
    lastSuccessAt: nullableTimestamp('lastSuccessAt'),
    nextRetryAt: nullableTimestamp('nextRetryAt'),
    metadataRevisions: {
      auth_files: asInteger(
        required(revisions, 'auth_files', '$.metadataRevisions'),
        '$.metadataRevisions.auth_files',
        0,
        SAFE_INTEGER_MAX
      ),
      api_keys: asInteger(
        required(revisions, 'api_keys', '$.metadataRevisions'),
        '$.metadataRevisions.api_keys',
        0,
        SAFE_INTEGER_MAX
      ),
      provider_identities: asInteger(
        required(revisions, 'provider_identities', '$.metadataRevisions'),
        '$.metadataRevisions.provider_identities',
        0,
        SAFE_INTEGER_MAX
      ),
    },
    lastError,
  };
}

export function decodeProtocolErrorResponse(text: string): ProtocolErrorResponse {
  const root = parseRootObject(text);
  expectKeys(root, ['protocolVersion', 'error'], '$');
  checkProtocolVersion(root, '$');
  const error = asObject(required(root, 'error', '$'), '$.error');
  expectKeys(error, ['code', 'message', 'retryable'], '$.error');
  const code = asString(required(error, 'code', '$.error'), '$.error.code', {
    maxBytes: 64,
    tight: true,
  });
  if (!KEEPER_ERROR_CODE_SET.has(code)) {
    fail('invalid_field', '$.error.code is not a stable error code');
  }
  return {
    protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
    error: {
      code: code as KeeperErrorCode,
      message: asString(required(error, 'message', '$.error'), '$.error.message', {
        minBytes: 1,
        maxBytes: 256,
      }),
      retryable: asBoolean(required(error, 'retryable', '$.error'), '$.error.retryable'),
    },
  };
}

export function decodeFingerprintVectors(text: string): FingerprintVectors {
  const root = parseRootObject(text);
  expectKeys(root, ['fingerprintSecretHex', 'vectors'], '$');
  const secretHex = asString(
    required(root, 'fingerprintSecretHex', '$'),
    '$.fingerprintSecretHex',
    { minBytes: 64, maxBytes: 64, pattern: /^[0-9a-f]{64}$/, tight: true }
  );
  const vectors = asArray(required(root, 'vectors', '$'), '$.vectors').map((item, index) => {
    const path = `$.vectors[${index}]`;
    const entries = asObject(item, path);
    expectKeys(entries, ['rawKeyUtf8', 'fingerprint'], path);
    const rawKeyUtf8 = asString(required(entries, 'rawKeyUtf8', path), `${path}.rawKeyUtf8`, {
      maxBytes: 4096,
    });
    const fingerprintNode = required(entries, 'fingerprint', path);
    if (rawKeyUtf8 === '') {
      // Empty key produces null, never an HMAC (spec section 3).
      if (!isNull(fingerprintNode)) {
        fail('invalid_field', `${path}.fingerprint must be null for an empty raw key`);
      }
      return { rawKeyUtf8, fingerprint: null };
    }
    return {
      rawKeyUtf8,
      fingerprint: asFingerprint(fingerprintNode, `${path}.fingerprint`),
    };
  });
  return { fingerprintSecretHex: secretHex, vectors };
}

export function decodeCreateInstanceRequest(text: string): CreateInstanceRequest {
  const root = parseRootObject(text);
  expectKeys(root, ['displayName', 'credential'], '$');
  const credential = asObject(required(root, 'credential', '$'), '$.credential');
  expectKeys(credential, ['name', 'scopes'], '$.credential');
  return {
    displayName: asString(required(root, 'displayName', '$'), '$.displayName', {
      minBytes: 1,
      maxBytes: 128,
      tight: true,
    }),
    credential: {
      name: asString(required(credential, 'name', '$.credential'), '$.credential.name', {
        minBytes: 1,
        maxBytes: 128,
        tight: true,
      }),
      // Obsolete aliases such as usage:write reject here (spec fixture #33).
      scopes: decodeScopes(required(credential, 'scopes', '$.credential'), '$.credential.scopes'),
    },
  };
}
