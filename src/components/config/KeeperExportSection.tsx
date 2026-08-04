import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconAlertTriangle, IconCheckCircle2, IconRefreshCw } from '@/components/ui/icons';
import { usageExportApi } from '@/services/api';
import type {
  ConnectionTestResponse,
  UsageExportStatusResponse,
} from '@/types/keeperExport';
import {
  keeperExportVisualToSettings,
  type KeeperExportVisualValues,
  type KeeperExportVisualValidationError,
} from '@/types/keeperExportVisual';
import styles from './VisualConfigEditor.module.scss';
import { getKeeperExportStatusTone } from './keeperExportStatus';

interface KeeperExportSectionProps {
  readonly values: KeeperExportVisualValues;
  readonly validationErrors: readonly KeeperExportVisualValidationError[];
  readonly usageStatisticsEnabled: boolean;
  readonly disabled: boolean;
  readonly onChange: (values: KeeperExportVisualValues) => void;
}

function ErrorText({
  error,
  t,
}: {
  readonly error?: KeeperExportVisualValidationError;
  readonly t: (key: string) => string;
}) {
  return error ? <div className="error-box">{t(`config_management.visual.validation.${error}`)}</div> : null;
}

function StatusValue({ status, t }: { readonly status: UsageExportStatusResponse; readonly t: (key: string) => string }) {
  const tone = getKeeperExportStatusTone(status.state);
  const toneClass =
    tone.kind === 'success'
      ? ''
      : tone.kind === 'warning'
        ? styles.keeperStatusWarning
        : tone.kind === 'error'
          ? styles.keeperStatusError
          : styles.keeperStatusMuted;
  const icon = tone.icon === 'check'
    ? <IconCheckCircle2 size={15} />
    : tone.icon === 'retry'
      ? <IconRefreshCw size={15} />
      : <IconAlertTriangle size={15} />;
  return (
    <div className={`${styles.keeperStatus} ${toneClass}`} role="status">
      <span className={styles.keeperStatusIcon} aria-hidden="true">{icon}</span>
      <strong>{t(`config_management.visual.sections.keeper_export.status.${status.state}`)}</strong>
      <span>{status.backlogEvents} {t('config_management.visual.sections.keeper_export.status.backlog')}</span>
    </div>
  );
}

function InstanceResult({ result, t }: { readonly result: ConnectionTestResponse; readonly t: (key: string) => string }) {
  return (
    <div className={styles.keeperTestResult} role="status">
      <IconCheckCircle2 size={16} aria-hidden="true" />
      <span>
        {t('config_management.visual.sections.keeper_export.test_success')}: {result.instance.displayName}
        <code>{result.instance.instanceId}</code>
      </span>
    </div>
  );
}

function updateKeeper(
  values: KeeperExportVisualValues,
  patch: Partial<KeeperExportVisualValues['keeper']>
): KeeperExportVisualValues {
  return { ...values, keeper: { ...values.keeper, ...patch } };
}

function updateDelivery(
  values: KeeperExportVisualValues,
  key: keyof KeeperExportVisualValues['delivery'],
  value: string
): KeeperExportVisualValues {
  return { ...values, delivery: { ...values.delivery, [key]: value } };
}

function updateMetadata(
  values: KeeperExportVisualValues,
  patch: Partial<KeeperExportVisualValues['metadata']>
): KeeperExportVisualValues {
  return { ...values, metadata: { ...values.metadata, ...patch } };
}

const METADATA_CATEGORIES = ['auth_files', 'api_keys', 'provider_identities'] as const;

function updatePrivacy(
  values: KeeperExportVisualValues,
  key: keyof KeeperExportVisualValues['privacy'],
  value: boolean
): KeeperExportVisualValues {
  return { ...values, privacy: { ...values.privacy, [key]: value } };
}

