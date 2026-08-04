import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  KEEPER_EXPORT_PROTOCOL_VERSION,
  KeeperProtocolError,
  buildUsageExportSettingsPutBody,
  decodeConnectionTestResponse,
  decodeCreateInstanceRequest,
  decodeFingerprintVectors,
  decodeIdentityResponse,
  decodeInstanceRegistrationResponse,
  decodeKeeperExportBytes,
  decodeMetadataResultResponse,
  decodeMetadataSnapshotRequest,
  decodeProtocolErrorResponse,
  decodeUsageAckResponse,
  decodeUsageBatchRequest,
  decodeUsageExportSettingsPutBody,
  decodeUsageExportSettingsResponse,
  decodeUsageExportStatusResponse,
  evaluateMetadataRevision,
} from './keeperExport';

const FIXTURE_DIR = path.resolve(import.meta.dir, '../test/fixtures/keeperExport/v1');
const CPA_FIXTURE_DIR = path.resolve(
  import.meta.dir,
  '../../../CLIProxyAPIPlus/internal/keeperexport/testdata/v1'
);
const KEEPER_FIXTURE_DIR = path.resolve(
  import.meta.dir,
  '../../../cpa-usage-keeper/internal/protocol/testdata/v1'
);

const readFixture = (name: string): string => readFileSync(path.join(FIXTURE_DIR, name), 'utf8');
const readFixtureBytes = (name: string): Buffer => readFileSync(path.join(FIXTURE_DIR, name));

const sha256Hex = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const expectReject = (fn: () => unknown, code: string): void => {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(KeeperProtocolError);
    expect((error as KeeperProtocolError).code).toBe(code);
    return;
  }
  throw new Error(`expected KeeperProtocolError(${code}) but decode succeeded`);
};

/**
 * Section 13 mutation QA: `bun test src/types/keeperExport.contract.test.ts -- <file> <code>`.
 * Bun drops post-`--` args from process.argv, so recover them from the OS command line.
 * This recovery is test-only; the production module never touches /proc.
 *
 * Fail-closed rules:
 * - If /proc/self/cmdline is unreadable (non-Linux, restricted /proc), an intended
 *   mutation run is indistinguishable from a golden-suite run because Bun already
 *   dropped the args. Refuse to run rather than silently executing (and passing)
 *   the golden suite; set KEEPER_EXPORT_TEST_ALLOW_NO_PROC=1 to explicitly declare
 *   that no mutation args were intended on such a platform.
 * - If a `--` separator is present but the payload is missing or malformed, throw
 *   instead of silently falling back to the golden suite.
 */
const recoverTestCommandLine = (): string[] => {
  // KEEPER_EXPORT_TEST_CMDLINE_PATH is a test-only seam that lets the
  // fail-closed branch be exercised deterministically on Linux.
  const cmdlinePath = process.env.KEEPER_EXPORT_TEST_CMDLINE_PATH ?? '/proc/self/cmdline';
  let tokens: string[] | null;
  try {
    tokens = readFileSync(cmdlinePath, 'utf8').split('\0').filter(Boolean);
  } catch {
    tokens = null;
  }
  if (tokens !== null && tokens.length > 0) return tokens;
  if (process.env.KEEPER_EXPORT_TEST_ALLOW_NO_PROC !== '1') {
    throw new Error(
      'keeperExport contract test: cannot recover the OS command line ' +
        '(/proc/self/cmdline is unavailable). Bun drops post-"--" mutation args ' +
        'from process.argv, so an intended mutation QA run would silently execute ' +
        'the golden suite instead. Run on Linux, or set ' +
        'KEEPER_EXPORT_TEST_ALLOW_NO_PROC=1 to declare that no mutation args were intended.'
    );
  }
  return process.argv;
};

