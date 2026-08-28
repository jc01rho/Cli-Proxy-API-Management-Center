import type {
  ApiKeyEntry,
  CloakConfig,
  GeminiKeyConfig,
  ModelAlias,
  OpenAIProviderConfig,
  ProviderKeyConfig,
} from '@/types';
import type { Config } from '@/types/config';
import { buildHeaderObject } from '@/utils/headers';
import { isRecord } from '@/utils/helpers';
import { readCredentialWeight } from '@/utils/credentialWeight';

const normalizeBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(trimmed)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(trimmed)) return false;
  }
  return Boolean(value);
};

const normalizeRecord = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? value : undefined;

const normalizeModelAliases = (models: unknown): ModelAlias[] => {
  if (!Array.isArray(models)) return [];
  return models
    .map((item) => {
      if (item === undefined || item === null) return null;
      if (typeof item === 'string') {
        const trimmed = item.trim();
        return trimmed ? ({ name: trimmed } satisfies ModelAlias) : null;
      }
      if (!isRecord(item)) return null;

      const name = item.name || item.id || item.model;
      if (!name) return null;
      const alias = item.alias || item.display_name || item.displayName;
      const priority = item.priority ?? item['priority'];
      const testModel = item['test-model'] ?? item.testModel;
      const image = normalizeBoolean(item.image);
      const thinking = normalizeRecord(item.thinking);
      const entry: ModelAlias = { name: String(name) };
      if (alias && alias !== name) {
        entry.alias = String(alias);
      }
      if (priority !== undefined) {
        const parsed = Number(priority);
        if (Number.isFinite(parsed)) {
          entry.priority = parsed;
        }
      }
      if (testModel) {
        entry.testModel = String(testModel);
      }
      if (image !== undefined) {
        entry.image = image;
      }
      if (thinking) {
        entry.thinking = thinking;
      }
      return entry;
    })
    .filter(Boolean) as ModelAlias[];
};

const normalizeHeaders = (headers: unknown) => {
  if (!headers || typeof headers !== 'object') return undefined;
  const normalized = buildHeaderObject(
    Array.isArray(headers)
      ? (headers as Array<{ key: string; value: string }>)
      : (headers as Record<string, string | undefined | null>)
  );
  return Object.keys(normalized).length ? normalized : undefined;
};

const normalizeExcludedModels = (input: unknown): string[] => {
  const rawList = Array.isArray(input)
    ? input
    : typeof input === 'string'
      ? input.split(/[\n,]/)
      : [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  rawList.forEach((item) => {
    const trimmed = String(item ?? '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(trimmed);
  });

  return normalized;
};

const normalizePrefix = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
};

const normalizeAuthIndex = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
};

const normalizeApiKeyEntry = (entry: unknown): ApiKeyEntry | null => {
  if (entry === undefined || entry === null) return null;
  const record = isRecord(entry) ? entry : null;
  const apiKey =
    record?.['api-key'] ?? record?.apiKey ?? record?.key ?? (typeof entry === 'string' ? entry : '');
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) return null;

  const proxyUrl = record ? record['proxy-url'] ?? record.proxyUrl : undefined;
  const weight = readCredentialWeight(record?.weight);
  const authIndex = normalizeAuthIndex(
    record?.['auth-index'] ?? record?.authIndex ?? record?.['auth_index']
  );
  const comment = record ? record.comment ?? record['comment'] : undefined;

  const result: ApiKeyEntry = {
    apiKey: trimmed,
    proxyUrl: proxyUrl ? String(proxyUrl) : undefined,
  };
  if (weight !== undefined) result.weight = weight;
  if (authIndex) result.authIndex = authIndex;
  if (comment) result.comment = String(comment);
  return result;
};

