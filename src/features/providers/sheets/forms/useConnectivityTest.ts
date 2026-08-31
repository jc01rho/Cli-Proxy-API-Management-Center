import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import {
  DEFAULT_COMMANDCODE_PROBE_MODEL,
  DEFAULT_FREEBUFF_BASE_URL,
  DEFAULT_FREEBUFF_PROBE_MODEL,
  buildCodexResponsesEndpoint,
  buildClaudeMessagesEndpoint,
  buildCommandCodeGenerateEndpoint,
  buildFreebuffSessionEndpoint,
  buildGeminiGenerateContentEndpoint,
  buildInteractionsEndpoint,
  buildInteractionsProbePayload,
  INTERACTIONS_API_REVISION,
  buildOpenAIChatCompletionsEndpoint,
} from '@/components/providers/utils';
import { buildHeaderObject, hasHeader } from '@/utils/headers';
import { getErrorMessage } from '@/utils/helpers';
import type { ApiKeyEntryInput, ModelEntryInput, ProviderBrand } from '../../types';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

export type ConnectivityState = 'idle' | 'loading' | 'success' | 'error';

export interface ConnectivityStatus {
  state: ConnectivityState;
  message: string;
}

const IDLE: ConnectivityStatus = { state: 'idle', message: '' };

const requestFailureMessage = (err: unknown, messages: ConnectivityErrorMessages): string => {
  const raw = getErrorMessage(err);
  const isTimeout =
    (typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      String((err as { code?: string }).code) === 'ECONNABORTED') ||
    raw.toLowerCase().includes('timeout');

  return isTimeout ? messages.timeout(DEFAULT_TIMEOUT_MS / 1000) : raw || messages.requestFailed;
};

const pickModel = (testModel: string | undefined, models: ModelEntryInput[]): string => {
  const trimmed = (testModel ?? '').trim();
  if (trimmed) return trimmed;
  for (const m of models) {
    const name = (m.name ?? '').trim();
    if (name) return name;
  }
  return '';
};

export const pickCommandCodeProbeModel = (
  testModel: string | undefined,
  models: ModelEntryInput[]
): string => pickModel(testModel, models) || DEFAULT_COMMANDCODE_PROBE_MODEL;

export const pickFreebuffProbeModel = (
  testModel: string | undefined,
  models: ModelEntryInput[]
): string => pickModel(testModel, models) || DEFAULT_FREEBUFF_PROBE_MODEL;

const resolveBearerToken = (headers: Record<string, string>): string => {
  const auth = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
  if (!auth) return '';
  const match = String(auth).match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

export interface UseConnectivityTestArgs {
  brand: ProviderBrand;
  baseUrl: string;
  testModel?: string;
  maxOutputTokens?: number;
  models: ModelEntryInput[];
  formHeaders: Array<{ key: string; value: string }>;
  apiKeyEntries?: ApiKeyEntryInput[];
  apiKey?: string;
  fallbackApiKey?: string;
  authIndex?: string;
}

export interface ConnectivityErrorMessages {
  baseUrlRequired: string;
  endpointInvalid: string;
  apiKeyRequired: string;
  modelRequired: string;
  timeout: (seconds: number) => string;
  requestFailed: string;
}

const buildCommandCodeEndpoint = (baseUrl: string): string | null => {
  if (!baseUrl.trim()) return null;
  return buildCommandCodeGenerateEndpoint(baseUrl) || null;
};

const buildFreebuffEndpoint = (baseUrl: string): string | null => {
  const source = baseUrl.trim() || DEFAULT_FREEBUFF_BASE_URL;
  // Official Codebuff has no /api/v1/models catalog. GET /api/v1/freebuff/session
  // is the first executor hop and returns JSON 401/200 instead of Next.js HTML.
  return buildFreebuffSessionEndpoint(source) || null;
};

export type ApiKeyEntriesConnectivityKind = 'openaiCompatibility' | 'commandcode' | 'freebuff';

export function apiKeyEntriesConnectivityKind(
  brand: ProviderBrand
): ApiKeyEntriesConnectivityKind | null {
  if (brand === 'openaiCompatibility') return 'openaiCompatibility';
  if (brand === 'commandcode') return 'commandcode';
  if (brand === 'freebuff') return 'freebuff';
  return null;
}

const buildCommandCodeProbePayload = (model: string): string =>
  JSON.stringify({
    config: {
      workingDir: '/tmp',
      date: new Date().toISOString().slice(0, 10),
      environment: 'terminal',
      structure: [],
      isGitRepo: false,
      currentBranch: '',
      mainBranch: '',
      gitStatus: '',
      recentCommits: [],
    },
    memory: '',
    taste: '',
    skills: null,
    permissionMode: 'standard',
    params: {
      model,
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 8,
      stream: false,
    },
  });

const buildCommandCodeHeaderObj = (
  formHeaders: Array<{ key: string; value: string }>,
  resolvedKey: string,
  resolvedAuthIndex: string | undefined
): Record<string, string> => {
  const headerObj: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-command-code-version': '1.12.0',
    'x-cli-environment': 'production',
    'x-project-slug': 'cli-proxy',
    'x-taste-learning': 'true',
    'x-co-flag': 'false',
    ...buildHeaderObject(formHeaders),
  };
  if (!hasHeader(headerObj, 'authorization') && resolvedKey) {
    headerObj.Authorization = `Bearer ${resolvedKey}`;
  } else if (!hasHeader(headerObj, 'authorization') && resolvedAuthIndex) {
    headerObj.Authorization = 'Bearer $TOKEN$';
  }
  return headerObj;
};

