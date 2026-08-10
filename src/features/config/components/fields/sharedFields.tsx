// 8 个高频字段的唯一渲染源：SectionCommon（常用 tab）与各正典分区共用这些组件，
// 两处渲染结构性不可能漂移（旧简单模式靠共享 JSX 常量达成同一目的）。
// 注意：只挂载激活 tab，所以 FieldAnchor 的 DOM id 不会重复。

import { useTranslation } from 'react-i18next';
import {
  FallbackModelsEditor,
  ApiKeysCardEditor,
  OauthEndpointOverridesEditor,
  StringListEditor,
  TokenThresholdRulesEditor,
} from '@/components/config/VisualConfigEditorBlocks';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { VisualConfigValues } from '@/types/visualConfig';
import { FieldAnchor, FieldGroup, FieldShell, FieldStack, ToggleRow } from './FieldPrimitives';

export type SharedFieldProps = {
  values: VisualConfigValues;
  disabled: boolean;
  onChange: (patch: Partial<VisualConfigValues>) => void;
};

export function HostField({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="host">
      <Input
        label={t('config_management.visual.sections.server.host')}
        placeholder="0.0.0.0"
        value={values.host}
        onChange={(e) => onChange({ host: e.target.value })}
        disabled={disabled}
      />
    </FieldAnchor>
  );
}

export function PortField({
  values,
  disabled,
  onChange,
  error,
}: SharedFieldProps & { error?: string }) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="port">
      <Input
        label={t('config_management.visual.sections.server.port')}
        type="number"
        placeholder="8317"
        value={values.port}
        onChange={(e) => onChange({ port: e.target.value })}
        disabled={disabled}
        error={error}
      />
    </FieldAnchor>
  );
}

export function ProxyUrlField({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="proxyUrl">
      <Input
        label={t('config_management.visual.sections.network.proxy_url')}
        placeholder="socks5://user:pass@127.0.0.1:1080/"
        value={values.proxyUrl}
        onChange={(e) => onChange({ proxyUrl: e.target.value })}
        disabled={disabled}
      />
    </FieldAnchor>
  );
}

export function ApiKeysField({ values, disabled, onChange }: SharedFieldProps) {
  return (
    <FieldAnchor fieldId="apiKeys">
      <FieldGroup>
        <ApiKeysCardEditor
          value={values.apiKeysText}
          modelWhitelists={values.apiKeyModelWhitelists}
          disabled={disabled}
          onChange={(apiKeysText) => onChange({ apiKeysText })}
          onModelWhitelistsChange={(apiKeyModelWhitelists) =>
            onChange({ apiKeyModelWhitelists })
          }
        />
      </FieldGroup>
    </FieldAnchor>
  );
}

export function DebugToggle({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="debug">
      <ToggleRow
        title={t('config_management.visual.sections.system.debug')}
        description={t('config_management.visual.sections.system.debug_desc')}
        checked={values.debug}
        disabled={disabled}
        onChange={(debug) => onChange({ debug })}
      />
    </FieldAnchor>
  );
}

export function LoggingToFileToggle({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="loggingToFile">
      <ToggleRow
        title={t('config_management.visual.sections.system.logging_to_file')}
        description={t('config_management.visual.sections.system.logging_to_file_desc')}
        checked={values.loggingToFile}
        disabled={disabled}
        onChange={(loggingToFile) => onChange({ loggingToFile })}
      />
    </FieldAnchor>
  );
}

export function QuotaSwitchProjectToggle({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="quotaSwitchProject">
      <ToggleRow
        title={t('config_management.visual.sections.quota.switch_project')}
        description={t('config_management.visual.sections.quota.switch_project_desc')}
        checked={values.quotaSwitchProject}
        disabled={disabled}
        onChange={(quotaSwitchProject) => onChange({ quotaSwitchProject })}
      />
    </FieldAnchor>
  );
}

export function QuotaSwitchPreviewModelToggle({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldAnchor fieldId="quotaSwitchPreviewModel">
      <ToggleRow
        title={t('config_management.visual.sections.quota.switch_preview_model')}
        description={t('config_management.visual.sections.quota.switch_preview_model_desc')}
        checked={values.quotaSwitchPreviewModel}
        disabled={disabled}
        onChange={(quotaSwitchPreviewModel) => onChange({ quotaSwitchPreviewModel })}
      />
    </FieldAnchor>
  );
}