const normalizeProviderKeyConfig = (item: unknown): ProviderKeyConfig | null => {
  if (item === undefined || item === null) return null;
  const record = isRecord(item) ? item : null;
  const apiKey = record?.['api-key'] ?? record?.apiKey ?? (typeof item === 'string' ? item : '');
  const trimmed = String(apiKey || '').trim();
  const apiKeyEntriesRaw = record?.['api-key-entries'] ?? record?.apiKeyEntries;
  const apiKeyEntries = Array.isArray(apiKeyEntriesRaw)
    ? apiKeyEntriesRaw
        .map((entry) => normalizeApiKeyEntry(entry))
        .filter((entry): entry is ApiKeyEntry => entry !== null)
    : [];
  if (!trimmed && apiKeyEntries.length === 0) return null;

  const config: ProviderKeyConfig = { apiKey: trimmed };
  if (apiKeyEntries.length) config.apiKeyEntries = apiKeyEntries;
  const weight = readCredentialWeight(record?.weight);
  if (weight !== undefined) config.weight = weight;
  const priority = record?.priority ?? record?.['priority'];
  if (priority !== undefined && priority !== null && String(priority).trim() !== '') {
    const parsed = Number(priority);
    if (Number.isFinite(parsed)) {
      config.priority = parsed;
    }
  }
  const billingClass = record?.['billing-class'] ?? record?.billingClass;
  if (billingClass === 'metered' || billingClass === 'per-request' || billingClass === 'per_request') {
    config.billingClass = billingClass === 'per_request' ? 'per-request' : billingClass;
  }
  const prefix = normalizePrefix(record?.prefix ?? record?.['prefix']);
  if (prefix) config.prefix = prefix;
  const baseUrl = record ? record['base-url'] ?? record.baseUrl : undefined;
  const proxyUrl = record ? record['proxy-url'] ?? record.proxyUrl : undefined;
  if (baseUrl) config.baseUrl = String(baseUrl);
  const websockets = normalizeBoolean(record?.websockets ?? record?.['websockets']);
  if (websockets !== undefined) config.websockets = websockets;
  if (proxyUrl) config.proxyUrl = String(proxyUrl);
  const disableCooling = normalizeBoolean(record?.['disable-cooling']);
  if (disableCooling !== undefined) config.disableCooling = disableCooling;
  const headers = normalizeHeaders(record?.headers);
  if (headers) config.headers = headers;
  const models = normalizeModelAliases(record?.models);
  if (models.length) config.models = models;
  const excludedModels = normalizeExcludedModels(
    record?.['excluded-models'] ??
      record?.excludedModels ??
      record?.['excluded_models'] ??
      record?.excluded_models
  );
  if (excludedModels.length) config.excludedModels = excludedModels;
  const authIndex = normalizeAuthIndex(
    record?.['auth-index'] ?? record?.authIndex ?? record?.['auth_index']
  );
  if (authIndex) config.authIndex = authIndex;

  const cloakRaw = record?.cloak;
  if (isRecord(cloakRaw)) {
    const cloak: CloakConfig = {};
    const mode = cloakRaw.mode ?? cloakRaw['mode'];
    if (typeof mode === 'string' && mode.trim()) {
      cloak.mode = mode.trim();
    }
    const strictMode = normalizeBoolean(
      cloakRaw['strict-mode'] ?? cloakRaw.strictMode ?? cloakRaw.strict_mode
    );
    if (strictMode !== undefined) {
      cloak.strictMode = strictMode;
    }
    const sensitiveWords = normalizeExcludedModels(
      cloakRaw['sensitive-words'] ?? cloakRaw.sensitiveWords ?? cloakRaw.sensitive_words
    );
    if (sensitiveWords.length) {
      cloak.sensitiveWords = sensitiveWords;
    }
    const cacheUserId = normalizeBoolean(cloakRaw['cache-user-id']);
    if (cacheUserId !== undefined) {
      cloak.cacheUserId = cacheUserId;
    }
    if (Object.keys(cloak).length) {
      config.cloak = cloak;
    }
  }
  const fingerprintProfile = record?.['fingerprint-profile'];
  if (typeof fingerprintProfile === 'string' && fingerprintProfile.trim()) {
    config.fingerprintProfile = fingerprintProfile.trim();
  }
  if (record?.comment) config.comment = String(record.comment);

  return config;
};

