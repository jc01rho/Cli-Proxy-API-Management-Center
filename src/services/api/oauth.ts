/**
 * OAuth 与设备码登录相关 API
 */

import { apiClient, legacyManagementPath } from './client';
import {
  isManagementOAuthProviderKey,
  normalizeManagementOAuthProviderKey,
} from '@/utils/providerKeys';

export type BuiltInOAuthProvider =
  | 'codex'
  | 'anthropic'
  | 'antigravity'
  | 'kimi'
  | 'kimi-ai'
  | 'xai'
  | 'meta'
  | 'cline'
  | 'cursor'
  | 'kilo'
  | 'kiro'
  | 'zcode'
  | 'devin'
  | 'workbuddy';

export interface OAuthStartResponse {
  url: string;
  state?: string;
  user_code?: string;
  flow?: string;
  expires_in?: number;
}

export interface OAuthCallbackResponse {
  status: 'ok';
}

export interface OAuthCancelResponse {
  status: 'ok';
  cancelled: boolean;
}

// devin is intentionally excluded: its start-auth contract must not receive
// is_webui, unlike the other WebUI-driven OAuth providers.
export const WEBUI_SUPPORTED_OAUTH_PROVIDERS = new Set<BuiltInOAuthProvider>([
  'codex',
  'anthropic',
  'antigravity',
  'xai',
  'cline',
]);

// Fork-only built-in logins are registered by the fork backend on v0 only; the v8 dispatcher
// covers upstream providers and plugin logins.
const LEGACY_OAUTH_START_PROVIDERS = new Set<string>([
  'cline',
  'cursor',
  'kilo',
  'kiro',
  'zcode',
  'workbuddy',
]);

const normalizeProviderForManagementPath = (provider: string): string => {
  const key = normalizeManagementOAuthProviderKey(provider);
  if (!isManagementOAuthProviderKey(key)) {
    throw new Error('Invalid OAuth provider');
  }
  return key === 'anthropic' ? 'claude' : key;
};

export const oauthApi = {
  startAuth: (
    provider: string,
    extraOrSignal?: Record<string, string> | AbortSignal,
    signal?: AbortSignal
  ) => {
    const providerKey = normalizeProviderForManagementPath(provider);
    const extra = extraOrSignal instanceof AbortSignal ? undefined : extraOrSignal;
    const requestSignal = extraOrSignal instanceof AbortSignal ? extraOrSignal : signal;
    const params: Record<string, string | boolean> = { ...(extra ?? {}) };
    const webUIKey = providerKey === 'claude' ? 'anthropic' : providerKey;
    if (WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(webUIKey as BuiltInOAuthProvider)) {
      params.is_webui = true;
    }
    if (!LEGACY_OAUTH_START_PROVIDERS.has(providerKey)) {
      return apiClient.get<OAuthStartResponse>('/oauth/auth-url', {
        params: { provider: providerKey, ...params },
        ...(requestSignal ? { signal: requestSignal } : {}),
      });
    }
    return apiClient.get<OAuthStartResponse>(legacyManagementPath(`/${providerKey}-auth-url`), {
      params: Object.keys(params).length ? params : undefined,
      ...(requestSignal ? { signal: requestSignal } : {}),
    });
  },

  getAuthStatus: (state: string, signal?: AbortSignal) =>
    apiClient.get<{ status: 'ok' | 'wait' | 'error'; error?: string }>(`/oauth/status`, {
      params: { state },
      ...(signal ? { signal } : {}),
    }),

  cancelSession: (state: string, signal?: AbortSignal) =>
    apiClient.delete<OAuthCancelResponse>('/oauth/session', {
      params: { state },
      ...(signal ? { signal } : {}),
    }),

  submitCallback: (provider: string, redirectUrl: string, signal?: AbortSignal) => {
    const providerKey = normalizeProviderForManagementPath(provider);
    return apiClient.post<OAuthCallbackResponse>(
      '/oauth/callback',
      { provider: providerKey, redirect_url: redirectUrl },
      signal ? { signal } : undefined
    );
  },
};
