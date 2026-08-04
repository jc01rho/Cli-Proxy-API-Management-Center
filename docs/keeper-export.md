# Keeper Export Management Center Guide

Management Center configures and observes CLIProxyAPIPlus (CPA); it does not administer Keeper instances or display Keeper tokens. Use this guide with the CPA [Keeper export operations runbook](../../CLIProxyAPIPlus/docs/keeper-export.md) and Keeper [migration and recovery runbook](../../cpa-usage-keeper/docs/keeper-export.md).

## Prerequisites and deployment order

Before using the Keeper Export section:

1. Upgrade and migrate Keeper, with a verified pre-migration backup.
2. Create one Keeper instance and credential for this CPA.
3. Put the one-time token in a private CPA environment variable.
4. Mount a durable per-CPA outbox directory and any CA/mTLS files.
5. Upgrade CPA so `/v0/management/usage-export/*` is available.
6. Deploy a matching Management Center build.

Do not enable export before Keeper identity testing succeeds.

## Open and find the section

1. Open the CPA-served `management.html` and authenticate with the existing CPA management credentials.
2. Navigate to **Config**.
3. Use the visual configuration editor.
4. Search for `Keeper`, `export`, `token env`, `outbox`, or a visible field label.
5. Select the **Keeper Export** result. Keyboard users can use the previous/next match controls and Enter/Shift+Enter navigation.

The section is responsive and supports light/dark themes and all shipped locales. Status always uses text and iconography in addition to color.

## Configure safely

The UI edits these groups. First ensure CPA's **Usage Statistics** setting is enabled; backend validation rejects `push` otherwise.

- **Enabled / mode**: use disabled mode for preflight and maintenance; `push` is the only delivery mode.
- **Keeper URL**: enter an absolute HTTPS base URL, such as `https://keeper.example.com` or `https://keeper.example.com/cpa`, with no `/api/v1`, query, fragment, or embedded credentials. Include the path only when it exactly matches Keeper `APP_BASE_PATH`.
- **Token environment variable**: enter the variable name, for example `CPA_KEEPER_INGEST_TOKEN`. Never paste the token value.
- **CA and mTLS paths**: paths are on the CPA host/container, not the browser workstation. Client certificate and key must be configured together.
- **Outbox path/quota**: choose a persistent local path unique to this CPA and size the quota for the longest expected outage.
- **Delivery**: batch limits, flush interval, request timeout, and retry bounds.
- **Metadata**: enable complete snapshots and select from `auth_files`, `api_keys`, and `provider_identities`.
- **Privacy**: client IP, forwarded-for, and user-agent are off by default. Enable only with an approved operational need.

The UI and management API never accept or return a raw Keeper token. `tokenConfigured` reports only whether CPA resolved a non-empty value at request time; it reveals no value, length, prefix, hash, or validation result.

## Recommended test and save flow

1. Leave **Enabled** off and mode **disabled**.
2. Enter the full intended settings.
3. Resolve every inline validation error.
4. Select **Test Connection**.
5. Verify the returned Keeper instance ID/display name and credential identity match the instance created for this CPA.
6. Save the disabled configuration and review the exact YAML diff.
7. Reopen/reload Config and confirm the saved values.
8. Schedule a quiet cutover: stop/drain CPA request traffic and disable Keeper's legacy pull source.
9. Change **Enabled** on and mode to **push**, then save.
10. Wait for the expected bound instance and a healthy status before resuming request traffic; then watch ACK/backlog and metadata revisions.

**Test Connection uses the unsaved draft.** This permits preflight before persistence, but it also means a successful test does not prove the current disk configuration was saved. Always save, reload, and verify after testing.

Saving hot-applies the CPA exporter. It does not restart CPA. Initial identity binding happens asynchronously after enablement; usage arriving before binding cannot be appended, so keep traffic drained until the expected instance appears. After binding, Keeper outages do not fail model requests; exporter status reports delivery failures and queued usage remains local unless the outbox itself cannot append.

## Read status

| State | UI interpretation | Action |
|---|---|---|
| `disabled` | Export is intentionally off | Expected during setup/rollback; preserve the outbox. |
| `starting` | Enabled but no successful identity/delivery cycle yet | Check token environment and TLS/mTLS. |
| `connected` | Last cycle succeeded; backlog may still be nonzero | Confirm ACK advances and backlog trends down. |
| `retrying` | Retryable failure with next retry scheduled | Inspect sanitized code/message and backlog age. |
| `degraded` | Non-retryable config/auth/storage/protocol condition | Stop rollout and repair before continuing. |
| `blocked` | Local outbox cannot safely progress | Disable, preserve files, repair quota/permissions/binding. |

The status panel includes:

- bound Keeper instance;
- stream ID;
- `nextSequence`, `acknowledgedThrough`, and `nextExpectedSequence`;
- backlog event/byte counts and oldest queued timestamp;
- last attempt/success and next retry timestamps;
- metadata revisions by category;
- a stable, sanitized last error.

A `connected` state can still show a backlog while the worker drains it. Judge health by ACK movement and backlog trend, not the state label alone.

## Privacy and secret handling

- The browser never needs the ingest token. Operators place it in the CPA process environment outside Management Center.
- Do not paste token values, CPA management keys, provider keys, OAuth data, auth-file contents, or mTLS private keys into fields, screenshots, support tickets, or browser console snippets.
- The UI displays only instance-scoped secret-free metadata and fingerprints. An API-key fingerprint is intentionally not comparable across CPA instances.
- Do not use a display name, prefix, request ID, or event key as an instance/deduplication identity.
- Clear downloaded screenshots/diagnostic exports that contain operational URLs, instance IDs, backlog information, or metadata if they are no longer required.

## Multiple CPA instances

Open each CPA's own `management.html` and configure it independently:

- distinct Keeper instance;
- distinct credential and token environment;
- distinct outbox path/volume;
- explicit verification of the returned instance ID before enablement.

Never copy the saved YAML plus outbox from one active CPA to another. A copied outbox is bound to the original Keeper instance and its stream/revisions; the runtime correctly blocks a different-instance credential.

Legacy Keeper data uses deterministic instance ID `00000000-0000-7000-8000-000000000000`. New exporters must display a newly registered instance ID, not `Legacy`.

## Operational procedures

### Disable without losing queued data

1. Turn **Enabled** off and select mode **disabled**.
2. Save and wait for status `disabled`.
3. Leave the outbox path/volume untouched.
4. Keep the same Keeper instance and credential unless revocation is required.
5. Re-enable later to resume the same stream.

Disabling closes but does not delete the outbox. Do not change the outbox path merely to clear a status error.

### Credential rotation

1. Issue or rotate a credential for the same Keeper instance in Keeper administration.
2. Replace the value of the configured token environment variable outside the UI.
3. Restart/recreate the CPA process so it receives the new environment value.
4. Run **Test Connection** and verify the same instance ID.
5. Observe status/ACK recovery.
6. Revoke the old credential if an overlapping issue-first cutover was used.

The UI cannot write or rotate the token. If rotation changed only the environment value, saving the same UI settings is not a substitute for restarting/recreating the CPA process.

### Roll back the UI

Management Center is a static single-file bundle. Serving a previous `management.html` rolls back only the UI; it does not revert CPA configuration, Keeper schema, or queued outbox data. Use a UI version compatible with the CPA management contract.

If an older UI does not understand Keeper Export, operate rollback through the CPA YAML/management API runbook and leave the outbox intact.

## Troubleshooting from the UI

| Visible problem | Resolution |
|---|---|
| Token not configured | Verify the exact environment variable name and that the CPA process has a non-empty value; restart/recreate CPA. |
| Test returns invalid credential | Credential is wrong, expired, rotated, or revoked. Replace it for the same instance without exposing it in the UI. |
| Test returns insufficient scope | Bootstrap/test requires `identity:test`; enabled usage/metadata also require corresponding scopes. |
| Instance disabled | Re-enable the intended Keeper instance only after containment review. |
| Keeper URL validation error | Use an absolute HTTPS base URL without query, fragment, or credentials; a path is only the matching Keeper `APP_BASE_PATH`. There is no HTTP or skip-verify mode. |
| Custom CA error | File must exist and be readable inside CPA; mount a valid PEM bundle. |
| mTLS error | Cert/key must both be present, paired, readable, unexpired, and trusted by Keeper ingress. |
| Retrying | Check `nextRetryAt`, Keeper health, reverse proxy, rate limits, and backlog trend. |
| Degraded/blocked | Fix outbox ownership/free space/quota, credential binding, or non-retryable protocol/config error before re-enable. |
| ACK does not advance | Compare `nextExpectedSequence`, gap behavior, and Keeper health; never reset the stream from UI. |
| Metadata revision stale/conflict | Ensure only one active CPA owns this outbox and that it was not copied between instances. |
| Save succeeded but process still uses old token | Environment changes require process restart/recreation; the UI saves only `token-env`. |
| Management API 401 | This is CPA management authentication, not Keeper ingest authentication; log back into Management Center. |

Errors shown in the Keeper section are stable and sanitized. Do not try to recover hidden details by logging raw HTTP bodies or Authorization headers.

## Upgrade and canary UI workflow

1. Deploy Keeper and CPA support before the new UI.
2. Build or download a Management Center release whose version is explicit and not `dev`.
3. Deploy it to one canary CPA.
4. Verify search/focus, draft validation, Test Connection, diff/save/reload, all status variants, long URL/error wrapping, and keyboard operation.
5. Confirm no raw token appears in the DOM, network logs, browser storage, or saved YAML.
6. Complete the canary traffic/restart/rotation drill in the CPA/Keeper runbooks.
7. Deploy the same UI artifact to remaining CPAs.

## Concise operator checklist

- [ ] Keeper migrated/backed up and per-CPA instance created.
- [ ] Token exists only in CPA private environment.
- [ ] CA/mTLS and durable outbox files mounted with owner-only permissions.
- [ ] Keeper section found through Config visual search.
- [ ] Draft validates; Test Connection returns expected non-legacy instance.
- [ ] Disabled settings saved, diff reviewed, and reload confirmed.
- [ ] Export enabled; ACK advances, backlog drains, revisions appear.
- [ ] Privacy switches reviewed and default-off unless approved.
- [ ] Rotation/disable/re-enable and outage behavior exercised.
- [ ] No secret appears in UI, logs, screenshots, config, or artifacts.

## Build and release

Management Center is independently versioned from Keeper and CPA.

```bash
cd /home/jc01rho/git/cli-proxy/Cli-Proxy-API-Management-Center
TAG='v<major>.<minor>.<patch>-<seq>'
test "$(git rev-parse "$TAG^{commit}")" = "$(git rev-parse HEAD)"
VERSION="$TAG" bun run build
```

- Development builds may use an explicit non-release label, but accepted release artifacts must use the verified tag command above.
- Never deploy a local bundle that reports `dev`.
- The release workflow receives `VERSION=${{ github.ref_name }}`, renames `dist/index.html` to `management.html`, and publishes it.
- Tags follow `v<major>.<minor>.<patch>-<seq>`. If upstream has a newer base, reset suffix to `-1`; otherwise increment the suffix.
- Every push must have exactly one corresponding pushed tag. Do not tag or push from the umbrella directory.
- Recommended coordinated release order is Keeper, CPA, then Management Center, while keeping all three version numbers independent.
- No commit, tag, or push is authorized by this guide.