const mutationArgs = (): { file: string; code: string } | null => {
  const tokens = recoverTestCommandLine();
  const dash = tokens.indexOf('--');
  if (dash < 0) return null;
  const rest = tokens.slice(dash + 1).filter((t) => t.length > 0);
  if (rest.length !== 2 || !rest[0].endsWith('.json')) {
    throw new Error(
      'keeperExport contract test: malformed mutation args after "--" ' +
        `(expected "-- <fixture.json> <expectedCode>", got ${JSON.stringify(rest)})`
    );
  }
  return { file: rest[0], code: rest[1] };
};

const mutation = mutationArgs();

/** Shape-based decoder dispatch mirroring the Go repos' mutation drivers. */
const decodeMutationByShape = (file: string, bytes: Uint8Array): unknown =>
  decodeKeeperExportBytes(bytes, (text) => {
    let top: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        top = parsed as Record<string, unknown>;
      }
    } catch {
      top = null;
    }
    if (top === null) return decodeUsageBatchRequest(text);
    const has = (...keys: string[]): boolean => keys.some((key) => key in top!);
    if (has('error')) return decodeProtocolErrorResponse(text);
    if (has('state')) return decodeUsageExportStatusResponse(text);
    if (has('ok')) return decodeConnectionTestResponse(text);
    if (has('acknowledgedThrough')) return decodeUsageAckResponse(text);
    if (has('events')) return decodeUsageBatchRequest(text);
    if (has('items', 'revision')) {
      const base = file.split('/').pop() ?? file;
      const category = base.includes('api-keys')
        ? 'api_keys'
        : base.includes('provider-identities')
          ? 'provider_identities'
          : 'auth_files';
      return decodeMetadataSnapshotRequest(text, category);
    }
    if (has('settings')) return decodeUsageExportSettingsPutBody(text);
    if (has('fingerprintSecretHex')) return decodeFingerprintVectors(text);
    if (has('credential') && has('displayName')) return decodeCreateInstanceRequest(text);
    if (has('instance') && has('credential')) return decodeInstanceRegistrationResponse(text);
    if (has('instance')) return decodeIdentityResponse(text);
    return decodeUsageBatchRequest(text);
  });