const normalizeGeminiKeyConfig = (item: unknown): GeminiKeyConfig | null => {
  if (item === undefined || item === null) return null;
  const record = isRecord(item) ? item : null;
  let apiKey = record?.['api-key'] ?? record?.apiKey;
  if (!apiKey && typeof item === 'string') {
    apiKey = item;
  }
  const trimmed = String(apiKey || '').trim();
  if (!trimmed) return null;

  const config: GeminiKeyConfig = { apiKey: trimmed };
  const weight = readCredentialWeight(record?.weight);
  if (weight !== undefined) config.weight = weight;
  const priority = record?.priority ?? record?.['priority'];
  if (priority !== undefined && priority !== null && String(priority).trim() !== '') {
    const parsed = Number(priority);
    if (Number.isFinite(parsed)) {
      config.priority = parsed;
    }
  }
  const billingClass = record?.['billing-class'] ?? record?.billingClass;
  if (billingClass === 'metered' || billingClass === 'per-request' || billingClass === 'per_request') {
    config.billingClass = billingClass === 'per_request' ? 'per-request' : billingClass;
  }
  const prefix = normalizePrefix(record?.prefix ?? record?.['prefix']);
  if (prefix) config.prefix = prefix;
  const baseUrl = record ? record['base-url'] ?? record.baseUrl ?? record['base_url'] : undefined;
  if (baseUrl) config.baseUrl = String(baseUrl);
  const proxyUrl = record ? record['proxy-url'] ?? record.proxyUrl ?? record['proxy_url'] : undefined;
  if (proxyUrl) config.proxyUrl = String(proxyUrl);
  const disableCooling = normalizeBoolean(record?.['disable-cooling']);
  if (disableCooling !== undefined) config.disableCooling = disableCooling;
  const models = normalizeModelAliases(record?.models);
  if (models.length) config.models = models;
  const headers = normalizeHeaders(record?.headers);
  if (headers) config.headers = headers;
  const excludedModels = normalizeExcludedModels(record?.['excluded-models'] ?? record?.excludedModels);
  if (excludedModels.length) config.excludedModels = excludedModels;
  const authIndex = normalizeAuthIndex(
    record?.['auth-index'] ?? record?.authIndex ?? record?.['auth_index']
  );
  if (authIndex) config.authIndex = authIndex;
  return config;
};

const normalizeOpenAIProvider = (
  provider: unknown,
  sourceIndex?: number
): OpenAIProviderConfig | null => {
  if (!isRecord(provider)) return null;
  const name = provider.name || provider.id;
  const baseUrl = provider['base-url'] ?? provider.baseUrl;
  if (!name || !baseUrl) return null;

  let apiKeyEntries: ApiKeyEntry[] = [];
  if (Array.isArray(provider['api-key-entries'])) {
    apiKeyEntries = provider['api-key-entries']
      .map((entry) => normalizeApiKeyEntry(entry))
      .filter(Boolean) as ApiKeyEntry[];
  } else if (Array.isArray(provider['api-keys'])) {
    apiKeyEntries = provider['api-keys']
      .map((key) => normalizeApiKeyEntry({ 'api-key': key }))
      .filter(Boolean) as ApiKeyEntry[];
  }

  const headers = normalizeHeaders(provider.headers);
  const models = normalizeModelAliases(provider.models);
  const priority = provider.priority ?? provider['priority'];
  const billingClass = provider['billing-class'] ?? provider.billingClass;
  const testModel = provider['test-model'] ?? provider.testModel;

  const result: OpenAIProviderConfig = {
    name: String(name),
    baseUrl: String(baseUrl),
    apiKeyEntries,
  };

  const disabled = normalizeBoolean(provider.disabled ?? provider['disabled']);
  if (disabled !== undefined) result.disabled = disabled;
  const disableCooling = normalizeBoolean(provider['disable-cooling']);
  if (disableCooling !== undefined) result.disableCooling = disableCooling;
  const prefix = normalizePrefix(provider.prefix ?? provider['prefix']);
  if (prefix) result.prefix = prefix;
  if (headers) result.headers = headers;
  if (models.length) result.models = models;
  if (priority !== undefined) result.priority = Number(priority);
  if (billingClass === 'metered' || billingClass === 'per-request' || billingClass === 'per_request') {
    result.billingClass = billingClass === 'per_request' ? 'per-request' : billingClass;
  }
  if (testModel) result.testModel = String(testModel);
  const authIndex = normalizeAuthIndex(
    provider['auth-index'] ?? provider.authIndex ?? provider['auth_index']
  );
  if (authIndex) result.authIndex = authIndex;
  if (sourceIndex !== undefined) result.sourceIndex = sourceIndex;
  return result;
};

