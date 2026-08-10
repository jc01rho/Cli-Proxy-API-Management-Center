import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTransitionLayer } from '@/components/common/PageTransitionLayer';
import { Button } from '@/components/ui/Button';
import { Collapsible } from '@/components/ui/Collapsible';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { WeightRobinQueueView } from '@/components/config/WeightRobinQueueView';
import {
  IconCode,
  IconKey,
  IconRoute,
  IconSatellite,
  IconSettings,
  IconShield,
  IconTimer,
  type IconProps,
} from '@/components/ui/icons';
import { ConfigSection } from '@/components/config/ConfigSection';
import { KeeperExportSection } from '@/components/config/KeeperExportSection';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type {
  APIKeyBlacklistEntry,
  OauthEndpointOverrideEntry,
  PayloadFilterRule,
  PayloadParamValidationErrorCode,
  PayloadRule,
  PluginStoreAuthRule,
  VisualConfigFieldPath,
  VisualConfigValidationErrorCode,
  VisualConfigValidationErrors,
  VisualConfigValues,
} from '@/types/visualConfig';
import {
  ApiKeysCardEditor,
  FallbackModelsEditor,
  OauthEndpointOverridesEditor,
  PayloadFilterRulesEditor,
  PayloadRulesEditor,
  PluginStoreAuthEditor,
  StringListEditor,
  TokenThresholdRulesEditor,
} from './VisualConfigEditorBlocks';
import { configFieldDomId } from './configSearchIndex';
import styles from './VisualConfigEditor.module.scss';

export type VisualSectionId =
  | 'server'
  | 'auth'
  | 'system'
  | 'network'
  | 'quota'
  | 'streaming'
  | 'advanced'
  | 'payload'
  | 'fallback'
  | 'keeperExport';

type VisualSection = {
  id: VisualSectionId;
  title: string;
  icon: ComponentType<IconProps>;
  errorCount: number;
};

interface VisualConfigEditorProps {
  values: VisualConfigValues;
  validationErrors?: VisualConfigValidationErrors;
  hasPayloadValidationErrors?: boolean;
  keeperExportValidationErrors?: import('@/types/keeperExportVisual').KeeperExportVisualValidationError[];
  disabled?: boolean;
  blockedIps?: APIKeyBlacklistEntry[];
  blockedIpsLoading?: boolean;
  unbanPendingIp?: string | null;
  manualBanIp?: string;
  manualBanPending?: boolean;
  onManualBanIpChange?: (ip: string) => void;
  onRefreshBlockedIps?: () => void;
  onBanBlockedIp?: (ip: string) => void;
  onUnbanBlockedIp?: (ip: string) => void;
  onChange: (values: Partial<VisualConfigValues>) => void;
  visualSearchSectionId?: VisualSectionId;
  visualSearchFieldId?: string;
  visualSearchIndex?: number;
}

function getValidationMessage(
  t: ReturnType<typeof useTranslation>['t'],
  errorCode?: VisualConfigValidationErrorCode | PayloadParamValidationErrorCode
) {
  if (!errorCode) return undefined;
  return t(`config_management.visual.validation.${errorCode}`);
}

type ToggleRowProps = {
  title: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
};

function ToggleRow({ title, description, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <div className={styles.toggleRow}>
      <div className={styles.toggleCopy}>
        <div className={styles.toggleTitle}>{title}</div>
        {description ? <div className={styles.toggleDescription}>{description}</div> : null}
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  );
}

function SectionGrid({ children }: { children: ReactNode }) {
  return <div className={styles.sectionGrid}>{children}</div>;
}

function SectionStack({ children }: { children: ReactNode }) {
  return <div className={styles.sectionStack}>{children}</div>;
}

function Divider() {
  return <div className={styles.divider} />;
}

// Stable, stateless anchor around a searchable field. Search jumps target its DOM id
// (see configSearchIndex.ts) and the highlight pulse is applied to it imperatively.
function FieldAnchor({ fieldId, children }: { fieldId: string; children: ReactNode }) {
  return (
    <div id={configFieldDomId(fieldId)} className={styles.fieldAnchor}>
      {children}
    </div>
  );
}