export function ForkOnlyFields({ values, disabled, onChange }: SharedFieldProps) {
  const { t } = useTranslation();

  return (
    <FieldStack>
      <FieldAnchor fieldId="routingMode">
        <FieldShell
          label={t('config_management.visual.sections.network.routing_mode')}
          hint={t('config_management.visual.sections.network.routing_mode_hint')}
        >
          <Select
            value={values.routingMode}
            options={[
              {
                value: 'provider',
                label: t('config_management.visual.sections.network.mode_provider_based'),
              },
              {
                value: 'key',
                label: t('config_management.visual.sections.network.mode_key_based'),
              },
            ]}
            disabled={disabled}
            onChange={(routingMode) =>
              onChange({ routingMode: routingMode as VisualConfigValues['routingMode'] })
            }
          />
        </FieldShell>
      </FieldAnchor>

      <FieldAnchor fieldId="tokenThresholdRules">
        <FieldGroup
          title={t('config_management.visual.sections.network.token_threshold_rules_title')}
          description={t('config_management.visual.sections.network.token_threshold_rules_desc')}
        >
          <TokenThresholdRulesEditor
            value={values.tokenThresholdRules}
            disabled={disabled}
            onChange={(tokenThresholdRules) => onChange({ tokenThresholdRules })}
          />
        </FieldGroup>
      </FieldAnchor>

      <FieldAnchor fieldId="fallbackModels">
        <FieldGroup title={t('config_management.visual.sections.fallback.models_title')}>
          <FallbackModelsEditor
            value={values.fallbackModels}
            disabled={disabled}
            onChange={(fallbackModels) => onChange({ fallbackModels })}
          />
        </FieldGroup>
      </FieldAnchor>

      <FieldAnchor fieldId="fallbackChain">
        <FieldGroup title={t('config_management.visual.sections.fallback.chain_title')}>
          <StringListEditor
            value={values.fallbackChain}
            disabled={disabled}
            onChange={(fallbackChain) => onChange({ fallbackChain })}
          />
        </FieldGroup>
      </FieldAnchor>

      <FieldAnchor fieldId="fallbackMaxDepth">
        <Input
          label={t('config_management.visual.sections.fallback.max_depth_title')}
          type="number"
          min={0}
          value={values.fallbackMaxDepth}
          disabled={disabled}
          onChange={(event) => onChange({ fallbackMaxDepth: event.target.value })}
        />
      </FieldAnchor>

      <FieldAnchor fieldId="oauthEndpointOverrides">
        <FieldGroup title={t('config_management.visual.sections.advanced.title')}>
          <OauthEndpointOverridesEditor
            value={values.oauthEndpointOverrides}
            disabled={disabled}
            onChange={(oauthEndpointOverrides) => onChange({ oauthEndpointOverrides })}
          />
        </FieldGroup>
      </FieldAnchor>

      <FieldAnchor fieldId="enableGeminiCliEndpoint">
        <ToggleRow
          title={t('config_management.visual.sections.network.enable_gemini_cli_endpoint')}
          description={t(
            'config_management.visual.sections.network.enable_gemini_cli_endpoint_desc'
          )}
          checked={values.enableGeminiCliEndpoint}
          disabled={disabled}
          onChange={(enableGeminiCliEndpoint) => onChange({ enableGeminiCliEndpoint })}
        />
      </FieldAnchor>

      <FieldAnchor fieldId="apiKeyIpBlacklist">
        <FieldGroup title={t('config_management.visual.sections.auth.ip_blacklist_blocked_title')}>
          <Input
            label="Failure threshold"
            type="number"
            min={0}
            value={values.apiKeyIpBlacklistFailureThreshold}
            disabled={disabled}
            onChange={(event) =>
              onChange({ apiKeyIpBlacklistFailureThreshold: event.target.value })
            }
          />
          <Input
            label="Failure window"
            value={values.apiKeyIpBlacklistFailureWindow}
            disabled={disabled}
            onChange={(event) => onChange({ apiKeyIpBlacklistFailureWindow: event.target.value })}
          />
          <Input
            label="Block duration"
            value={values.apiKeyIpBlacklistBlockDuration}
            disabled={disabled}
            onChange={(event) => onChange({ apiKeyIpBlacklistBlockDuration: event.target.value })}
          />
        </FieldGroup>
      </FieldAnchor>
    </FieldStack>
  );
}