const normalizeOauthExcluded = (payload: unknown): Record<string, string[]> | undefined => {
  if (!isRecord(payload)) return undefined;
  const source = payload['oauth-excluded-models'] ?? payload.items ?? payload;
  if (!isRecord(source)) return undefined;
  const map: Record<string, string[]> = {};
  Object.entries(source).forEach(([provider, models]) => {
    const key = String(provider || '').trim();
    if (!key) return;
    const normalized = normalizeExcludedModels(models);
    map[key.toLowerCase()] = normalized;
  });
  return map;
};

const normalizeOauthEndpointOverrides = (payload: unknown): Record<string, Record<string, string>> | undefined => {
  if (!isRecord(payload)) return undefined;
  const source = payload['oauth-endpoint-overrides'] ?? payload;
  if (!isRecord(source)) return undefined;
  const map: Record<string, Record<string, string>> = {};
  Object.entries(source).forEach(([provider, endpoints]) => {
    const key = String(provider || '').trim();
    if (!key) return;
    if (!isRecord(endpoints)) return;
    const endpointMap: Record<string, string> = {};
    Object.entries(endpoints).forEach(([endpointType, url]) => {
      const endpointKey = String(endpointType || '').trim();
      if (!endpointKey) return;
      const endpointUrl = String(url || '').trim();
      if (endpointUrl) {
        endpointMap[endpointKey] = endpointUrl;
      }
    });
    if (Object.keys(endpointMap).length > 0) {
      map[key] = endpointMap;
    }
  });
  return map;
};

/**
 * 规范化 /config 返回值
 */