export function KeeperExportSection({
  values,
  validationErrors,
  usageStatisticsEnabled,
  disabled,
  onChange,
}: KeeperExportSectionProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<UsageExportStatusResponse | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState('');
  const statusRequestId = useRef(0);

  const settings = useMemo(() => keeperExportVisualToSettings(values), [values]);
  const hasErrors = validationErrors.length > 0;
  const canTest = values.enabled && values.mode === 'push' && !hasErrors && !testing;
  const errorFor = useCallback(
    (name: KeeperExportVisualValidationError) => validationErrors.includes(name) ? name : undefined,
    [validationErrors]
  );

  const loadStatus = useCallback(async () => {
    const requestId = ++statusRequestId.current;
    setStatus(null);
    try {
      const nextStatus = await usageExportApi.getStatus();
      if (requestId === statusRequestId.current) setStatus(nextStatus);
    } catch {
      if (requestId === statusRequestId.current) setStatus(null);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
    const interval = window.setInterval(() => void loadStatus(), 15000);
    return () => window.clearInterval(interval);
  }, [loadStatus]);

  const handleTest = async () => {
    setTesting(true);
    setTestError('');
    setTestResult(null);
    try {
      setTestResult(await usageExportApi.testConnection(settings));
    } catch (error: unknown) {
      setTestError(error instanceof Error ? error.message : t('config_management.visual.sections.keeper_export.test_failed'));
    } finally {
      setTesting(false);
    }
  };

  const setEnabled = (enabled: boolean) => {
    onChange({ ...values, enabled, mode: enabled ? 'push' : 'disabled' });
  };

  return (
    <div className={styles.keeperExportSection}>
      <div id="cfg-field-keeperExportEnabled" className={styles.keeperHero}>
        <div>
          <span className={styles.keeperEyebrow}>{t('config_management.visual.sections.keeper_export.eyebrow')}</span>
          <p>{t('config_management.visual.sections.keeper_export.description')}</p>
        </div>
        <ToggleSwitch
          checked={values.enabled}
          onChange={setEnabled}
          disabled={disabled}
          ariaLabel={t('config_management.visual.sections.keeper_export.fields.enabled')}
        />
      </div>

      {!usageStatisticsEnabled && values.enabled ? (
        <div className="error-box">{t('config_management.visual.validation.usage_statistics_required')}</div>
      ) : null}

      <div className={styles.keeperFieldGrid}>
        <div className={styles.fieldShell} id="cfg-field-keeperUrl">
          <Input
            label={t('config_management.visual.sections.keeper_export.fields.keeper_url')}
            value={values.keeper.url}
            onChange={(event) => onChange(updateKeeper(values, { url: event.target.value }))}
            placeholder="https://keeper.example.com"
            disabled={disabled}
            error={t(errorFor('keeper_url_required') ?? errorFor('keeper_url_https') ?? '') || undefined}
          />
        </div>
        <div className={styles.fieldShell} id="cfg-field-keeperTokenEnv">
          <Input
            label={t('config_management.visual.sections.keeper_export.fields.token_env')}
            value={values.keeper.tokenEnv}
            onChange={(event) => onChange(updateKeeper(values, { tokenEnv: event.target.value }))}
            placeholder="CPA_KEEPER_INGEST_TOKEN"
            hint={t('config_management.visual.sections.keeper_export.fields.token_env_hint')}
            disabled={disabled}
            error={errorFor('keeper_token_env') ? t('config_management.visual.validation.keeper_token_env') : undefined}
          />
          <span className={styles.tokenConfigured} data-token-configured={status?.tokenConfigured === true ? 'true' : status ? 'false' : 'unknown'}>
            {status
              ? status.tokenConfigured
                ? t('config_management.visual.sections.keeper_export.token_configured')
                : t('config_management.visual.sections.keeper_export.token_not_configured')
              : t('config_management.visual.sections.keeper_export.token_status_unknown')}
          </span>
        </div>
      </div>

      <div className={styles.keeperSubsection}>
        <h3>{t('config_management.visual.sections.keeper_export.fields.tls')}</h3>
        <div className={styles.keeperFieldGrid}>
          <Input label={t('config_management.visual.sections.keeper_export.fields.ca_file')} value={values.keeper.caFile} onChange={(event) => onChange(updateKeeper(values, { caFile: event.target.value }))} placeholder="/etc/cpa/keeper-ca.pem" disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.client_cert_file')} value={values.keeper.clientCertFile} onChange={(event) => onChange(updateKeeper(values, { clientCertFile: event.target.value }))} placeholder="/etc/cpa/client.crt" disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.client_key_file')} value={values.keeper.clientKeyFile} onChange={(event) => onChange(updateKeeper(values, { clientKeyFile: event.target.value }))} placeholder="/etc/cpa/client.key" disabled={disabled} />
        </div>
      </div>

      <div className={styles.keeperFieldGrid} id="cfg-field-keeperOutbox">
        <Input
          label={t('config_management.visual.sections.keeper_export.fields.outbox_path')}
          value={values.outbox.path}
          onChange={(event) => onChange({ ...values, outbox: { ...values.outbox, path: event.target.value } })}
          placeholder="/var/lib/cliproxy/keeper-outbox.db"
          disabled={disabled}
          error={errorFor('keeper_outbox_path') ? t('config_management.visual.validation.keeper_outbox_path') : undefined}
        />
        <Input
          label={t('config_management.visual.sections.keeper_export.fields.outbox_quota')}
          value={values.outbox.maxBytes}
          onChange={(event) => onChange({ ...values, outbox: { ...values.outbox, maxBytes: event.target.value } })}
          type="number"
          disabled={disabled}
          error={errorFor('keeper_outbox_bytes') ? t('config_management.visual.validation.keeper_outbox_bytes') : undefined}
        />
      </div>

      <div className={styles.keeperSubsection} id="cfg-field-keeperDelivery">
        <h3>{t('config_management.visual.sections.keeper_export.fields.delivery')}</h3>
        <div className={styles.keeperFieldGrid}>
          <Input label={t('config_management.visual.sections.keeper_export.fields.max_batch_events')} value={values.delivery.maxBatchEvents} type="number" onChange={(event) => onChange(updateDelivery(values, 'maxBatchEvents', event.target.value))} disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.max_batch_bytes')} value={values.delivery.maxBatchBytes} type="number" onChange={(event) => onChange(updateDelivery(values, 'maxBatchBytes', event.target.value))} disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.flush_interval')} value={values.delivery.flushIntervalMs} type="number" onChange={(event) => onChange(updateDelivery(values, 'flushIntervalMs', event.target.value))} disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.request_timeout')} value={values.delivery.requestTimeoutMs} type="number" onChange={(event) => onChange(updateDelivery(values, 'requestTimeoutMs', event.target.value))} disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.initial_backoff')} value={values.delivery.initialBackoffMs} type="number" onChange={(event) => onChange(updateDelivery(values, 'initialBackoffMs', event.target.value))} disabled={disabled} />
          <Input label={t('config_management.visual.sections.keeper_export.fields.max_backoff')} value={values.delivery.maxBackoffMs} type="number" onChange={(event) => onChange(updateDelivery(values, 'maxBackoffMs', event.target.value))} disabled={disabled} />
        </div>
      </div>

      <div className={styles.keeperSubsection} id="cfg-field-keeperMetadata">
        <h3>{t('config_management.visual.sections.keeper_export.fields.metadata')}</h3>
        <div className={styles.keeperFieldGrid}>
          <div className={styles.toggleRowCompact}><span>{t('config_management.visual.sections.keeper_export.fields.metadata_enabled')}</span><ToggleSwitch checked={values.metadata.enabled} onChange={(enabled) => onChange(updateMetadata(values, { enabled }))} disabled={disabled} ariaLabel={t('config_management.visual.sections.keeper_export.fields.metadata_enabled')} /></div>
          <Input label={t('config_management.visual.sections.keeper_export.fields.metadata_interval')} value={values.metadata.intervalMs} type="number" onChange={(event) => onChange(updateMetadata(values, { intervalMs: event.target.value }))} disabled={disabled} />
          <fieldset className={styles.keeperMetadataCategories}>
            <legend>{t('config_management.visual.sections.keeper_export.fields.metadata_categories')}</legend>
            {METADATA_CATEGORIES.map((category) => (
              <label key={category} className={styles.keeperMetadataCategory}>
                <input
                  type="checkbox"
                  checked={values.metadata.categories.includes(category)}
                  onChange={(event) => {
                    const categories = event.target.checked
                      ? [...values.metadata.categories, category]
                      : values.metadata.categories.filter((item) => item !== category);
                    onChange(updateMetadata(values, { categories }));
                  }}
                  disabled={disabled}
                />
                <span>{t(`config_management.visual.sections.keeper_export.fields.${category}`)}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </div>

      <div className={styles.keeperSubsection} id="cfg-field-keeperPrivacy">
        <h3>{t('config_management.visual.sections.keeper_export.fields.privacy')}</h3>
        <div className={styles.keeperPrivacyGrid}>
          <ToggleSwitch checked={values.privacy.includeClientIp} onChange={(value) => onChange(updatePrivacy(values, 'includeClientIp', value))} disabled={disabled} label={t('config_management.visual.sections.keeper_export.fields.include_client_ip')} />
          <ToggleSwitch checked={values.privacy.includeForwardedFor} onChange={(value) => onChange(updatePrivacy(values, 'includeForwardedFor', value))} disabled={disabled} label={t('config_management.visual.sections.keeper_export.fields.include_forwarded_for')} />
          <ToggleSwitch checked={values.privacy.includeUserAgent} onChange={(value) => onChange(updatePrivacy(values, 'includeUserAgent', value))} disabled={disabled} label={t('config_management.visual.sections.keeper_export.fields.include_user_agent')} />
        </div>
      </div>

      <div className={styles.keeperActions}>
        <Button variant="secondary" size="sm" onClick={() => void loadStatus()} disabled={disabled}>
          <IconRefreshCw size={14} /> {t('config_management.visual.sections.keeper_export.actions.refresh_status')}
        </Button>
        <Button variant="primary" size="sm" onClick={() => void handleTest()} disabled={!canTest} loading={testing}>
          {t('config_management.visual.sections.keeper_export.actions.test_connection')}
        </Button>
      </div>
      {testResult ? <InstanceResult result={testResult} t={t} /> : null}
      {testError ? <div className="error-box">{testError}</div> : null}
      {status ? <div id="cfg-field-keeperBacklog"><StatusValue status={status} t={t} /><div className={styles.keeperStatusMeta}>{t('config_management.visual.sections.keeper_export.status.acknowledged')}: {status.acknowledgedThrough ?? '—'} · {t('config_management.visual.sections.keeper_export.status.next')}: {status.nextExpectedSequence ?? '—'} · {t('config_management.visual.sections.keeper_export.status.revisions')}: {Object.entries(status.metadataRevisions).map(([category, revision]) => `${category} ${revision}`).join(' · ')}</div>{status.lastError ? <div className={styles.keeperStatusError}>{status.lastError.code}: {status.lastError.message}</div> : null}</div> : null}
      <ErrorText error={hasErrors ? validationErrors[0] : undefined} t={t} />
    </div>
  );
}