export interface UseConnectivityTestResult {
  openaiStatuses: ConnectivityStatus[];
  codexStatus: ConnectivityStatus;
  geminiStatus: ConnectivityStatus;
  claudeStatus: ConnectivityStatus;
  commandcodeStatus: ConnectivityStatus;
  freebuffStatus: ConnectivityStatus;
  isTestingAny: boolean;
  runOpenAIKey: (idx: number) => Promise<boolean>;
  runOpenAIAllKeys: () => Promise<void>;
  runCodex: () => Promise<void>;
  runGemini: () => Promise<void>;
  runClaude: () => Promise<void>;
  runCommandCode: () => Promise<void>;
  runCommandCodeKey: (idx: number) => Promise<boolean>;
  runCommandCodeAllKeys: () => Promise<void>;
  runFreebuff: () => Promise<void>;
  runFreebuffKey: (idx: number) => Promise<boolean>;
  runFreebuffAllKeys: () => Promise<void>;
}

export function useConnectivityTest(
  args: UseConnectivityTestArgs,
  messages: ConnectivityErrorMessages
): UseConnectivityTestResult {
  const {
    brand,
    baseUrl,
    testModel,
    maxOutputTokens,
    models,
    formHeaders,
    apiKeyEntries,
    apiKey,
    fallbackApiKey,
    authIndex,
  } = args;

  const entriesCount = apiKeyEntries?.length ?? 0;

  const [openaiStatuses, setOpenaiStatuses] = useState<ConnectivityStatus[]>(() =>
    Array.from({ length: entriesCount }, () => IDLE)
  );
  const [codexStatus, setCodexStatus] = useState<ConnectivityStatus>(IDLE);
  const [geminiStatus, setGeminiStatus] = useState<ConnectivityStatus>(IDLE);
  const [claudeStatus, setClaudeStatus] = useState<ConnectivityStatus>(IDLE);
  const [commandcodeStatus, setCommandcodeStatus] = useState<ConnectivityStatus>(IDLE);
  const [freebuffStatus, setFreebuffStatus] = useState<ConnectivityStatus>(IDLE);
  const [inFlight, setInFlight] = useState(0);

  const entrySignatures = useMemo(
    () =>
      (apiKeyEntries ?? []).map((entry) =>
        [
          entry.apiKey ?? '',
          entry.existingApiKey ?? '',
          entry.authIndex ?? '',
          entry.proxyUrl ?? '',
        ].join('||')
      ),
    [apiKeyEntries]
  );

  const lastEntrySignaturesRef = useRef<string[]>(entrySignatures);
  useEffect(() => {
    const prev = lastEntrySignaturesRef.current;
    const curr = entrySignatures;
    lastEntrySignaturesRef.current = curr;

    setOpenaiStatuses((statuses) => {
      const nextLen = curr.length;
      let mutated = statuses.length !== nextLen;
      const next = statuses.slice(0, nextLen);
      while (next.length < nextLen) next.push(IDLE);
      for (let i = 0; i < nextLen; i++) {
        if (prev[i] !== undefined && prev[i] !== curr[i] && next[i].state !== 'idle') {
          next[i] = IDLE;
          mutated = true;
        }
      }
      return mutated ? next : statuses;
    });
  }, [entrySignatures]);

  const signature = useMemo(() => {
    const h = formHeaders.map((it) => `${it.key}:${it.value}`).join('|');
    const m = models.map((it) => `${it.name}:${it.alias ?? ''}`).join('|');
    return [
      baseUrl,
      (testModel ?? '').trim(),
      apiKey ?? '',
      fallbackApiKey ?? '',
      authIndex ?? '',
      h,
      m,
    ].join('||');
  }, [apiKey, authIndex, baseUrl, fallbackApiKey, testModel, formHeaders, models]);

  const lastSignatureRef = useRef(signature);
  useEffect(() => {
    if (lastSignatureRef.current === signature) return;
    lastSignatureRef.current = signature;
    setOpenaiStatuses((prev) => prev.map(() => IDLE));
    setCodexStatus(IDLE);
    setGeminiStatus(IDLE);
    setClaudeStatus(IDLE);
    setCommandcodeStatus(IDLE);
    setFreebuffStatus(IDLE);
  }, [signature]);

  const updateOpenaiStatus = useCallback((idx: number, value: ConnectivityStatus) => {
    setOpenaiStatuses((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const runOpenAIKey = useCallback(
    async (idx: number): Promise<boolean> => {
      if (brand !== 'openaiCompatibility') return false;

      const trimmedBase = baseUrl.trim();
      if (!trimmedBase) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: messages.baseUrlRequired,
        });
        return false;
      }
      const endpoint = buildOpenAIChatCompletionsEndpoint(trimmedBase);
      if (!endpoint) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: messages.endpointInvalid,
        });
        return false;
      }
      const entry = apiKeyEntries?.[idx];
      const entryKey = (entry?.apiKey ?? '').trim() || (entry?.existingApiKey ?? '').trim();
      const resolvedAuthIndex =
        (entry?.authIndex ?? '').trim() || (authIndex ?? '').trim() || undefined;
      if (!entryKey && !resolvedAuthIndex) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: messages.apiKeyRequired,
        });
        return false;
      }
      const model = pickModel(testModel, models);
      if (!model) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: messages.modelRequired,
        });
        return false;
      }

      const headerObj: Record<string, string> = {
        'Content-Type': 'application/json',
        ...buildHeaderObject(formHeaders),
      };
      if (!hasHeader(headerObj, 'authorization')) {
        if (entryKey) {
          headerObj.Authorization = `Bearer ${entryKey}`;
        } else if (resolvedAuthIndex) {
          headerObj.Authorization = 'Bearer $TOKEN$';
        }
      }

      updateOpenaiStatus(idx, { state: 'loading', message: '' });
      setInFlight((n) => n + 1);
      try {
        const result = await apiCallApi.request(
          {
            authIndex: resolvedAuthIndex,
            method: 'POST',
            url: endpoint,
            header: headerObj,
            data: JSON.stringify({
              model,
              messages: [{ role: 'user', content: 'Hi' }],
              stream: false,
              max_tokens: maxOutputTokens ?? 5,
            }),
          },
          { timeout: DEFAULT_TIMEOUT_MS }
        );
        if (result.statusCode < 200 || result.statusCode >= 300) {
          throw new Error(getApiCallErrorMessage(result));
        }
        updateOpenaiStatus(idx, { state: 'success', message: '' });
        return true;
      } catch (err) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: requestFailureMessage(err, messages),
        });
        return false;
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [
      apiKeyEntries,
      authIndex,
      baseUrl,
      brand,
      formHeaders,
      maxOutputTokens,
      messages,
      models,
      testModel,
      updateOpenaiStatus,
    ]
  );

  const runOpenAIAllKeys = useCallback(async (): Promise<void> => {
    if (brand !== 'openaiCompatibility') return;
    const entries = apiKeyEntries ?? [];
    if (!entries.length) return;
    await Promise.all(entries.map((_, idx) => runOpenAIKey(idx)));
  }, [apiKeyEntries, brand, runOpenAIKey]);

  const runCodex = useCallback(async (): Promise<void> => {
    if (brand !== 'codex' && brand !== 'xai') return;

    const trimmedBase = baseUrl.trim();
    if (!trimmedBase) {
      setCodexStatus({ state: 'error', message: messages.baseUrlRequired });
      return;
    }

    const endpoint = buildCodexResponsesEndpoint(trimmedBase);
    if (!endpoint) {
      setCodexStatus({ state: 'error', message: messages.endpointInvalid });
      return;
    }

    const model = pickModel(testModel, models);
    if (!model) {
      setCodexStatus({ state: 'error', message: messages.modelRequired });
      return;
    }

    const customHeaders = buildHeaderObject(formHeaders);
    const explicitKey = (apiKey ?? '').trim();
    const persistedKey = (fallbackApiKey ?? '').trim();
    const hasAuthorization = hasHeader(customHeaders, 'authorization');
    const resolvedKey = explicitKey || persistedKey;
    const resolvedAuthIndex = (authIndex ?? '').trim() || undefined;

    if (!resolvedKey && !hasAuthorization && !resolvedAuthIndex) {
      setCodexStatus({ state: 'error', message: messages.apiKeyRequired });
      return;
    }

    const headerObj: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    if (!hasHeader(headerObj, 'authorization')) {
      if (resolvedKey) {
        headerObj.Authorization = `Bearer ${resolvedKey}`;
      } else if (resolvedAuthIndex) {
        headerObj.Authorization = 'Bearer $TOKEN$';
      }
    }

    setCodexStatus({ state: 'loading', message: '' });
    setInFlight((n) => n + 1);
    try {
      const result = await apiCallApi.request(
        {
          authIndex: resolvedAuthIndex,
          method: 'POST',
          url: endpoint,
          header: headerObj,
          data: JSON.stringify({
            model,
            input: 'Hi',
            stream: false,
            ...(maxOutputTokens != null ? { max_output_tokens: maxOutputTokens } : {}),
          }),
        },
        { timeout: DEFAULT_TIMEOUT_MS }
      );
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(getApiCallErrorMessage(result));
      }
      setCodexStatus({ state: 'success', message: '' });
    } catch (err) {
      setCodexStatus({
        state: 'error',
        message: requestFailureMessage(err, messages),
      });
    } finally {
      setInFlight((n) => n - 1);
    }
  }, [apiKey, authIndex, baseUrl, brand, fallbackApiKey, formHeaders, maxOutputTokens, messages, models, testModel]);

  const runGemini = useCallback(async (): Promise<void> => {
    if (brand !== 'gemini' && brand !== 'interactions') return;

    const model = pickModel(testModel, models);
    if (!model) {
      setGeminiStatus({ state: 'error', message: messages.modelRequired });
      return;
    }

    const endpoint =
      brand === 'interactions'
        ? buildInteractionsEndpoint(baseUrl ?? '')
        : buildGeminiGenerateContentEndpoint(baseUrl ?? '', model);
    if (!endpoint) {
      setGeminiStatus({ state: 'error', message: messages.endpointInvalid });
      return;
    }

    const customHeaders = buildHeaderObject(formHeaders);
    const explicitKey = (apiKey ?? '').trim();
    const persistedKey = (fallbackApiKey ?? '').trim();
    const hasApiKeyHeader = hasHeader(customHeaders, 'x-goog-api-key');
    const resolvedKey = explicitKey || persistedKey;
    const resolvedAuthIndex = (authIndex ?? '').trim() || undefined;

    if (!resolvedKey && !hasApiKeyHeader && !resolvedAuthIndex) {
      setGeminiStatus({ state: 'error', message: messages.apiKeyRequired });
      return;
    }

    const headerObj: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    if (!hasHeader(headerObj, 'x-goog-api-key')) {
      if (resolvedKey) {
        headerObj['x-goog-api-key'] = resolvedKey;
      } else if (resolvedAuthIndex) {
        headerObj['x-goog-api-key'] = '$TOKEN$';
      }
    }
    if (brand === 'interactions' && !hasHeader(headerObj, 'api-revision')) {
      headerObj['Api-Revision'] = INTERACTIONS_API_REVISION;
    }

    setGeminiStatus({ state: 'loading', message: '' });
    setInFlight((n) => n + 1);
    try {
      const result = await apiCallApi.request(
        {
          authIndex: resolvedAuthIndex,
          method: 'POST',
          url: endpoint,
          header: headerObj,
          data: JSON.stringify(
            brand === 'interactions'
              ? buildInteractionsProbePayload(model)
              : {
                  contents: [{ parts: [{ text: 'Hi' }] }],
                  generationConfig: { maxOutputTokens: maxOutputTokens ?? 8 },
                }
          ),
        },
        { timeout: DEFAULT_TIMEOUT_MS }
      );
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(getApiCallErrorMessage(result));
      }
      setGeminiStatus({ state: 'success', message: '' });
    } catch (err) {
      setGeminiStatus({
        state: 'error',
        message: requestFailureMessage(err, messages),
      });
    } finally {
      setInFlight((n) => n - 1);
    }
  }, [apiKey, authIndex, baseUrl, brand, fallbackApiKey, formHeaders, maxOutputTokens, messages, models, testModel]);

  const runClaude = useCallback(async (): Promise<void> => {
    if (brand !== 'claude' && brand !== 'claudeApi') return;

    const endpoint = buildClaudeMessagesEndpoint(baseUrl ?? '');
    if (!endpoint) {
      setClaudeStatus({ state: 'error', message: messages.endpointInvalid });
      return;
    }
    const model = pickModel(testModel, models);
    if (!model) {
      setClaudeStatus({ state: 'error', message: messages.modelRequired });
      return;
    }

    const customHeaders = buildHeaderObject(formHeaders);
    const explicitKey = (apiKey ?? '').trim();
    const persistedKey = (fallbackApiKey ?? '').trim();
    const headerKey = resolveBearerToken(customHeaders);
    const hasApiKeyHeader = hasHeader(customHeaders, 'x-api-key');
    const resolvedKey = explicitKey || persistedKey || headerKey;
    const resolvedAuthIndex = (authIndex ?? '').trim() || undefined;

    if (!resolvedKey && !hasApiKeyHeader && !resolvedAuthIndex) {
      setClaudeStatus({ state: 'error', message: messages.apiKeyRequired });
      return;
    }

    const headerObj: Record<string, string> = {
      'Content-Type': 'application/json',
      ...customHeaders,
    };
    if (!hasHeader(headerObj, 'anthropic-version')) {
      headerObj['anthropic-version'] = DEFAULT_ANTHROPIC_VERSION;
    }
    if (!hasApiKeyHeader && resolvedKey) {
      headerObj['x-api-key'] = resolvedKey;
    } else if (!hasApiKeyHeader && resolvedAuthIndex) {
      headerObj['x-api-key'] = '$TOKEN$';
    }

    setClaudeStatus({ state: 'loading', message: '' });
    setInFlight((n) => n + 1);
    try {
      const result = await apiCallApi.request(
        {
          authIndex: resolvedAuthIndex,
          method: 'POST',
          url: endpoint,
          header: headerObj,
          data: JSON.stringify({
            model,
            max_tokens: maxOutputTokens ?? 8,
            messages: [{ role: 'user', content: 'Hi' }],
          }),
        },
        { timeout: DEFAULT_TIMEOUT_MS }
      );
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(getApiCallErrorMessage(result));
      }
      setClaudeStatus({ state: 'success', message: '' });
    } catch (err) {
      setClaudeStatus({
        state: 'error',
        message: requestFailureMessage(err, messages),
      });
    } finally {
      setInFlight((n) => n - 1);
    }
  }, [apiKey, authIndex, baseUrl, brand, fallbackApiKey, formHeaders, maxOutputTokens, messages, models, testModel]);

  const runCommandCode = useCallback(async (): Promise<void> => {
    if (brand !== 'commandcode') return;

    const endpoint = buildCommandCodeEndpoint(baseUrl ?? '');
    if (!endpoint) {
      setCommandcodeStatus({ state: 'error', message: messages.endpointInvalid });
      return;
    }
    const model = pickCommandCodeProbeModel(testModel, models);

    const customHeaders = buildHeaderObject(formHeaders);
    const firstEntry = apiKeyEntries?.[0];
    const explicitKey = ((firstEntry?.apiKey ?? '') || (apiKey ?? '')).trim();
    const persistedKey = (
      firstEntry?.existingApiKey?.trim() ||
      (fallbackApiKey ?? '').trim()
    );
    const headerKey = resolveBearerToken(customHeaders);
    const resolvedKey = explicitKey || persistedKey || headerKey;
    const resolvedAuthIndex =
      firstEntry?.authIndex?.trim() || (authIndex ?? '').trim() || undefined;

    if (!resolvedKey && !resolvedAuthIndex) {
      setCommandcodeStatus({ state: 'error', message: messages.apiKeyRequired });
      return;
    }

    const headerObj = buildCommandCodeHeaderObj(formHeaders, resolvedKey, resolvedAuthIndex);

    setCommandcodeStatus({ state: 'loading', message: '' });
    setInFlight((n) => n + 1);
    try {
      const result = await apiCallApi.request(
        {
          authIndex: resolvedAuthIndex,
          method: 'POST',
          url: endpoint,
          header: headerObj,
          data: buildCommandCodeProbePayload(model),
        },
        { timeout: DEFAULT_TIMEOUT_MS }
      );
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(getApiCallErrorMessage(result));
      }
      setCommandcodeStatus({ state: 'success', message: '' });
    } catch (err) {
      setCommandcodeStatus({
        state: 'error',
        message: requestFailureMessage(err, messages),
      });
    } finally {
      setInFlight((n) => n - 1);
    }
  }, [
    apiKey,
    apiKeyEntries,
    authIndex,
    baseUrl,
    brand,
    fallbackApiKey,
    formHeaders,
    messages,
    models,
    testModel,
  ]);

  const runCommandCodeKey = useCallback(
    async (idx: number): Promise<boolean> => {
      if (brand !== 'commandcode') return false;

      const trimmedBase = (baseUrl ?? '').trim();
      if (!trimmedBase) {
        updateOpenaiStatus(idx, { state: 'error', message: messages.baseUrlRequired });
        return false;
      }
      const endpoint = buildCommandCodeEndpoint(trimmedBase);
      if (!endpoint) {
        updateOpenaiStatus(idx, { state: 'error', message: messages.endpointInvalid });
        return false;
      }

      const entry = apiKeyEntries?.[idx];
      const entryKey = (entry?.apiKey ?? '').trim() || (entry?.existingApiKey ?? '').trim();
      const resolvedAuthIndex =
        (entry?.authIndex ?? '').trim() || (authIndex ?? '').trim() || undefined;
      if (!entryKey && !resolvedAuthIndex) {
        updateOpenaiStatus(idx, { state: 'error', message: messages.apiKeyRequired });
        return false;
      }

      const model = pickCommandCodeProbeModel(testModel, models);
      const headerObj = buildCommandCodeHeaderObj(formHeaders, entryKey, resolvedAuthIndex);

      updateOpenaiStatus(idx, { state: 'loading', message: '' });
      setInFlight((n) => n + 1);
      try {
        const result = await apiCallApi.request(
          {
            authIndex: resolvedAuthIndex,
            method: 'POST',
            url: endpoint,
            header: headerObj,
            data: buildCommandCodeProbePayload(model),
          },
          { timeout: DEFAULT_TIMEOUT_MS }
        );
        if (result.statusCode < 200 || result.statusCode >= 300) {
          throw new Error(getApiCallErrorMessage(result));
        }
        updateOpenaiStatus(idx, { state: 'success', message: '' });
        return true;
      } catch (err) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: requestFailureMessage(err, messages),
        });
        return false;
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [apiKeyEntries, authIndex, baseUrl, brand, formHeaders, messages, models, testModel, updateOpenaiStatus]
  );

  const runCommandCodeAllKeys = useCallback(async (): Promise<void> => {
    if (brand !== 'commandcode') return;
    const entries = apiKeyEntries ?? [];
    for (let i = 0; i < entries.length; i += 1) {
      await runCommandCodeKey(i);
    }
  }, [apiKeyEntries, brand, runCommandCodeKey]);


  const runFreebuff = useCallback(async (): Promise<void> => {
    if (brand !== 'freebuff') return;

    const endpoint = buildFreebuffEndpoint(baseUrl ?? '');
    if (!endpoint) {
      setFreebuffStatus({ state: 'error', message: messages.endpointInvalid });
      return;
    }

    const customHeaders = buildHeaderObject(formHeaders);
    const firstEntry = apiKeyEntries?.[0];
    const explicitKey = ((firstEntry?.apiKey ?? '') || (apiKey ?? '')).trim();
    const persistedKey = (
      firstEntry?.existingApiKey?.trim() ||
      (fallbackApiKey ?? '').trim()
    );
    const headerKey = resolveBearerToken(customHeaders);
    const resolvedKey = explicitKey || persistedKey || headerKey;
    const resolvedAuthIndex =
      firstEntry?.authIndex?.trim() || (authIndex ?? '').trim() || undefined;

    if (!resolvedKey && !resolvedAuthIndex) {
      setFreebuffStatus({ state: 'error', message: messages.apiKeyRequired });
      return;
    }

    const headerObj = buildCommandCodeHeaderObj(formHeaders, resolvedKey, resolvedAuthIndex);

    setFreebuffStatus({ state: 'loading', message: '' });
    setInFlight((n) => n + 1);
    try {
      const result = await apiCallApi.request(
        {
          authIndex: resolvedAuthIndex,
          method: 'GET',
          url: endpoint,
          header: headerObj,
        },
        { timeout: DEFAULT_TIMEOUT_MS }
      );
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(getApiCallErrorMessage(result));
      }
      setFreebuffStatus({ state: 'success', message: '' });
    } catch (err) {
      setFreebuffStatus({
        state: 'error',
        message: requestFailureMessage(err, messages),
      });
    } finally {
      setInFlight((n) => n - 1);
    }
  }, [
    apiKey,
    apiKeyEntries,
    authIndex,
    baseUrl,
    brand,
    fallbackApiKey,
    formHeaders,
    messages,
  ]);

  const runFreebuffKey = useCallback(
    async (idx: number): Promise<boolean> => {
      if (brand !== 'freebuff') return false;
      const entry = apiKeyEntries?.[idx];
      if (!entry) return false;
      const trimmedBase = (baseUrl ?? '').trim() || DEFAULT_FREEBUFF_BASE_URL;
      const endpoint = buildFreebuffEndpoint(trimmedBase);
      if (!endpoint) {
        updateOpenaiStatus(idx, { state: 'error', message: messages.endpointInvalid });
        return false;
      }
      const entryKey = (entry.apiKey ?? '').trim() || (entry.existingApiKey ?? '').trim();
      const resolvedAuthIndex = (entry.authIndex ?? '').trim() || (authIndex ?? '').trim() || undefined;
      if (!entryKey && !resolvedAuthIndex) {
        updateOpenaiStatus(idx, { state: 'error', message: messages.apiKeyRequired });
        return false;
      }
      const headerObj = buildCommandCodeHeaderObj(formHeaders, entryKey, resolvedAuthIndex);
      updateOpenaiStatus(idx, { state: 'loading', message: '' });
      setInFlight((n) => n + 1);
      try {
        const result = await apiCallApi.request(
          {
            authIndex: resolvedAuthIndex,
            method: 'GET',
            url: endpoint,
            header: headerObj,
          },
          { timeout: DEFAULT_TIMEOUT_MS }
        );
        if (result.statusCode < 200 || result.statusCode >= 300) {
          throw new Error(getApiCallErrorMessage(result));
        }
        updateOpenaiStatus(idx, { state: 'success', message: '' });
        return true;
      } catch (err) {
        updateOpenaiStatus(idx, {
          state: 'error',
          message: requestFailureMessage(err, messages),
        });
        return false;
      } finally {
        setInFlight((n) => n - 1);
      }
    },
    [apiKeyEntries, authIndex, baseUrl, brand, formHeaders, messages, updateOpenaiStatus]
  );

  const runFreebuffAllKeys = useCallback(async (): Promise<void> => {
    if (brand !== 'freebuff') return;
    const entries = apiKeyEntries ?? [];
    for (let i = 0; i < entries.length; i += 1) {
      await runFreebuffKey(i);
    }
  }, [apiKeyEntries, brand, runFreebuffKey]);


  return {
    openaiStatuses,
    codexStatus,
    geminiStatus,
    claudeStatus,
    commandcodeStatus,
    freebuffStatus,
    isTestingAny: inFlight > 0,
    runOpenAIKey,
    runOpenAIAllKeys,
    runCodex,
    runGemini,
    runClaude,
    runCommandCode,
    runCommandCodeKey,
    runCommandCodeAllKeys,
    runFreebuff,
    runFreebuffKey,
    runFreebuffAllKeys,
  };
}
