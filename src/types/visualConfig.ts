export type PayloadParamValueType = 'string' | 'number' | 'boolean' | 'json';
export type DisableImageGenerationMode = 'false' | 'true' | 'chat';
export type PayloadParamValidationErrorCode =
  | 'payload_invalid_number'
  | 'payload_invalid_boolean'
  | 'payload_invalid_json';

export type OauthEndpointOverrideEntry = {
  id: string;
  provider: string;
  apiBaseUrl: string;
  authorizeUrl: string;
  tokenUrl: string;
  refreshUrl: string;
  userinfoUrl: string;
  deviceAuthorizeUrl: string;
};

export type VisualConfigFieldPath =
  | 'port'
  | 'errorLogsMaxFiles'
  | 'logsMaxTotalSizeMb'
  | 'redisUsageQueueRetentionSeconds'
  | 'requestRetry'
  | 'maxRetryCredentials'
  | 'maxRetryInterval'
  | 'authAutoRefreshWorkers'
  | 'streaming.keepaliveSeconds'
  | 'streaming.bootstrapRetries'
  | 'streaming.nonstreamKeepaliveInterval';

export type VisualConfigValidationErrorCode = 'port_range' | 'non_negative_integer';

export type BillingClass = 'metered' | 'per-request';

export type TokenThresholdRule = {
	id: string;
	modelPattern: string;
	minTokens?: string;
	maxTokens?: string;
	billingClass: BillingClass;
	enabled: boolean;
};

export type VisualConfigValidationErrors = Partial<
  Record<VisualConfigFieldPath, VisualConfigValidationErrorCode>
>;

export type PayloadParamEntry = {
  id: string;
  path: string;
  valueType: PayloadParamValueType;
  value: string;
};

export type PayloadHeaderEntry = {
  id: string;
  name: string;
  value: string;
};

export type PayloadModelEntry = {
  id: string;
  name: string;
  protocol?: string;
  fromProtocol?: string;
  headers?: PayloadHeaderEntry[];
  match?: PayloadParamEntry[];
  notMatch?: PayloadParamEntry[];
  exist?: string[];
  notExist?: string[];
};

export type PayloadRule = {
  id: string;
  models: PayloadModelEntry[];
  params: PayloadParamEntry[];
};

export type PayloadFilterRule = {
  id: string;
  models: PayloadModelEntry[];
  params: string[];
};

export type APIKeyBlacklistEntry = {
  ip: string;
  failureCount: number;
  lastFailureAt?: string;
  blockedUntil?: string;
  remainingBlockSeconds: number;
};

export interface StreamingConfig {
  keepaliveSeconds: string;
  bootstrapRetries: string;
  nonstreamKeepaliveInterval: string;
}