export const normalizeConfigResponse = (raw: unknown): Config => {
  const config: Config = { raw: isRecord(raw) ? raw : {} };
  if (!isRecord(raw)) {
    return config;
  }

  config.debug = normalizeBoolean(raw.debug);
  const proxyUrl = raw['proxy-url'] ?? raw.proxyUrl;
  config.proxyUrl =
    typeof proxyUrl === 'string'
      ? proxyUrl
      : proxyUrl === undefined || proxyUrl === null
        ? undefined
        : String(proxyUrl);
  const requestRetry = raw['request-retry'] ?? raw.requestRetry;
  if (typeof requestRetry === 'number' && Number.isFinite(requestRetry)) {
    config.requestRetry = requestRetry;
  } else if (typeof requestRetry === 'string' && requestRetry.trim() !== '') {
    const parsed = Number(requestRetry);
    if (Number.isFinite(parsed)) {
      config.requestRetry = parsed;
    }
  }

  const quota = raw['quota-exceeded'] ?? raw.quotaExceeded;
  if (isRecord(quota)) {
    config.quotaExceeded = {
      switchProject: normalizeBoolean(quota['switch-project'] ?? quota.switchProject),
      switchPreviewModel: normalizeBoolean(
        quota['switch-preview-model'] ?? quota.switchPreviewModel
      ),
      antigravityCredits: normalizeBoolean(
        quota['antigravity-credits'] ?? quota.antigravityCredits
      )
    };
  }

  config.requestLog = normalizeBoolean(raw['request-log'] ?? raw.requestLog);
  config.requestLogSuccessBody = normalizeBoolean(raw['request-log-success-body'] ?? raw.requestLogSuccessBody);
  const detailedAPIErrorBodyLogLimit = raw['detailed-api-error-body-log-limit'] ?? raw.detailedAPIErrorBodyLogLimit;
  if (typeof detailedAPIErrorBodyLogLimit === 'number' && Number.isFinite(detailedAPIErrorBodyLogLimit)) {
    config.detailedAPIErrorBodyLogLimit = detailedAPIErrorBodyLogLimit;
  } else if (typeof detailedAPIErrorBodyLogLimit === 'string' && detailedAPIErrorBodyLogLimit.trim() !== '') {
    const parsedLimit = Number(detailedAPIErrorBodyLogLimit);
    if (Number.isFinite(parsedLimit)) {
      config.detailedAPIErrorBodyLogLimit = parsedLimit;
    }
  }
  config.loggingToFile = normalizeBoolean(raw['logging-to-file'] ?? raw.loggingToFile);
  const logsMaxTotalSizeMb = raw['logs-max-total-size-mb'] ?? raw.logsMaxTotalSizeMb;
  if (typeof logsMaxTotalSizeMb === 'number' && Number.isFinite(logsMaxTotalSizeMb)) {
    config.logsMaxTotalSizeMb = logsMaxTotalSizeMb;
  } else if (typeof logsMaxTotalSizeMb === 'string' && logsMaxTotalSizeMb.trim() !== '') {
    const parsed = Number(logsMaxTotalSizeMb);
    if (Number.isFinite(parsed)) {
      config.logsMaxTotalSizeMb = parsed;
    }
  }
  config.wsAuth = normalizeBoolean(raw['ws-auth'] ?? raw.wsAuth);
  config.forceModelPrefix = normalizeBoolean(raw['force-model-prefix'] ?? raw.forceModelPrefix);
  const routing = raw.routing;
  const strategyRaw = isRecord(routing)
    ? (routing.strategy ?? routing['strategy'])
    : (raw['routing-strategy'] ?? raw.routingStrategy);
  if (strategyRaw !== undefined && strategyRaw !== null) {
    config.routingStrategy = String(strategyRaw);
  }

  const modeRaw = isRecord(routing)
    ? (routing.mode ?? routing['mode'])
    : (raw['routing-mode'] ?? raw.routingMode);
  if (modeRaw !== undefined && modeRaw !== null) {
    config.routingMode = String(modeRaw);
  }

  const tokenThresholdRulesRaw = isRecord(routing)
    ? routing['token-threshold-rules']
    : (raw['token-threshold-rules'] ?? raw.tokenThresholdRules);
  if (Array.isArray(tokenThresholdRulesRaw)) {
    const tokenThresholdRules = tokenThresholdRulesRaw
      .map((item) => {
        if (!isRecord(item)) return null;
        
        const minTokens = typeof item['min-tokens'] !== 'undefined' 
          ? Number(item['min-tokens']) 
          : (typeof item.minTokens !== 'undefined' ? Number(item.minTokens) : undefined);
          
        const maxTokens = typeof item['max-tokens'] !== 'undefined' 
          ? Number(item['max-tokens']) 
          : (typeof item.maxTokens !== 'undefined' ? Number(item.maxTokens) : undefined);
          
        const billingClass = item['billing-class'] ?? item.billingClass;
        
		const isValidMin = minTokens === undefined || (Number.isFinite(minTokens) && minTokens >= 0);
		const isValidMax = maxTokens === undefined || (Number.isFinite(maxTokens) && maxTokens >= 0);
        
        // At least one of min or max must be valid
        if (!isValidMin || !isValidMax || (minTokens === undefined && maxTokens === undefined)) return null;
        if (!(billingClass === 'metered' || billingClass === 'per-request' || billingClass === 'per_request')) return null;
        
        return {
          modelPattern: typeof (item['model-pattern'] ?? item.modelPattern) === 'string' ? String(item['model-pattern'] ?? item.modelPattern).trim() : undefined,
          ...(minTokens !== undefined ? { minTokens } : {}),
          ...(maxTokens !== undefined ? { maxTokens } : {}),
          billingClass: billingClass === 'per_request' ? 'per-request' : 'per-request' === billingClass ? 'per-request' : 'metered',
          enabled: normalizeBoolean(item.enabled) ?? true,
        };
      })
      .filter(Boolean) as NonNullable<Config['tokenThresholdRules']>;
    if (tokenThresholdRules.length > 0) {
      config.tokenThresholdRules = tokenThresholdRules;
    }
  }

  const fallbackModelsRaw = isRecord(routing)
    ? routing['fallback-models']
    : (raw['fallback-models'] ?? raw.fallbackModels);
  if (isRecord(fallbackModelsRaw)) {
    const fallbackModels: Record<string, string> = {};
    Object.entries(fallbackModelsRaw).forEach(([source, target]) => {
      const sourceModel = String(source || '').trim();
      const targetModel = String(target || '').trim();
      if (sourceModel && targetModel) fallbackModels[sourceModel] = targetModel;
    });
    if (Object.keys(fallbackModels).length > 0) {
      config.fallbackModels = fallbackModels;
    }
  }

  const fallbackChainRaw = isRecord(routing)
    ? routing['fallback-chain']
    : (raw['fallback-chain'] ?? raw.fallbackChain);
  if (Array.isArray(fallbackChainRaw)) {
    const fallbackChain = fallbackChainRaw
      .map((item) => String(item || '').trim())
      .filter((item) => item.length > 0);
    if (fallbackChain.length > 0) {
      config.fallbackChain = fallbackChain;
    }
  }
  const fallbackMaxDepthRaw = isRecord(routing)
    ? routing['fallback-max-depth']
    : (raw['fallback-max-depth'] ?? raw.fallbackMaxDepth);
  if (fallbackMaxDepthRaw != null) {
    const n = Number(fallbackMaxDepthRaw);
    if (Number.isFinite(n) && n >= 0) {
      config.fallbackMaxDepth = n;
    }
  }
  const apiKeysRaw = raw['api-keys'] ?? raw.apiKeys;
  if (Array.isArray(apiKeysRaw)) {
    config.apiKeys = apiKeysRaw.map((key) => String(key)).filter((key) => key.trim() !== '');
  }

  const geminiList = raw['gemini-api-key'] ?? raw.geminiApiKey ?? raw.geminiApiKeys;
  if (Array.isArray(geminiList)) {
    config.geminiApiKeys = geminiList
      .map((item) => normalizeGeminiKeyConfig(item))
      .filter(Boolean) as GeminiKeyConfig[];
  }

  const interactionsList =
    raw['interactions-api-key'] ?? raw.interactionsApiKey ?? raw.interactionsApiKeys;
  if (Array.isArray(interactionsList)) {
    config.interactionsApiKeys = interactionsList
      .map((item) => normalizeGeminiKeyConfig(item))
      .filter(Boolean) as GeminiKeyConfig[];
  }

  const codexList = raw['codex-api-key'] ?? raw.codexApiKey ?? raw.codexApiKeys;
  if (Array.isArray(codexList)) {
    config.codexApiKeys = codexList
      .map((item) => normalizeProviderKeyConfig(item))
      .filter(Boolean) as ProviderKeyConfig[];
  }

  const xaiList = raw['xai-api-key'];
  if (Array.isArray(xaiList)) {
    config.xaiApiKeys = xaiList
      .map((item) => normalizeProviderKeyConfig(item))
      .filter(Boolean) as ProviderKeyConfig[];
  }

  const claudeList = raw['claude-api-key'] ?? raw.claudeApiKey ?? raw.claudeApiKeys;
  if (Array.isArray(claudeList)) {
    config.claudeApiKeys = claudeList
      .map((item) => normalizeProviderKeyConfig(item))
      .filter(Boolean) as ProviderKeyConfig[];
  }

  const vertexList = raw['vertex-api-key'] ?? raw.vertexApiKey ?? raw.vertexApiKeys;
  if (Array.isArray(vertexList)) {
    config.vertexApiKeys = vertexList
      .map((item) => normalizeProviderKeyConfig(item))
      .filter(Boolean) as ProviderKeyConfig[];
  }

  const openaiList = raw['openai-compatibility'] ?? raw.openaiCompatibility ?? raw.openAICompatibility;
  if (Array.isArray(openaiList)) {
    config.openaiCompatibility = openaiList
      .map((item, index) => normalizeOpenAIProvider(item, index))
      .filter(Boolean) as OpenAIProviderConfig[];
  }

  const oauthExcluded = normalizeOauthExcluded(raw['oauth-excluded-models'] ?? raw.oauthExcludedModels);
if (oauthExcluded) {
  config.oauthExcludedModels = oauthExcluded;
}

const oauthOverrides = normalizeOauthEndpointOverrides(raw['oauth-endpoint-overrides'] ?? raw.oauthEndpointOverrides);
if (oauthOverrides) {
  config.oauthEndpointOverrides = oauthOverrides;
}

return config;
};

export {
  normalizeApiKeyEntry,
  normalizeGeminiKeyConfig,
  normalizeModelAliases,
  normalizeOpenAIProvider,
  normalizeProviderKeyConfig,
  normalizeHeaders,
  normalizeExcludedModels,
  normalizeOauthEndpointOverrides
};
