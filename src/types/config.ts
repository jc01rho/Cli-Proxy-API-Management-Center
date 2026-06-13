/**
 * 配置相关类型定义
 * 与基线 /config 返回结构保持一致（内部使用驼峰形式）
 */

import type { GeminiKeyConfig, ProviderKeyConfig, OpenAIProviderConfig } from './provider';
import type { AmpcodeConfig } from './ampcode';

export interface QuotaExceededConfig {
  switchProject?: boolean;
  switchPreviewModel?: boolean;
  antigravityCredits?: boolean;
}

export interface Config {
  debug?: boolean;
  proxyUrl?: string;
  requestRetry?: number;
  quotaExceeded?: QuotaExceededConfig;
  requestLog?: boolean;
  requestLogSuccessBody?: boolean;
  detailedAPIErrorBodyLogLimit?: number;
  loggingToFile?: boolean;
  logsMaxTotalSizeMb?: number;
  wsAuth?: boolean;
  forceModelPrefix?: boolean;
  routingStrategy?: string;
  routingMode?: string;
  tokenThresholdRules?: Array<{
    modelPattern?: string;
    minTokens?: number;
    maxTokens?: number;
    billingClass: 'metered' | 'per-request';
    enabled?: boolean;
  }>;
  fallbackModels?: Record<string, string>;
  fallbackChain?: string[];
  fallbackMaxDepth?: number;
  apiKeys?: string[];
  ampcode?: AmpcodeConfig;
  geminiApiKeys?: GeminiKeyConfig[];
  codexApiKeys?: ProviderKeyConfig[];
  claudeApiKeys?: ProviderKeyConfig[];
  vertexApiKeys?: ProviderKeyConfig[];
  openaiCompatibility?: OpenAIProviderConfig[];
  commandcodeApiKeys?: ProviderKeyConfig[];
  mistralApiKeys?: ProviderKeyConfig[];
  mimoCodeApiKeys?: ProviderKeyConfig[];
   oauthExcludedModels?: Record<string, string[]>;
   oauthEndpointOverrides?: Record<string, Record<string, string>>;
   raw?: Record<string, unknown>;
}

export type RawConfigSection =
  | 'debug'
  | 'proxy-url'
  | 'request-retry'
  | 'quota-exceeded'
  | 'request-log'
  | 'request-log-success-body'
  | 'detailed-api-error-body-log-limit'
  | 'logging-to-file'
  | 'logs-max-total-size-mb'
  | 'ws-auth'
  | 'force-model-prefix'
  | 'routing/strategy'
  | 'routing/token-threshold-rules'
  | 'api-keys'
  | 'ampcode'
  | 'gemini-api-key'
  | 'codex-api-key'
  | 'claude-api-key'
  | 'vertex-api-key'
  | 'openai-compatibility'
  | 'commandcode-api-key'
  | 'mistral-api-key'
  | 'mimo-code-api-key'
  | 'oauth-excluded-models'
  | 'oauth-endpoint-overrides';

export interface ConfigCache {
  data: Config;
  timestamp: number;
}