if (mutation) {
  test('fixture mutation rejects with the expected stable code', () => {
    const bytes = readFileSync(mutation.file);
    expectReject(() => decodeMutationByShape(mutation.file, bytes), mutation.code);
  });
} else {
  describe('keeper-export/v1 golden fixtures: valid decode', () => {
    test('fingerprint vectors use the akf1 grammar and the frozen HMAC vector holds', () => {
      const vectors = decodeFingerprintVectors(readFixture('fingerprint-vectors.valid.json'));
      expect(vectors.fingerprintSecretHex).toBe(
        '000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f'
      );
      expect(vectors.vectors).toHaveLength(2);
      expect(vectors.vectors[0].rawKeyUtf8).toBe('sk-fixture-exact');
      expect(vectors.vectors[0].fingerprint).toBe(
        'akf1_294e384e158b4de177580af545663bbaf72ef8ae28e0fdf5678b14bb8eead0fc'
      );
      // Empty raw key produces null, never an HMAC.
      expect(vectors.vectors[1].rawKeyUtf8).toBe('');
      expect(vectors.vectors[1].fingerprint).toBeNull();
    });

    test('identity response decodes', () => {
      const identity = decodeIdentityResponse(readFixture('identity-response.valid.json'));
      expect(identity.instance.instanceId).toBe('0198aa10-4d88-7a20-8f4e-8c8de4a9cb11');
      expect(identity.credential.scopes).toEqual(['usage:push', 'metadata:push', 'identity:test']);
    });

    test('instance registration decodes and is the only token-bearing fixture', () => {
      const registration = decodeInstanceRegistrationResponse(
        readFixture('instance-registration.valid.json')
      );
      expect(registration.credential.token).toBe('fixture_ingest_token_not_secret');
      expect(registration.credential.expiresAt).toBeNull();
      expect(registration.instance.enabled).toBe(true);
    });

    test('usage batch decodes; duplicate request IDs are correlation only', () => {
      const batch = decodeUsageBatchRequest(readFixture('usage-batch.valid.json'));
      expect(batch.events.map((event) => event.sequence)).toEqual([1, 2]);
      // Both events carry the same request_id: correlation label, not a dedup key.
      expect(batch.events[0].payload.request_id).toBe('req-correlation-only');
      expect(batch.events[1].payload.request_id).toBe('req-correlation-only');
      expect(batch.events[0].payload.api_key_fingerprint).toMatch(/^akf1_[0-9a-f]{64}$/);
    });

    test('usage ACK decodes and satisfies the contiguous invariant', () => {
      const ack = decodeUsageAckResponse(readFixture('usage-ack.valid.json'));
      expect(ack.acknowledgedThrough).toBe(2);
      expect(ack.nextExpectedSequence).toBe(3);
      expect(ack.acceptedCount + ack.replayedCount).toBe(2);
    });

    test('metadata snapshots decode per category', () => {
      const authFiles = decodeMetadataSnapshotRequest(
        readFixture('metadata-auth-files.valid.json'),
        'auth_files'
      );
      expect(authFiles.revision).toBe(1);
      expect(authFiles.items).toHaveLength(2);

      const apiKeys = decodeMetadataSnapshotRequest(
        readFixture('metadata-api-keys.valid.json'),
        'api_keys'
      );
      expect(apiKeys.items).toHaveLength(2);

      const providers = decodeMetadataSnapshotRequest(
        readFixture('metadata-provider-identities.valid.json'),
        'provider_identities'
      );
      expect(providers.items).toHaveLength(2);

      const empty = decodeMetadataSnapshotRequest(
        readFixture('metadata-empty-complete.valid.json'),
        'auth_files'
      );
      expect(empty.revision).toBe(2);
      expect(empty.items).toHaveLength(0);
    });

    test('settings response decodes redacted; no token material present', () => {
      const settings = decodeUsageExportSettingsResponse(readFixture('settings-response.valid.json'));
      expect(settings.settings.keeper.tokenConfigured).toBe(true);
      expect(settings.settings.mode).toBe('push');
      expect('token' in settings.settings.keeper).toBe(false);
      expect(JSON.stringify(settings)).not.toContain('fixture_ingest_token_not_secret');
    });

    test('connection test response decodes', () => {
      const result = decodeConnectionTestResponse(
        readFixture('connection-test-response.valid.json')
      );
      expect(result.ok).toBe(true);
      expect(result.credentialScopes).toEqual(['usage:push', 'metadata:push', 'identity:test']);
      expect(result.latencyMs).toBe(42);
    });

    test('status responses decode with exhaustive state union', () => {
      const connected = decodeUsageExportStatusResponse(readFixture('status-connected.valid.json'));
      expect(connected.state).toBe('connected');
      expect(connected.lastError).toBeNull();

      const retrying = decodeUsageExportStatusResponse(readFixture('status-retrying.valid.json'));
      expect(retrying.state).toBe('retrying');
      expect(retrying.lastError?.code).toBe('keeper_timeout');
      expect(retrying.lastError?.retryable).toBe(true);
      expect(retrying.backlogEvents).toBeGreaterThan(0);
    });

    test('stable error envelope decodes', () => {
      const error = decodeProtocolErrorResponse(readFixture('error-conflicting-replay.valid.json'));
      expect(error.error.code).toBe('conflicting_replay');
      expect(error.error.retryable).toBe(false);
    });

    test('server-state request/expected pairs decode on both sides', () => {
      for (const name of [
        'replay-exact.request.json',
        'replay-conflict.request.json',
        'gap-before.request.json',
        'gap-fill.request.json',
      ]) {
        decodeUsageBatchRequest(readFixture(name));
      }
      const replayAck = decodeUsageAckResponse(readFixture('replay-exact.expected.json'));
      expect(replayAck.acceptedCount).toBe(0);
      expect(replayAck.replayedCount).toBe(2);

      const gapBeforeAck = decodeUsageAckResponse(readFixture('gap-before.expected.json'));
      expect(gapBeforeAck.acknowledgedThrough).toBe(10);

      const gapFillAck = decodeUsageAckResponse(readFixture('gap-fill.expected.json'));
      expect(gapFillAck.acknowledgedThrough).toBe(12);

      const conflict = decodeProtocolErrorResponse(readFixture('replay-conflict.expected.json'));
      expect(conflict.error.code).toBe('conflicting_replay');

      const emptyResult = decodeMetadataResultResponse(
        readFixture('metadata-empty-complete.expected.json')
      );
      expect(emptyResult.applied).toBe(true);
      expect(emptyResult.itemCount).toBe(0);

      const incomplete = decodeProtocolErrorResponse(
        readFixture('metadata-incomplete.expected.json')
      );
      expect(incomplete.error.code).toBe('incomplete_snapshot');
    });

    test('metadata revision state rules: stale, conflicting, idempotent, newer', () => {
      // Current state: auth_files at revision 2 (metadata-empty-complete applied).
      const stale = readFixture('invalid-metadata-stale-revision.json');
      expectReject(
        () =>
          evaluateMetadataRevision(
            { revision: 1, digestHex: sha256Hex(stale) },
            { currentRevision: 2, currentDigestHex: sha256Hex(readFixture('metadata-empty-complete.valid.json')) }
          ),
        'stale_revision'
      );

      // Current state: revision 1 with metadata-auth-files content.
      const conflicting = readFixture('invalid-metadata-conflicting-revision.json');
      expectReject(
        () =>
          evaluateMetadataRevision(
            { revision: 1, digestHex: sha256Hex(conflicting) },
            { currentRevision: 1, currentDigestHex: sha256Hex(readFixture('metadata-auth-files.valid.json')) }
          ),
        'conflicting_revision'
      );

      const same = readFixture('metadata-auth-files.valid.json');
      expect(
        evaluateMetadataRevision(
          { revision: 1, digestHex: sha256Hex(same) },
          { currentRevision: 1, currentDigestHex: sha256Hex(same) }
        )
      ).toEqual({ applied: false });

      const newer = readFixture('metadata-empty-complete.valid.json');
      expect(
        evaluateMetadataRevision(
          { revision: 2, digestHex: sha256Hex(newer) },
          { currentRevision: 1, currentDigestHex: sha256Hex(same) }
        )
      ).toEqual({ applied: true });
    });

    test('settings PUT serializer cannot emit token or tokenConfigured', () => {
      const settings = decodeUsageExportSettingsResponse(
        readFixture('settings-response.valid.json')
      ).settings;
      const body = buildUsageExportSettingsPutBody(settings);
      expect(body).not.toContain('tokenConfigured');
      expect(body).not.toContain('"token"');
      // Round-trip: the serialized body is a valid PUT body.
      const decoded = decodeUsageExportSettingsPutBody(body);
      expect(decoded.protocolVersion).toBe(KEEPER_EXPORT_PROTOCOL_VERSION);
      expect(decoded.settings.keeper.url).toBe('https://keeper.example.com');
    });
  });

  describe('keeper-export/v1 golden fixtures: invalid rejection with stable codes', () => {
    const cases: Array<{ file: string; code: string; decode: (text: string) => unknown }> = [
      { file: 'invalid-version.json', code: 'unsupported_protocol_version', decode: decodeUsageBatchRequest },
      { file: 'invalid-body-instance-id.json', code: 'body_instance_forbidden', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-gap-order.json', code: 'invalid_sequence_order', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-duplicate-sequence.json', code: 'invalid_sequence_order', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-raw-api-key.json', code: 'unknown_field', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-provider-secret-header.json', code: 'invalid_field', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-raw-failure-body.json', code: 'unknown_field', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-oversized-batch.json', code: 'batch_limit_exceeded', decode: decodeUsageBatchRequest },
      { file: 'invalid-usage-oversized-payload.json', code: 'batch_limit_exceeded', decode: decodeUsageBatchRequest },
      {
        file: 'invalid-metadata-incomplete.json',
        code: 'incomplete_snapshot',
        decode: (text) => decodeMetadataSnapshotRequest(text, 'auth_files'),
      },
      {
        file: 'invalid-metadata-duplicate-identity.json',
        code: 'duplicate_metadata_identity',
        decode: (text) => decodeMetadataSnapshotRequest(text, 'auth_files'),
      },
      { file: 'invalid-settings-token-value.json', code: 'unknown_field', decode: decodeUsageExportSettingsPutBody },
      {
        file: 'invalid-settings-token-configured-write.json',
        code: 'unknown_field',
        decode: decodeUsageExportSettingsPutBody,
      },
      { file: 'invalid-settings-http-url.json', code: 'invalid_settings', decode: decodeUsageExportSettingsPutBody },
      { file: 'invalid-status-token-leak.json', code: 'unknown_field', decode: decodeUsageExportStatusResponse },
      { file: 'invalid-unknown-field.json', code: 'unknown_field', decode: decodeUsageBatchRequest },
      { file: 'invalid-duplicate-json-key.json', code: 'invalid_json', decode: decodeUsageBatchRequest },
      { file: 'invalid-credential-scope.json', code: 'invalid_field', decode: decodeCreateInstanceRequest },
    ];

    for (const { file, code, decode } of cases) {
      test(`${file} rejects with ${code}`, () => {
        expectReject(() => decode(readFixture(file)), code);
      });
    }
  });

  describe('keeper-export/v1 raw byte decode boundary', () => {
    test('rejects invalid UTF-8 fatally before string parsing while valid bytes and string APIs agree', () => {
      const validBytes = readFixtureBytes('usage-batch.valid.json');
      const aliasNeedle = Buffer.from('"alias": "gpt-5.6"', 'utf8');
      const aliasOffset = validBytes.indexOf(aliasNeedle);
      expect(aliasOffset).toBeGreaterThanOrEqual(0);
      const insertionOffset = aliasOffset + Buffer.from('"alias": "gpt-', 'utf8').length;
      const invalidBytes = Buffer.concat([
        validBytes.subarray(0, insertionOffset),
        Buffer.from([0xff]),
        validBytes.subarray(insertionOffset),
      ]);

      // A non-fatal decoder demonstrates the exact historical bug: it silently
      // replaces 0xff with U+FFFD. The byte boundary must never use that fallback.
      expect(new TextDecoder().decode(invalidBytes)).toContain('gpt-\ufffd5.6');
      expectReject(
        () => decodeKeeperExportBytes(invalidBytes, decodeUsageBatchRequest),
        'invalid_json'
      );

      const fromBytes = decodeKeeperExportBytes(validBytes, decodeUsageBatchRequest);
      const fromString = decodeUsageBatchRequest(readFixture('usage-batch.valid.json'));
      expect(fromBytes).toEqual(fromString);
      expect(fromBytes.events[0].payload.model).toBe('gpt-5.6');
    });
  });

  describe('keeper-export/v1 stable-code edges pinned by the Go reference decoders', () => {
    test('usage batch events:[] rejects with invalid_field while >500 stays batch_limit_exceeded (spec 6.1, 9)', () => {
      const empty = JSON.stringify({
        protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
        streamId: '0198aa11-1055-7f12-8a00-e843d1e17522',
        events: [],
      });
      // Empty array is a payload-layer cardinality violation: 400 invalid_field.
      expectReject(() => decodeUsageBatchRequest(empty), 'invalid_field');
      // The 501-event fixture keeps the opposite branch pinned at 422.
      expectReject(
        () => decodeUsageBatchRequest(readFixture('invalid-usage-oversized-batch.json')),
        'batch_limit_exceeded'
      );
    });

    test('request decoders reject syntactically valid non-object top-level JSON with invalid_json (spec 2.1)', () => {
      for (const text of ['[1,2,3]', '"just a string"', '42', 'null', 'true']) {
        expectReject(() => decodeUsageBatchRequest(text), 'invalid_json');
        expectReject(() => decodeMetadataSnapshotRequest(text, 'auth_files'), 'invalid_json');
        expectReject(() => decodeMetadataSnapshotRequest(text, 'api_keys'), 'invalid_json');
        expectReject(() => decodeMetadataSnapshotRequest(text, 'provider_identities'), 'invalid_json');
        expectReject(() => decodeUsageExportSettingsPutBody(text), 'invalid_json');
        // Response decoders already pinned this code; the lanes must stay aligned.
        expectReject(() => decodeIdentityResponse(text), 'invalid_json');
        expectReject(() => decodeProtocolErrorResponse(text), 'invalid_json');
      }
    });

    test('metadata snapshot with more than 5000 items rejects with batch_limit_exceeded (spec 7.1)', () => {
      const items = Array.from({ length: 5001 }, (_, index) => ({
        authIndex: `auth-index-${index}`,
        name: '',
        displayName: '',
        type: '',
        provider: '',
        prefix: '',
        priority: null,
        disabled: null,
        note: null,
        accountId: null,
        projectId: null,
        xaiUserId: null,
        activeStart: null,
        activeUntil: null,
        planType: null,
      }));
      const body = JSON.stringify({
        protocolVersion: KEEPER_EXPORT_PROTOCOL_VERSION,
        revision: 1,
        complete: true,
        generatedAt: '2026-08-03T12:36:00.000Z',
        items,
      });
      expectReject(() => decodeMetadataSnapshotRequest(body, 'auth_files'), 'batch_limit_exceeded');
    });
  });

  describe('keeper-export/v1 fixture manifest and cross-repo parity', () => {
    test('manifest.sha256 covers exactly the JSON fixtures in lexical order', () => {
      const manifestLines = readFileSync(path.join(FIXTURE_DIR, 'manifest.sha256'), 'utf8')
        .split('\n')
        .filter((line) => line.length > 0);
      const entries = manifestLines.map((line) => {
        const match = /^([0-9a-f]{64}) {1,2}(\S+)$/.exec(line);
        expect(match).not.toBeNull();
        return { hash: match![1], name: match![2] };
      });

      const jsonFiles = readdirSync(FIXTURE_DIR)
        .filter((name) => name.endsWith('.json'))
        .sort();
      expect(entries.map((entry) => entry.name)).toEqual(jsonFiles);

      for (const entry of entries) {
        expect(sha256Hex(readFixture(entry.name)), `hash mismatch for ${entry.name}`).toBe(
          entry.hash
        );
        // Golden files end with exactly one LF and use two-space indentation.
        expect(readFixture(entry.name).endsWith('}\n') || readFixture(entry.name).endsWith(']\n')).toBe(
          true
        );
      }
    });

    test('fixtures are byte-identical to both Go repositories', () => {
      for (const [label, dir] of [
        ['CLIProxyAPIPlus', CPA_FIXTURE_DIR],
        ['cpa-usage-keeper', KEEPER_FIXTURE_DIR],
      ] as const) {
        expect(existsSync(dir), `${label} fixture directory must exist for parity`).toBe(true);
        const theirs = readdirSync(dir).sort();
        const ours = readdirSync(FIXTURE_DIR).sort();
        expect(ours, `file set parity with ${label}`).toEqual(theirs);
        for (const name of ours) {
          const oursBytes = readFileSync(path.join(FIXTURE_DIR, name));
          const theirsBytes = readFileSync(path.join(dir, name));
          expect(
            oursBytes.equals(theirsBytes),
            `byte parity with ${label} for ${name}`
          ).toBe(true);
        }
      }
    });
  });
}