export type VisualConfigValues = {
  host: string;
  port: string;
  tlsEnable: boolean;
  tlsCert: string;
  tlsKey: string;
  rmAllowRemote: boolean;
  rmSecretKey: string;
  rmDisableControlPanel: boolean;
  rmDisableAutoUpdatePanel: boolean;
  rmPanelRepo: string;
  authDir: string;
  apiKeysText: string;
  debug: boolean;
  commercialMode: boolean;
  loggingToFile: boolean;
  logsMaxTotalSizeMb: string;
  errorLogsMaxFiles: string;
  usageStatisticsEnabled: boolean;
  redisUsageQueueRetentionSeconds: string;
  proxyUrl: string;
  forceModelPrefix: boolean;
  passthroughHeaders: boolean;
  requestRetry: string;
  maxRetryCredentials: string;
  maxRetryInterval: string;
  disableCooling: boolean;
  disableImageGeneration: DisableImageGenerationMode;
  authAutoRefreshWorkers: string;
  quotaSwitchProject: boolean;
  quotaSwitchPreviewModel: boolean;
  quotaAntigravityCredits: boolean;
  routingStrategy: 'round-robin' | 'fill-first' | 'weight-robin';
  routingMode: 'provider-based' | 'key-based';
  tokenThresholdRules: TokenThresholdRule[];
  fallbackModels: Record<string, string>;
  fallbackChain: string[];
  routingSessionAffinity: boolean;
  routingSessionAffinityTTL: string;
  wsAuth: boolean;
  apiKeyIpBlacklistFailureThreshold: string;
  apiKeyIpBlacklistFailureWindow: string;
  apiKeyIpBlacklistBlockDuration: string;
  enableGeminiCliEndpoint: boolean;
  antigravitySignatureCacheEnabled: boolean;
  antigravitySignatureBypassStrict: boolean;
  claudeHeaderUserAgent: string;
  claudeHeaderPackageVersion: string;
  claudeHeaderRuntimeVersion: string;
  claudeHeaderOs: string;
  claudeHeaderArch: string;
  claudeHeaderTimeout: string;
  claudeHeaderStabilizeDeviceProfile: boolean;
  codexHeaderUserAgent: string;
  codexHeaderBetaFeatures: string;
  payloadDefaultRules: PayloadRule[];
  payloadDefaultRawRules: PayloadRule[];
  payloadOverrideRules: PayloadRule[];
  payloadOverrideRawRules: PayloadRule[];
  payloadFilterRules: PayloadFilterRule[];
  streaming: StreamingConfig;
  oauthEndpointOverrides: OauthEndpointOverrideEntry[];
};

export const makeClientId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const DEFAULT_VISUAL_VALUES: VisualConfigValues = {
  host: '',
  port: '',
  tlsEnable: false,
  tlsCert: '',
  tlsKey: '',
  rmAllowRemote: false,
  rmSecretKey: '',
  rmDisableControlPanel: false,
  rmDisableAutoUpdatePanel: false,
  rmPanelRepo: '',
  authDir: '',
  apiKeysText: '',
  debug: false,
  commercialMode: false,
  loggingToFile: false,
  logsMaxTotalSizeMb: '',
  errorLogsMaxFiles: '',
  usageStatisticsEnabled: false,
  redisUsageQueueRetentionSeconds: '',
  proxyUrl: '',
  forceModelPrefix: false,
  passthroughHeaders: false,
  requestRetry: '',
  maxRetryCredentials: '',
  maxRetryInterval: '',
  disableCooling: false,
  disableImageGeneration: 'false',
  authAutoRefreshWorkers: '',
  quotaSwitchProject: true,
  quotaSwitchPreviewModel: true,
  quotaAntigravityCredits: false,
  routingStrategy: 'round-robin',
  routingMode: 'provider-based',
  tokenThresholdRules: [],
  fallbackModels: {},
  fallbackChain: [],
  routingSessionAffinity: false,
  routingSessionAffinityTTL: '',
  wsAuth: false,
  apiKeyIpBlacklistFailureThreshold: '',
  apiKeyIpBlacklistFailureWindow: '',
  apiKeyIpBlacklistBlockDuration: '',
  enableGeminiCliEndpoint: false,
  antigravitySignatureCacheEnabled: true,
  antigravitySignatureBypassStrict: false,
  claudeHeaderUserAgent: '',
  claudeHeaderPackageVersion: '',
  claudeHeaderRuntimeVersion: '',
  claudeHeaderOs: '',
  claudeHeaderArch: '',
  claudeHeaderTimeout: '',
  claudeHeaderStabilizeDeviceProfile: false,
  codexHeaderUserAgent: '',
  codexHeaderBetaFeatures: '',
  payloadDefaultRules: [],
  payloadDefaultRawRules: [],
  payloadOverrideRules: [],
  payloadOverrideRawRules: [],
  payloadFilterRules: [],
  streaming: {
    keepaliveSeconds: '',
    bootstrapRetries: '',
    nonstreamKeepaliveInterval: '',
  },
  oauthEndpointOverrides: [],
};