function SectionSubsection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.subsection}>
      <div className={styles.subsectionHeader}>
        <h3 className={styles.subsectionTitle}>{title}</h3>
        {description ? <p className={styles.subsectionDescription}>{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function FieldShell({
  label,
  labelId,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string;
  labelId?: string;
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  error?: string;
  errorId?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.fieldShell}>
      <label id={labelId} htmlFor={htmlFor} className={styles.fieldLabel}>
        {label}
      </label>
      {children}
      {error ? (
        <div id={errorId} className="error-box">
          {error}
        </div>
      ) : null}
      {hint ? (
        <div id={hintId} className={styles.fieldHint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function VisualConfigEditor({
  values,
  validationErrors,
  hasPayloadValidationErrors = false,
  keeperExportValidationErrors = [],
  disabled = false,
  blockedIps = [],
  blockedIpsLoading = false,
  unbanPendingIp = null,
  manualBanIp = '',
  manualBanPending = false,
  onManualBanIpChange,
  onRefreshBlockedIps,
  onBanBlockedIp,
  onUnbanBlockedIp,
  onChange,
  visualSearchSectionId,
  visualSearchFieldId,
  visualSearchIndex = -1,
}: VisualConfigEditorProps) {
  const { t } = useTranslation();
  const pageTransitionLayer = usePageTransitionLayer();
  const isCurrentLayer = pageTransitionLayer ? pageTransitionLayer.isCurrentLayer : true;
  const isMobile = useMediaQuery('(max-width: 768px)');
  const routingStrategyLabelId = useId();
  const routingStrategyHintId = `${routingStrategyLabelId}-hint`;
  const routingModeLabelId = useId();
  const routingModeHintId = `${routingModeLabelId}-hint`;
  const disableImageGenerationLabelId = useId();
  const disableImageGenerationHintId = `${disableImageGenerationLabelId}-hint`;
  const keepaliveInputId = useId();
  const keepaliveHintId = `${keepaliveInputId}-hint`;
  const keepaliveErrorId = `${keepaliveInputId}-error`;
  const nonstreamKeepaliveInputId = useId();
  const nonstreamKeepaliveHintId = `${nonstreamKeepaliveInputId}-hint`;
  const nonstreamKeepaliveErrorId = `${nonstreamKeepaliveInputId}-error`;
  const [activeSectionId, setActiveSectionId] = useState<VisualSectionId>('server');

  useEffect(() => {
    if (visualSearchSectionId) setActiveSectionId(visualSearchSectionId);
  }, [visualSearchSectionId]);

  useLayoutEffect(() => {
    if (!visualSearchSectionId || activeSectionId !== visualSearchSectionId) return;
    const anchor = visualSearchFieldId
      ? document.getElementById(configFieldDomId(visualSearchFieldId))
      : document.querySelector<HTMLElement>('.cfg-field-highlight-active');
    anchor?.querySelector<HTMLElement>('input, select, textarea, button, [tabindex]:not([tabindex="-1"])')?.focus({ preventScroll: true });
  }, [activeSectionId, visualSearchFieldId, visualSearchIndex, visualSearchSectionId]);
  const sectionRefs = useRef<Partial<Record<VisualSectionId, HTMLElement | null>>>({});
  const mobileNavScrollerRef = useRef<HTMLDivElement | null>(null);
  const mobileNavButtonRefs = useRef<Partial<Record<VisualSectionId, HTMLButtonElement | null>>>(
    {}
  );
  const isKeepaliveDisabled =
    values.streaming.keepaliveSeconds === '' || values.streaming.keepaliveSeconds === '0';
  const isNonstreamKeepaliveDisabled =
    values.streaming.nonstreamKeepaliveInterval === '' ||
    values.streaming.nonstreamKeepaliveInterval === '0';

  const portError = getValidationMessage(t, validationErrors?.port);
  const logsMaxSizeError = getValidationMessage(t, validationErrors?.logsMaxTotalSizeMb);
  const errorLogsMaxFilesError = getValidationMessage(t, validationErrors?.errorLogsMaxFiles);
  const redisUsageQueueRetentionError = getValidationMessage(
    t,
    validationErrors?.redisUsageQueueRetentionSeconds
  );
  const requestRetryError = getValidationMessage(t, validationErrors?.requestRetry);
  const maxRetryCredentialsError = getValidationMessage(t, validationErrors?.maxRetryCredentials);
  const maxRetryIntervalError = getValidationMessage(t, validationErrors?.maxRetryInterval);
  const authAutoRefreshWorkersError = getValidationMessage(
    t,
    validationErrors?.authAutoRefreshWorkers
  );
  const keepaliveError = getValidationMessage(t, validationErrors?.['streaming.keepaliveSeconds']);
  const bootstrapRetriesError = getValidationMessage(
    t,
    validationErrors?.['streaming.bootstrapRetries']
  );
  const nonstreamKeepaliveError = getValidationMessage(
    t,
    validationErrors?.['streaming.nonstreamKeepaliveInterval']
  );

  const handleApiKeysTextChange = useCallback(
    (apiKeysText: string) => onChange({ apiKeysText }),
    [onChange]
  );
  const handleApiKeyModelWhitelistsChange = useCallback(
    (apiKeyModelWhitelists: Record<string, string[]>) => onChange({ apiKeyModelWhitelists }),
    [onChange]
  );
  const handleFallbackModelsChange = useCallback(
    (fallbackModels: Record<string, string>) => onChange({ fallbackModels }),
    [onChange]
  );
  const handleFallbackChainChange = useCallback(
    (fallbackChain: string[]) => onChange({ fallbackChain }),
    [onChange]
  );
  const handleFallbackMaxDepthChange = useCallback(
    (fallbackMaxDepth: string) => onChange({ fallbackMaxDepth }),
    [onChange]
  );
  const handleOauthEndpointOverridesChange = useCallback(
    (oauthEndpointOverrides: OauthEndpointOverrideEntry[]) => onChange({ oauthEndpointOverrides }),
    [onChange]
  );
  const handlePluginStoreSourcesChange = useCallback(
    (pluginStoreSources: string[]) => onChange({ pluginStoreSources }),
    [onChange]
  );
  const handlePluginStoreAuthChange = useCallback(
    (pluginStoreAuth: PluginStoreAuthRule[]) => onChange({ pluginStoreAuth }),
    [onChange]
  );
  const handlePayloadDefaultRulesChange = useCallback(
    (payloadDefaultRules: PayloadRule[]) => onChange({ payloadDefaultRules }),
    [onChange]
  );
  const handlePayloadDefaultRawRulesChange = useCallback(
    (payloadDefaultRawRules: PayloadRule[]) => onChange({ payloadDefaultRawRules }),
    [onChange]
  );
  const handlePayloadOverrideRulesChange = useCallback(
    (payloadOverrideRules: PayloadRule[]) => onChange({ payloadOverrideRules }),
    [onChange]
  );
  const handlePayloadOverrideRawRulesChange = useCallback(
    (payloadOverrideRawRules: PayloadRule[]) => onChange({ payloadOverrideRawRules }),
    [onChange]
  );
  const handlePayloadFilterRulesChange = useCallback(
    (payloadFilterRules: PayloadFilterRule[]) => onChange({ payloadFilterRules }),
    [onChange]
  );
  const formatTimestamp = useCallback((value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  }, []);
  const formatRemaining = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainingSeconds = total % 60;
    return [
      hours > 0 ? `${hours}h` : null,
      minutes > 0 ? `${minutes}m` : null,
      remainingSeconds > 0 || (hours === 0 && minutes === 0) ? `${remainingSeconds}s` : null,
    ]
      .filter(Boolean)
      .join(' ');
  }, []);
  const disableImageGenerationOptions = useMemo(
    () => [
      {
        value: 'false',
        label: t('config_management.visual.sections.network.disable_image_generation_false'),
      },
      {
        value: 'true',
        label: t('config_management.visual.sections.network.disable_image_generation_true'),
      },
      {
        value: 'chat',
        label: t('config_management.visual.sections.network.disable_image_generation_chat'),
      },
      {
        value: 'passthrough',
        label: t('config_management.visual.sections.network.disable_image_generation_passthrough'),
      },
    ],
    [t]
  );

  const countErrors = useCallback(
    (fields: VisualConfigFieldPath[]) =>
      fields.reduce((total, field) => total + (validationErrors?.[field] ? 1 : 0), 0),
    [validationErrors]
  );

  const sections = useMemo<VisualSection[]>(
    () => [
      {
        id: 'server',
        title: t('config_management.visual.sections.server.title'),
        icon: IconSettings,
        errorCount: countErrors(['port']),
      },
      {
        id: 'auth',
        title: t('config_management.visual.sections.auth.title'),
        icon: IconKey,
        errorCount: 0,
      },
      {
        id: 'system',
        title: t('config_management.visual.sections.system.title'),
        icon: IconKey,
        errorCount: countErrors([
          'errorLogsMaxFiles',
          'logsMaxTotalSizeMb',
          'redisUsageQueueRetentionSeconds',
          'requestRetry',
          'maxRetryCredentials',
          'maxRetryInterval',
          'authAutoRefreshWorkers',
        ]),
      },
      {
        id: 'fallback',
        title: t('config_management.visual.sections.fallback.title'),
        icon: IconRoute,
        errorCount: 0,
      },
      {
        id: 'network',
        title: t('config_management.visual.sections.network.title'),
        icon: IconTimer,
        errorCount: countErrors([
          'requestRetry',
          'maxRetryCredentials',
          'maxRetryInterval',
          'authAutoRefreshWorkers',
        ]),
      },
      {
        id: 'quota',
        title: t('config_management.visual.sections.quota.title'),
        icon: IconTimer,
        errorCount: 0,
      },
      {
        id: 'streaming',
        title: t('config_management.visual.sections.streaming.title'),
        icon: IconSatellite,
        errorCount: countErrors([
          'streaming.keepaliveSeconds',
          'streaming.bootstrapRetries',
          'streaming.nonstreamKeepaliveInterval',
        ]),
      },
      {
        id: 'keeperExport',
        title: t('config_management.visual.sections.keeper_export.title'),
        icon: IconSatellite,
        errorCount: keeperExportValidationErrors.length,
      },
      {
        id: 'advanced',
        title: t('config_management.visual.sections.advanced.title'),
        icon: IconShield,
        errorCount: 0,
      },
      {
        id: 'payload',
        title: t('config_management.visual.sections.payload.title'),
        icon: IconCode,
        errorCount: hasPayloadValidationErrors ? 1 : 0,
      },
    ],
    [countErrors, hasPayloadValidationErrors, keeperExportValidationErrors.length, t]
  );

  const hasValidationIssues =
    sections.some((section) => section.errorCount > 0) || hasPayloadValidationErrors;
  const payloadValidationKey = hasPayloadValidationErrors ? 'payload-errors' : 'payload-ok';
  const activeSection = sections.find((section) => section.id === activeSectionId) ?? sections[0];

  useEffect(() => {
    if (!isCurrentLayer) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);

        if (visibleEntries.length === 0) return;
        setActiveSectionId(visibleEntries[0].target.id as VisualSectionId);
      },
      {
        rootMargin: '-18% 0px -58% 0px',
        threshold: [0.12, 0.3, 0.55],
      }
    );

    for (const section of sections) {
      const element = sectionRefs.current[section.id];
      if (element) observer.observe(element);
    }

    return () => observer.disconnect();
  }, [isCurrentLayer, sections]);

  useEffect(() => {
    if (!isCurrentLayer || !isMobile) return;
    const scroller = mobileNavScrollerRef.current;
    const button = mobileNavButtonRefs.current[activeSectionId];
    if (!scroller || !button) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const centeredLeft =
      scroller.scrollLeft +
      (buttonRect.left - scrollerRect.left) -
      (scroller.clientWidth - buttonRect.width) / 2;
    const maxScrollLeft = Math.max(scroller.scrollWidth - scroller.clientWidth, 0);
    const targetLeft = Math.min(Math.max(centeredLeft, 0), maxScrollLeft);

    scroller.scrollTo({
      left: targetLeft,
      behavior: 'smooth',
    });
  }, [activeSectionId, isCurrentLayer, isMobile]);

  const handleSectionJump = useCallback((sectionId: VisualSectionId) => {
    setActiveSectionId(sectionId);
    sectionRefs.current[sectionId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  }, []);

  const navContent = (
    <div className={styles.navList}>
      {sections.map((section, index) => {
        const Icon = section.icon;

        return (
          <button
            key={section.id}
            type="button"
            className={`${styles.navButton} ${
              activeSectionId === section.id ? styles.navButtonActive : ''
            }`}
            onClick={() => handleSectionJump(section.id)}
          >
            <span className={styles.navIndex}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.navMain}>
              <span className={styles.navHeadingRow}>
                <span className={styles.navLabelWrap}>
                  <span className={styles.navIcon}>
                    <Icon size={14} />
                  </span>
                  <span className={styles.navLabel}>{section.title}</span>
                </span>
                {section.errorCount > 0 ? (
                  <span className={styles.navBadge} aria-hidden="true">
                    {section.errorCount}
                  </span>
                ) : null}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className={styles.visualEditor}>
      <div className={styles.overview}>
        <div className={styles.overviewHeader}>
          <div className={styles.overviewMeta}>
            <span className={styles.overviewPill}>
              {t('config_management.visual.quick_jump', { defaultValue: '快速跳转' })}
            </span>
            <span className={styles.overviewPill}>{activeSection?.title}</span>
            {hasValidationIssues ? (
              <span className={`${styles.overviewPill} ${styles.overviewPillWarning}`}>
                {t('config_management.visual.validation.validation_blocked')}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.workspace}>
        {isMobile ? (
          <div className={styles.mobileSectionNav}>
            <div
              ref={mobileNavScrollerRef}
              className={styles.mobileSectionNavScroller}
              role="navigation"
              aria-label={t('config_management.visual.quick_jump', { defaultValue: '快速跳转' })}
            >
              {sections.map((section, index) => (
                <button
                  key={section.id}
                  ref={(node) => {
                    mobileNavButtonRefs.current[section.id] = node;
                  }}
                  type="button"
                  className={`${styles.mobileSectionNavButton} ${
                    activeSectionId === section.id ? styles.mobileSectionNavButtonActive : ''
                  }`}
                  onClick={() => handleSectionJump(section.id)}
                >
                  <span className={styles.mobileSectionNavIndex}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={styles.mobileSectionNavLabel}>{section.title}</span>
                  {section.errorCount > 0 ? (
                    <span className={styles.mobileSectionNavBadge} aria-hidden="true">
                      {section.errorCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <aside className={styles.sidebar}>
          <div className={styles.sidebarRail}>{navContent}</div>
        </aside>

        <div className={styles.sections} data-editor-sections="single-column">
          <ConfigSection
            id="server"
            data-editor-section
            data-active-section={activeSectionId === 'server' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.server = node;
            }}
            indexLabel="01"
            icon={<IconSettings size={16} />}
            title={t('config_management.visual.sections.server.title')}
            description={t('config_management.visual.sections.server.description')}
          >
            <SectionStack>
              <SectionGrid>
                <Input
                  label={t('config_management.visual.sections.server.host')}
                  placeholder="0.0.0.0"
                  value={values.host}
                  onChange={(e) => onChange({ host: e.target.value })}
                  disabled={disabled}
                />
                <Input
                  label={t('config_management.visual.sections.server.port')}
                  type="number"
                  placeholder="8317"
                  value={values.port}
                  onChange={(e) => onChange({ port: e.target.value })}
                  disabled={disabled}
                  error={portError}
                />
              </SectionGrid>

              <SectionSubsection
                title={t('config_management.visual.sections.tls.title')}
                description={t('config_management.visual.sections.tls.description')}
              >
                <SectionStack>
                  <ToggleRow
                    title={t('config_management.visual.sections.tls.enable')}
                    description={t('config_management.visual.sections.tls.enable_desc')}
                    checked={values.tlsEnable}
                    disabled={disabled}
                    onChange={(tlsEnable) => onChange({ tlsEnable })}
                  />

                  {values.tlsEnable ? (
                    <>
                      <Divider />
                      <SectionGrid>
                        <Input
                          label={t('config_management.visual.sections.tls.cert')}
                          placeholder="/path/to/cert.pem"
                          value={values.tlsCert}
                          onChange={(e) => onChange({ tlsCert: e.target.value })}
                          disabled={disabled}
                        />
                        <Input
                          label={t('config_management.visual.sections.tls.key')}
                          placeholder="/path/to/key.pem"
                          value={values.tlsKey}
                          onChange={(e) => onChange({ tlsKey: e.target.value })}
                          disabled={disabled}
                        />
                      </SectionGrid>
                    </>
                  ) : null}
                </SectionStack>
              </SectionSubsection>

              <SectionSubsection
                title={t('config_management.visual.sections.remote.title')}
                description={t('config_management.visual.sections.remote.description')}
              >
                <SectionStack>
                  <SectionGrid>
                    <ToggleRow
                      title={t('config_management.visual.sections.remote.allow_remote')}
                      description={t('config_management.visual.sections.remote.allow_remote_desc')}
                      checked={values.rmAllowRemote}
                      disabled={disabled}
                      onChange={(rmAllowRemote) => onChange({ rmAllowRemote })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.remote.disable_panel')}
                      description={t('config_management.visual.sections.remote.disable_panel_desc')}
                      checked={values.rmDisableControlPanel}
                      disabled={disabled}
                      onChange={(rmDisableControlPanel) => onChange({ rmDisableControlPanel })}
                    />
                    <ToggleRow
                      title={t(
                        'config_management.visual.sections.remote.disable_auto_update_panel'
                      )}
                      description={t(
                        'config_management.visual.sections.remote.disable_auto_update_panel_desc'
                      )}
                      checked={values.rmDisableAutoUpdatePanel}
                      disabled={disabled}
                      onChange={(rmDisableAutoUpdatePanel) =>
                        onChange({ rmDisableAutoUpdatePanel })
                      }
                    />
                  </SectionGrid>
                  <SectionGrid>
                    <Input
                      label={t('config_management.visual.sections.remote.secret_key')}
                      type="password"
                      placeholder={t(
                        'config_management.visual.sections.remote.secret_key_placeholder'
                      )}
                      value={values.rmSecretKey}
                      onChange={(e) => onChange({ rmSecretKey: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.remote.panel_repo')}
                      placeholder="https://github.com/router-for-me/Cli-Proxy-API-Management-Center"
                      value={values.rmPanelRepo}
                      onChange={(e) => onChange({ rmPanelRepo: e.target.value })}
                      disabled={disabled}
                    />
                  </SectionGrid>
                </SectionStack>
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="auth"
            data-editor-section
            data-active-section={activeSectionId === 'auth' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.auth = node;
            }}
            indexLabel="02"
            icon={<IconKey size={16} />}
            title={t('config_management.visual.sections.auth.title')}
            description={t('config_management.visual.sections.auth.description')}
          >
            <SectionStack>
              <Input
                label={t('config_management.visual.sections.auth.auth_dir')}
                placeholder="~/.cli-proxy-api"
                value={values.authDir}
                onChange={(e) => onChange({ authDir: e.target.value })}
                disabled={disabled}
                hint={t('config_management.visual.sections.auth.auth_dir_hint')}
              />
              <div className={styles.subsection}>
                <ApiKeysCardEditor
                  value={values.apiKeysText}
                  modelWhitelists={values.apiKeyModelWhitelists}
                  disabled={disabled}
                  onChange={handleApiKeysTextChange}
                  onModelWhitelistsChange={handleApiKeyModelWhitelistsChange}
                />
              </div>

              <SectionSubsection
                title={t('config_management.visual.sections.auth.ip_blacklist_blocked_title')}
                description={t('config_management.visual.sections.auth.ip_blacklist_blocked_desc')}
              >
                <div className={styles.blockHeaderRow}>
                  <div className={styles.fieldHint}>
                    {t('config_management.visual.sections.auth.ip_blacklist_blocked_hint')}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onRefreshBlockedIps}
                    disabled={disabled || blockedIpsLoading || !onRefreshBlockedIps}
                  >
                    {t('config_management.visual.sections.auth.ip_blacklist_refresh')}
                  </Button>
                </div>

                <div className={styles.manualBanRow}>
                  <Input
                    placeholder={t(
                      'config_management.visual.sections.auth.ip_blacklist_input_placeholder'
                    )}
                    value={manualBanIp}
                    onChange={(e) => onManualBanIpChange?.(e.target.value)}
                    disabled={disabled || manualBanPending}
                    className={styles.manualBanInput}
                  />
                  <Button
                    variant="primary"
                    onClick={() => onBanBlockedIp?.(manualBanIp)}
                    disabled={
                      disabled || manualBanPending || !manualBanIp.trim() || !onBanBlockedIp
                    }
                    loading={manualBanPending}
                  >
                    {t('config_management.visual.sections.auth.ip_blacklist_add')}
                  </Button>
                </div>

                {blockedIpsLoading ? (
                  <div className={styles.emptyState}>{t('config_management.status_loading')}</div>
                ) : blockedIps.length === 0 ? (
                  <div className={styles.emptyState}>
                    {t('config_management.visual.sections.auth.ip_blacklist_empty')}
                  </div>
                ) : (
                  <div className="item-list" style={{ marginTop: 4 }}>
                    {blockedIps.map((entry) => (
                      <div key={entry.ip} className="item-row">
                        <div className="item-meta">
                          <div className="pill">IP</div>
                          <div className="item-title">{entry.ip}</div>
                          <div className="item-subtitle">
                            {t('config_management.visual.sections.auth.ip_blacklist_until', {
                              value: formatTimestamp(entry.blockedUntil),
                            })}
                            {' · '}
                            {t('config_management.visual.sections.auth.ip_blacklist_remaining', {
                              value: formatRemaining(entry.remainingBlockSeconds),
                            })}
                            {' · '}
                            {t('config_management.visual.sections.auth.ip_blacklist_attempts', {
                              count: entry.failureCount,
                            })}
                          </div>
                        </div>
                        <div className="item-actions">
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => onUnbanBlockedIp?.(entry.ip)}
                            disabled={disabled || !onUnbanBlockedIp}
                            loading={unbanPendingIp === entry.ip}
                          >
                            {t('config_management.visual.sections.auth.ip_blacklist_unban')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="system"
            data-editor-section
            data-active-section={activeSectionId === 'system' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.system = node;
            }}
            indexLabel="03"
            icon={<IconKey size={16} />}
            title={t('config_management.visual.sections.system.title')}
            description={t('config_management.visual.sections.system.description')}
          >
            <SectionStack>
              <SectionGrid>
                <ToggleRow
                  title={t('config_management.visual.sections.system.debug')}
                  description={t('config_management.visual.sections.system.debug_desc')}
                  checked={values.debug}
                  disabled={disabled}
                  onChange={(debug) => onChange({ debug })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.system.commercial_mode')}
                  description={t('config_management.visual.sections.system.commercial_mode_desc')}
                  checked={values.commercialMode}
                  disabled={disabled}
                  onChange={(commercialMode) => onChange({ commercialMode })}
                />
                <ToggleRow
                  title={t('config_management.visual.sections.system.logging_to_file')}
                  description={t('config_management.visual.sections.system.logging_to_file_desc')}
                  checked={values.loggingToFile}
                  disabled={disabled}
                  onChange={(loggingToFile) => onChange({ loggingToFile })}
                />
              </SectionGrid>

              <SectionGrid>
                <Input
                  label={t('config_management.visual.sections.system.logs_max_size')}
                  type="number"
                  placeholder="0"
                  value={values.logsMaxTotalSizeMb}
                  onChange={(e) => onChange({ logsMaxTotalSizeMb: e.target.value })}
                  disabled={disabled}
                  error={logsMaxSizeError}
                />
              </SectionGrid>

              <SectionSubsection
                title={t('config_management.visual.sections.network.token_threshold_rules_title')}
                description={t(
                  'config_management.visual.sections.network.token_threshold_rules_desc'
                )}
              >
                <TokenThresholdRulesEditor
                  value={values.tokenThresholdRules}
                  disabled={disabled}
                  onChange={(tokenThresholdRules) => onChange({ tokenThresholdRules })}
                />
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="fallback"
            data-editor-section
            data-active-section={activeSectionId === 'fallback' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.fallback = node;
            }}
            indexLabel="04"
            icon={<IconRoute size={16} />}
            title={t('config_management.visual.sections.fallback.title')}
            description={t('config_management.visual.sections.fallback.description')}
          >
            <SectionStack>
              <SectionSubsection
                title={t('config_management.visual.oauth_endpoints.title', {
                  defaultValue: 'OAuth endpoint overrides',
                })}
                description={t('config_management.visual.oauth_endpoints.description', {
                  defaultValue:
                    'Override authorize, token, refresh, userinfo, device authorization, or API base URLs per OAuth provider.',
                })}
              >
                <OauthEndpointOverridesEditor
                  value={values.oauthEndpointOverrides}
                  disabled={disabled}
                  addButtonLabel={t('config_management.visual.oauth_endpoints.add_override', {
                    defaultValue: 'Add override',
                  })}
                  onChange={handleOauthEndpointOverridesChange}
                />
              </SectionSubsection>

              <SectionGrid>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {t('config_management.visual.sections.fallback.models_title')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {t('config_management.visual.sections.fallback.models_hint')}
                  </div>
                  <FallbackModelsEditor
                    value={values.fallbackModels}
                    disabled={disabled}
                    sourcePlaceholder={t(
                      'config_management.visual.sections.fallback.source_placeholder'
                    )}
                    targetPlaceholder={t(
                      'config_management.visual.sections.fallback.target_placeholder'
                    )}
                    addButtonLabel={t('config_management.visual.sections.fallback.add_model')}
                    onChange={handleFallbackModelsChange}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {t('config_management.visual.sections.fallback.chain_title')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {t('config_management.visual.sections.fallback.chain_hint')}
                  </div>
                  <StringListEditor
                    value={values.fallbackChain}
                    disabled={disabled}
                    placeholder={t('config_management.visual.sections.fallback.chain_placeholder')}
                    inputAriaLabel={t(
                      'config_management.visual.sections.fallback.chain_placeholder'
                    )}
                    addButtonLabel={t('config_management.visual.sections.fallback.add_chain')}
                    maxItems={20}
                    maxItemsError={t('config_management.visual.sections.fallback.chain_max_error')}
                    onChange={handleFallbackChainChange}
                  />
                </div>

                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                    {t('config_management.visual.sections.fallback.max_depth_title')}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {t('config_management.visual.sections.fallback.max_depth_hint')}
                  </div>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    step={1}
                    value={values.fallbackMaxDepth}
                    disabled={disabled}
                    placeholder={t(
                      'config_management.visual.sections.fallback.max_depth_placeholder',
                      '3'
                    )}
                    onChange={(event) => handleFallbackMaxDepthChange(event.target.value)}
                  />
                </div>
              </SectionGrid>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="network"
            data-editor-section
            data-active-section={activeSectionId === 'network' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.network = node;
            }}
            indexLabel="06"
            icon={<IconTimer size={16} />}
            title={t('config_management.visual.sections.network.title')}
            description={t('config_management.visual.sections.network.description')}
          >
            <SectionStack>
              <SectionGrid>
                {' '}
                <Input
                  label={t('config_management.visual.sections.system.error_logs_max_files')}
                  type="number"
                  placeholder="10"
                  value={values.errorLogsMaxFiles}
                  onChange={(e) => onChange({ errorLogsMaxFiles: e.target.value })}
                  disabled={disabled}
                  error={errorLogsMaxFilesError}
                />
                <Input
                  label={t('config_management.visual.sections.system.redis_usage_retention')}
                  type="number"
                  placeholder="60"
                  value={values.redisUsageQueueRetentionSeconds}
                  onChange={(e) => onChange({ redisUsageQueueRetentionSeconds: e.target.value })}
                  disabled={disabled}
                  hint={t('config_management.visual.sections.system.redis_usage_retention_hint')}
                  error={redisUsageQueueRetentionError}
                />
              </SectionGrid>

              <SectionSubsection
                title={t('config_management.visual.sections.network.ip_blacklist_title')}
                description={t('config_management.visual.sections.network.ip_blacklist_desc')}
              >
                <SectionGrid>
                  <Input
                    label={t('config_management.visual.sections.network.ip_blacklist_threshold')}
                    type="number"
                    placeholder="3"
                    value={values.apiKeyIpBlacklistFailureThreshold}
                    onChange={(e) =>
                      onChange({ apiKeyIpBlacklistFailureThreshold: e.target.value })
                    }
                    disabled={disabled}
                  />
                  <Input
                    label={t('config_management.visual.sections.network.ip_blacklist_window')}
                    placeholder="10m"
                    value={values.apiKeyIpBlacklistFailureWindow}
                    onChange={(e) => onChange({ apiKeyIpBlacklistFailureWindow: e.target.value })}
                    disabled={disabled}
                    hint={t('config_management.visual.sections.network.ip_blacklist_window_hint')}
                  />
                  <Input
                    label={t('config_management.visual.sections.network.ip_blacklist_duration')}
                    placeholder="24h"
                    value={values.apiKeyIpBlacklistBlockDuration}
                    onChange={(e) => onChange({ apiKeyIpBlacklistBlockDuration: e.target.value })}
                    disabled={disabled}
                    hint={t('config_management.visual.sections.network.ip_blacklist_duration_hint')}
                  />
                </SectionGrid>
              </SectionSubsection>

              <SectionGrid>
                <ToggleRow
                  title={t('config_management.visual.sections.system.usage_statistics_enabled')}
                  description={t(
                    'config_management.visual.sections.system.usage_statistics_enabled_desc'
                  )}
                  checked={values.usageStatisticsEnabled}
                  disabled={disabled}
                  onChange={(usageStatisticsEnabled) => onChange({ usageStatisticsEnabled })}
                />
              </SectionGrid>

              <SectionSubsection
                title={t('config_management.visual.sections.network.title')}
                description={t('config_management.visual.sections.network.description')}
              >
                <SectionStack>
                  <SectionGrid>
                    <Input
                      label={t('config_management.visual.sections.network.proxy_url')}
                      placeholder="socks5://user:pass@127.0.0.1:1080/"
                      value={values.proxyUrl}
                      onChange={(e) => onChange({ proxyUrl: e.target.value })}
                      disabled={disabled}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.request_retry')}
                      type="number"
                      placeholder="3"
                      value={values.requestRetry}
                      onChange={(e) => onChange({ requestRetry: e.target.value })}
                      disabled={disabled}
                      error={requestRetryError}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.max_retry_credentials')}
                      type="number"
                      placeholder="0"
                      value={values.maxRetryCredentials}
                      onChange={(e) => onChange({ maxRetryCredentials: e.target.value })}
                      disabled={disabled}
                      hint={t(
                        'config_management.visual.sections.network.max_retry_credentials_hint'
                      )}
                      error={maxRetryCredentialsError}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.max_retry_interval')}
                      type="number"
                      placeholder="30"
                      value={values.maxRetryInterval}
                      onChange={(e) => onChange({ maxRetryInterval: e.target.value })}
                      disabled={disabled}
                      error={maxRetryIntervalError}
                    />
                    <Input
                      label={t(
                        'config_management.visual.sections.network.auth_auto_refresh_workers'
                      )}
                      type="number"
                      placeholder="16"
                      value={values.authAutoRefreshWorkers}
                      onChange={(e) => onChange({ authAutoRefreshWorkers: e.target.value })}
                      disabled={disabled}
                      hint={t(
                        'config_management.visual.sections.network.auth_auto_refresh_workers_hint'
                      )}
                      error={authAutoRefreshWorkersError}
                    />
                    <FieldShell
                      label={t('config_management.visual.sections.network.routing_strategy')}
                      labelId={routingStrategyLabelId}
                      hint={t('config_management.visual.sections.network.routing_strategy_hint')}
                      hintId={routingStrategyHintId}
                    >
                      <Select
                        value={values.routingStrategy}
                        options={[
                          {
                            value: 'round-robin',
                            label: t(
                              'config_management.visual.sections.network.strategy_round_robin'
                            ),
                          },
                          {
                            value: 'weighted-round-robin',
                            label: t(
                              'config_management.visual.sections.network.strategy_weighted_round_robin'
                            ),
                          },
                          {
                            value: 'fill-first',
                            label: t(
                              'config_management.visual.sections.network.strategy_fill_first'
                            ),
                          },
                          {
                            value: 'weight-robin',
                            label: t(
                              'config_management.visual.sections.network.strategy_weight_robin'
                            ),
                          },
                        ]}
                        id={`${routingStrategyLabelId}-select`}
                        disabled={disabled}
                        ariaLabelledBy={routingStrategyLabelId}
                        ariaDescribedBy={routingStrategyHintId}
                        onChange={(nextValue) =>
                          onChange({
                            routingStrategy: nextValue as VisualConfigValues['routingStrategy'],
                          })
                        }
                      />
                    </FieldShell>
                    <FieldShell
                      label={t('config_management.visual.sections.network.routing_mode')}
                      labelId={routingModeLabelId}
                      hint={t('config_management.visual.sections.network.routing_mode_hint')}
                      hintId={routingModeHintId}
                    >
                      <Select
                        value={values.routingMode}
                        options={[
                          {
                            value: 'provider-based',
                            label: t(
                              'config_management.visual.sections.network.mode_provider_based'
                            ),
                          },
                          {
                            value: 'key-based',
                            label: t('config_management.visual.sections.network.mode_key_based'),
                          },
                        ]}
                        id={`${routingModeLabelId}-select`}
                        disabled={disabled}
                        ariaLabelledBy={routingModeLabelId}
                        ariaDescribedBy={routingModeHintId}
                        onChange={(nextValue) =>
                          onChange({
                            routingMode: nextValue as VisualConfigValues['routingMode'],
                          })
                        }
                      />
                    </FieldShell>
                    {values.routingStrategy === 'weight-robin' && (
                      <>
                        <div
                          style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}
                        >
                          <Link
                            to="/weight-robin-queue"
                            style={{
                              fontSize: 12,
                              fontWeight: 500,
                              textDecoration: 'none',
                            }}
                          >
                            {t('weight_robin_queue.distribution_title')} →
                          </Link>
                        </div>
                        <WeightRobinQueueView />
                      </>
                    )}
                    <FieldShell
                      label={t(
                        'config_management.visual.sections.network.disable_image_generation'
                      )}
                      labelId={disableImageGenerationLabelId}
                      hint={t(
                        'config_management.visual.sections.network.disable_image_generation_hint'
                      )}
                      hintId={disableImageGenerationHintId}
                    >
                      <Select
                        value={values.disableImageGeneration}
                        options={disableImageGenerationOptions}
                        id={`${disableImageGenerationLabelId}-select`}
                        disabled={disabled}
                        ariaLabelledBy={disableImageGenerationLabelId}
                        ariaDescribedBy={disableImageGenerationHintId}
                        onChange={(nextValue) =>
                          onChange({
                            disableImageGeneration:
                              nextValue as VisualConfigValues['disableImageGeneration'],
                          })
                        }
                      />
                    </FieldShell>
                    <Input
                      label={t('config_management.visual.sections.network.gpt_image_2_base_model')}
                      placeholder="gpt-5.4-mini"
                      value={values.gptImage2BaseModel}
                      onChange={(e) => onChange({ gptImage2BaseModel: e.target.value })}
                      disabled={disabled}
                      hint={t(
                        'config_management.visual.sections.network.gpt_image_2_base_model_hint'
                      )}
                    />
                    <Input
                      label={t('config_management.visual.sections.network.session_affinity_ttl')}
                      placeholder="1h"
                      value={values.routingSessionAffinityTTL}
                      onChange={(e) => onChange({ routingSessionAffinityTTL: e.target.value })}
                      disabled={disabled}
                    />
                  </SectionGrid>

                  <SectionGrid>
                    <ToggleRow
                      title={t('config_management.visual.sections.network.force_model_prefix')}
                      description={t(
                        'config_management.visual.sections.network.force_model_prefix_desc'
                      )}
                      checked={values.forceModelPrefix}
                      disabled={disabled}
                      onChange={(forceModelPrefix) => onChange({ forceModelPrefix })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.passthrough_headers')}
                      description={t(
                        'config_management.visual.sections.network.passthrough_headers_desc'
                      )}
                      checked={values.passthroughHeaders}
                      disabled={disabled}
                      onChange={(passthroughHeaders) => onChange({ passthroughHeaders })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.disable_cooling')}
                      description={t(
                        'config_management.visual.sections.network.disable_cooling_desc'
                      )}
                      checked={values.disableCooling}
                      disabled={disabled}
                      onChange={(disableCooling) => onChange({ disableCooling })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.session_affinity')}
                      checked={values.routingSessionAffinity}
                      disabled={disabled}
                      onChange={(routingSessionAffinity) => onChange({ routingSessionAffinity })}
                    />
                    <ToggleRow
                      title={t('config_management.visual.sections.network.ws_auth')}
                      description={t('config_management.visual.sections.network.ws_auth_desc')}
                      checked={values.wsAuth}
                      disabled={disabled}
                      onChange={(wsAuth) => onChange({ wsAuth })}
                    />
                    <ToggleRow
                      title={t(
                        'config_management.visual.sections.network.enable_gemini_cli_endpoint'
                      )}
                      description={t(
                        'config_management.visual.sections.network.enable_gemini_cli_endpoint_desc'
                      )}
                      checked={values.enableGeminiCliEndpoint}
                      disabled={disabled}
                      onChange={(enableGeminiCliEndpoint) => onChange({ enableGeminiCliEndpoint })}
                    />
                  </SectionGrid>
                </SectionStack>
              </SectionSubsection>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="quota"
            data-editor-section
            data-active-section={activeSectionId === 'quota' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.quota = node;
            }}
            indexLabel="04"
            icon={<IconTimer size={16} />}
            title={t('config_management.visual.sections.quota.title')}
            description={t('config_management.visual.sections.quota.description')}
          >
            <SectionGrid>
              <ToggleRow
                title={t('config_management.visual.sections.quota.switch_project')}
                description={t('config_management.visual.sections.quota.switch_project_desc')}
                checked={values.quotaSwitchProject}
                disabled={disabled}
                onChange={(quotaSwitchProject) => onChange({ quotaSwitchProject })}
              />
              <ToggleRow
                title={t('config_management.visual.sections.quota.switch_preview_model')}
                description={t('config_management.visual.sections.quota.switch_preview_model_desc')}
                checked={values.quotaSwitchPreviewModel}
                disabled={disabled}
                onChange={(quotaSwitchPreviewModel) => onChange({ quotaSwitchPreviewModel })}
              />
              <ToggleRow
                title={t('config_management.visual.sections.quota.antigravity_credits')}
                checked={values.quotaAntigravityCredits}
                disabled={disabled}
                onChange={(quotaAntigravityCredits) => onChange({ quotaAntigravityCredits })}
              />
            </SectionGrid>
          </ConfigSection>

          <ConfigSection
            id="streaming"
            data-editor-section
            data-active-section={activeSectionId === 'streaming' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.streaming = node;
            }}
            indexLabel="05"
            icon={<IconSatellite size={16} />}
            title={t('config_management.visual.sections.streaming.title')}
            description={t('config_management.visual.sections.streaming.description')}
          >
            <SectionStack>
              <SectionGrid>
                <FieldShell
                  label={t('config_management.visual.sections.streaming.keepalive_seconds')}
                  htmlFor={keepaliveInputId}
                  hint={t('config_management.visual.sections.streaming.keepalive_hint')}
                  hintId={keepaliveHintId}
                  error={keepaliveError}
                  errorId={keepaliveErrorId}
                >
                  <div className={styles.fieldControl}>
                    <input
                      id={keepaliveInputId}
                      className="input"
                      type="number"
                      placeholder="0"
                      value={values.streaming.keepaliveSeconds}
                      onChange={(e) =>
                        onChange({
                          streaming: {
                            ...values.streaming,
                            keepaliveSeconds: e.target.value,
                          },
                        })
                      }
                      disabled={disabled}
                    />
                    {isKeepaliveDisabled ? (
                      <span className={styles.inlinePill}>
                        {t('config_management.visual.sections.streaming.disabled')}
                      </span>
                    ) : null}
                  </div>
                </FieldShell>

                <Input
                  label={t('config_management.visual.sections.streaming.bootstrap_retries')}
                  type="number"
                  placeholder="1"
                  value={values.streaming.bootstrapRetries}
                  onChange={(e) =>
                    onChange({
                      streaming: {
                        ...values.streaming,
                        bootstrapRetries: e.target.value,
                      },
                    })
                  }
                  disabled={disabled}
                  hint={t('config_management.visual.sections.streaming.bootstrap_hint')}
                  error={bootstrapRetriesError}
                />
              </SectionGrid>

              <SectionGrid>
                <FieldShell
                  label={t('config_management.visual.sections.streaming.nonstream_keepalive')}
                  htmlFor={nonstreamKeepaliveInputId}
                  hint={t('config_management.visual.sections.streaming.nonstream_keepalive_hint')}
                  hintId={nonstreamKeepaliveHintId}
                  error={nonstreamKeepaliveError}
                  errorId={nonstreamKeepaliveErrorId}
                >
                  <div className={styles.fieldControl}>
                    <input
                      id={nonstreamKeepaliveInputId}
                      className="input"
                      type="number"
                      placeholder="0"
                      value={values.streaming.nonstreamKeepaliveInterval}
                      onChange={(e) =>
                        onChange({
                          streaming: {
                            ...values.streaming,
                            nonstreamKeepaliveInterval: e.target.value,
                          },
                        })
                      }
                      disabled={disabled}
                    />
                    {isNonstreamKeepaliveDisabled ? (
                      <span className={styles.inlinePill}>
                        {t('config_management.visual.sections.streaming.disabled')}
                      </span>
                    ) : null}
                  </div>
                </FieldShell>
              </SectionGrid>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="keeperExport"
            data-editor-section
            data-active-section={activeSectionId === 'keeperExport' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.keeperExport = node;
            }}
            indexLabel="08"
            icon={<IconSatellite size={16} />}
            title={t('config_management.visual.sections.keeper_export.title')}
            description={t('config_management.visual.sections.keeper_export.description')}
          >
            <KeeperExportSection
              values={values.keeperExport}
              validationErrors={keeperExportValidationErrors}
              usageStatisticsEnabled={values.usageStatisticsEnabled}
              disabled={disabled}
              onChange={(keeperExport) => onChange({ keeperExport })}
            />
          </ConfigSection>

          <ConfigSection
            id="advanced"
            data-editor-section
            data-active-section={activeSectionId === 'advanced' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.advanced = node;
            }}
            indexLabel="06"
            icon={<IconShield size={16} />}
            title={t('config_management.visual.sections.advanced.title')}
            description={t('config_management.visual.sections.advanced.description')}
          >
            <SectionStack>
              <Collapsible
                label={t('config_management.visual.sections.advanced.plugins_title')}
                defaultOpen={false}
              >
                <SectionStack>
                  <SectionGrid>
                    <FieldAnchor fieldId="pluginsEnabled">
                      <ToggleRow
                        title={t('config_management.visual.sections.system.plugins_enabled')}
                        description={t(
                          'config_management.visual.sections.system.plugins_enabled_desc'
                        )}
                        checked={values.pluginsEnabled}
                        disabled={disabled}
                        onChange={(pluginsEnabled) => onChange({ pluginsEnabled })}
                      />
                    </FieldAnchor>
                  </SectionGrid>

                  <FieldAnchor fieldId="pluginStoreSources">
                    <SectionSubsection
                      title={t('config_management.visual.sections.system.plugin_store_sources')}
                      description={t(
                        'config_management.visual.sections.system.plugin_store_sources_desc'
                      )}
                    >
                      <div className={styles.fieldShell}>
                        <label className={styles.fieldLabel}>
                          {t('config_management.visual.sections.system.plugin_store_sources_label')}
                        </label>
                        <StringListEditor
                          value={values.pluginStoreSources}
                          disabled={disabled}
                          placeholder={t(
                            'config_management.visual.sections.system.plugin_store_sources_placeholder'
                          )}
                          inputAriaLabel={t(
                            'config_management.visual.sections.system.plugin_store_sources_label'
                          )}
                          onChange={handlePluginStoreSourcesChange}
                        />
                        <div className={styles.fieldHint}>
                          {t('config_management.visual.sections.system.plugin_store_sources_hint')}
                        </div>
                      </div>
                    </SectionSubsection>
                  </FieldAnchor>

                  <FieldAnchor fieldId="pluginStoreAuth">
                    <SectionSubsection
                      title={t('config_management.visual.sections.system.plugin_store_auth')}
                      description={t(
                        'config_management.visual.sections.system.plugin_store_auth_desc'
                      )}
                    >
                      <div className={styles.fieldShell}>
                        <div className={styles.fieldHint}>
                          {t('config_management.visual.sections.system.plugin_store_auth_hint')}
                        </div>
                        <PluginStoreAuthEditor
                          value={values.pluginStoreAuth}
                          disabled={disabled}
                          onChange={handlePluginStoreAuthChange}
                        />
                      </div>
                    </SectionSubsection>
                  </FieldAnchor>
                </SectionStack>
              </Collapsible>

              <Collapsible
                label={t('config_management.visual.sections.advanced.signature_title')}
                defaultOpen={false}
              >
                <SectionGrid>
                  <FieldAnchor fieldId="antigravitySignatureCacheEnabled">
                    <ToggleRow
                      title={t(
                        'config_management.visual.sections.system.antigravity_signature_cache'
                      )}
                      description={t(
                        'config_management.visual.sections.system.antigravity_signature_cache_desc'
                      )}
                      checked={values.antigravitySignatureCacheEnabled}
                      disabled={disabled}
                      onChange={(antigravitySignatureCacheEnabled) =>
                        onChange({ antigravitySignatureCacheEnabled })
                      }
                    />
                  </FieldAnchor>
                  <FieldAnchor fieldId="antigravitySignatureBypassStrict">
                    <ToggleRow
                      title={t(
                        'config_management.visual.sections.system.antigravity_signature_strict'
                      )}
                      description={t(
                        'config_management.visual.sections.system.antigravity_signature_strict_desc'
                      )}
                      checked={values.antigravitySignatureBypassStrict}
                      disabled={disabled}
                      onChange={(antigravitySignatureBypassStrict) =>
                        onChange({ antigravitySignatureBypassStrict })
                      }
                    />
                  </FieldAnchor>
                </SectionGrid>
              </Collapsible>

              <Collapsible
                label={t('config_management.visual.sections.headers.title')}
                hint={t('config_management.visual.sections.headers.description')}
                defaultOpen={false}
              >
                <SectionStack>
                  <div className={styles.subsectionHeader}>
                    <h3 className={styles.subsectionTitle}>
                      {t('config_management.visual.sections.headers.claude_title')}
                    </h3>
                  </div>
                  <SectionGrid>
                    <FieldAnchor fieldId="claudeHeaderUserAgent">
                      <Input
                        label={t('config_management.visual.sections.headers.user_agent')}
                        placeholder="claude-cli/2.1.44 (external, sdk-cli)"
                        value={values.claudeHeaderUserAgent}
                        onChange={(e) => onChange({ claudeHeaderUserAgent: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                    <FieldAnchor fieldId="claudeHeaderPackageVersion">
                      <Input
                        label={t('config_management.visual.sections.headers.package_version')}
                        placeholder="0.74.0"
                        value={values.claudeHeaderPackageVersion}
                        onChange={(e) => onChange({ claudeHeaderPackageVersion: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                    <FieldAnchor fieldId="claudeHeaderRuntimeVersion">
                      <Input
                        label={t('config_management.visual.sections.headers.runtime_version')}
                        placeholder="v24.3.0"
                        value={values.claudeHeaderRuntimeVersion}
                        onChange={(e) => onChange({ claudeHeaderRuntimeVersion: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                    <FieldAnchor fieldId="claudeHeaderOs">
                      <Input
                        label={t('config_management.visual.sections.headers.os')}
                        placeholder="MacOS"
                        value={values.claudeHeaderOs}
                        onChange={(e) => onChange({ claudeHeaderOs: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                    <FieldAnchor fieldId="claudeHeaderArch">
                      <Input
                        label={t('config_management.visual.sections.headers.arch')}
                        placeholder="arm64"
                        value={values.claudeHeaderArch}
                        onChange={(e) => onChange({ claudeHeaderArch: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                    <FieldAnchor fieldId="claudeHeaderTimeout">
                      <Input
                        label={t('config_management.visual.sections.headers.timeout')}
                        placeholder="600"
                        value={values.claudeHeaderTimeout}
                        onChange={(e) => onChange({ claudeHeaderTimeout: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                  </SectionGrid>
                  <SectionGrid>
                    <FieldAnchor fieldId="claudeHeaderStabilizeDeviceProfile">
                      <ToggleRow
                        title={t('config_management.visual.sections.headers.stabilize_device')}
                        description={t(
                          'config_management.visual.sections.headers.stabilize_device_desc'
                        )}
                        checked={values.claudeHeaderStabilizeDeviceProfile}
                        disabled={disabled}
                        onChange={(claudeHeaderStabilizeDeviceProfile) =>
                          onChange({ claudeHeaderStabilizeDeviceProfile })
                        }
                      />
                    </FieldAnchor>
                  </SectionGrid>
                  <Divider />
                  <div className={styles.subsectionHeader}>
                    <h3 className={styles.subsectionTitle}>
                      {t('config_management.visual.sections.headers.codex_title')}
                    </h3>
                  </div>
                  <SectionGrid>
                    <FieldAnchor fieldId="codexHeaderUserAgent">
                      <Input
                        label={t('config_management.visual.sections.headers.user_agent')}
                        placeholder="codex_cli_rs/0.114.0 (Mac OS 14.2.0; x86_64) vscode/1.111.0"
                        value={values.codexHeaderUserAgent}
                        onChange={(e) => onChange({ codexHeaderUserAgent: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                    <FieldAnchor fieldId="codexHeaderBetaFeatures">
                      <Input
                        label={t('config_management.visual.sections.headers.beta_features')}
                        placeholder="multi_agent"
                        value={values.codexHeaderBetaFeatures}
                        onChange={(e) => onChange({ codexHeaderBetaFeatures: e.target.value })}
                        disabled={disabled}
                      />
                    </FieldAnchor>
                  </SectionGrid>
                </SectionStack>
              </Collapsible>
            </SectionStack>
          </ConfigSection>

          <ConfigSection
            id="payload"
            data-editor-section
            data-active-section={activeSectionId === 'payload' ? 'true' : 'false'}
            ref={(node) => {
              sectionRefs.current.payload = node;
            }}
            indexLabel="07"
            icon={<IconCode size={16} />}
            title={t('config_management.visual.sections.payload.title')}
            description={t('config_management.visual.sections.payload.description')}
          >
            <SectionStack>
              <FieldAnchor fieldId="payloadDefaultRules">
                <Collapsible
                  key={`payloadDefaultRules-${payloadValidationKey}`}
                  label={t('config_management.visual.sections.payload.default_rules')}
                  hint={t('config_management.visual.sections.payload.default_rules_desc')}
                  defaultOpen={hasPayloadValidationErrors}
                >
                  <PayloadRulesEditor
                    value={values.payloadDefaultRules}
                    disabled={disabled}
                    onChange={handlePayloadDefaultRulesChange}
                  />
                </Collapsible>
              </FieldAnchor>

              <FieldAnchor fieldId="payloadDefaultRawRules">
                <Collapsible
                  key={`payloadDefaultRawRules-${payloadValidationKey}`}
                  label={t('config_management.visual.sections.payload.default_raw_rules')}
                  hint={t('config_management.visual.sections.payload.default_raw_rules_desc')}
                  defaultOpen={hasPayloadValidationErrors}
                >
                  <PayloadRulesEditor
                    value={values.payloadDefaultRawRules}
                    disabled={disabled}
                    rawJsonValues
                    onChange={handlePayloadDefaultRawRulesChange}
                  />
                </Collapsible>
              </FieldAnchor>

              <FieldAnchor fieldId="payloadOverrideRules">
                <Collapsible
                  key={`payloadOverrideRules-${payloadValidationKey}`}
                  label={t('config_management.visual.sections.payload.override_rules')}
                  hint={t('config_management.visual.sections.payload.override_rules_desc')}
                  defaultOpen={hasPayloadValidationErrors}
                >
                  <PayloadRulesEditor
                    value={values.payloadOverrideRules}
                    disabled={disabled}
                    protocolFirst
                    onChange={handlePayloadOverrideRulesChange}
                  />
                </Collapsible>
              </FieldAnchor>

              <FieldAnchor fieldId="payloadOverrideRawRules">
                <Collapsible
                  key={`payloadOverrideRawRules-${payloadValidationKey}`}
                  label={t('config_management.visual.sections.payload.override_raw_rules')}
                  hint={t('config_management.visual.sections.payload.override_raw_rules_desc')}
                  defaultOpen={hasPayloadValidationErrors}
                >
                  <PayloadRulesEditor
                    value={values.payloadOverrideRawRules}
                    disabled={disabled}
                    protocolFirst
                    rawJsonValues
                    onChange={handlePayloadOverrideRawRulesChange}
                  />
                </Collapsible>
              </FieldAnchor>

              <FieldAnchor fieldId="payloadFilterRules">
                <Collapsible
                  key={`payloadFilterRules-${payloadValidationKey}`}
                  label={t('config_management.visual.sections.payload.filter_rules')}
                  hint={t('config_management.visual.sections.payload.filter_rules_desc')}
                  defaultOpen={hasPayloadValidationErrors}
                >
                  <PayloadFilterRulesEditor
                    value={values.payloadFilterRules}
                    disabled={disabled}
                    onChange={handlePayloadFilterRulesChange}
                  />
                </Collapsible>
              </FieldAnchor>
            </SectionStack>
          </ConfigSection>
        </div>
      </div>
    </div>
  );
}
