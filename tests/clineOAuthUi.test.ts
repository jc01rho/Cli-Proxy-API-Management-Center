import { afterEach, describe, expect, test } from 'bun:test';
import {
  AUTH_FILE_ICONS,
  buildOAuthProviderOptions,
  getAuthFileIcon,
  getTypeLabel,
  supportsAuthFileManualRefresh,
} from '../src/features/authFiles/constants';
import { CALLBACK_SUPPORTED_OAUTH_PROVIDERS } from '../src/pages/OAuthPage';
import { apiClient } from '../src/services/api/client';
import {
  oauthApi,
  WEBUI_SUPPORTED_OAUTH_PROVIDERS,
  type BuiltInOAuthProvider,
} from '../src/services/api/oauth';

const originalGet = apiClient.get;
const originalPost = apiClient.post;

afterEach(() => {
  apiClient.get = originalGet;
  apiClient.post = originalPost;
});

describe('Cline OAuth UI support', () => {
  test('treats Cline as a built-in Web UI OAuth provider with callback support', () => {
    const provider: BuiltInOAuthProvider = 'cline';

    expect(WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(true);
    expect(CALLBACK_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(true);
  });

  test('uses Cline’s canonical generic management API start-auth contract', async () => {
    let requestedPath = '';
    let requestedParams: unknown;
    apiClient.get = (async (path, config) => {
      requestedPath = path;
      requestedParams = config?.params;
      return { url: 'https://cline.example/authorize', state: 'cline-state' };
    }) as typeof apiClient.get;

    await expect(oauthApi.startAuth('cline')).resolves.toEqual({
      url: 'https://cline.example/authorize',
      state: 'cline-state',
    });
    expect(requestedPath).toBe('/cline-auth-url');
    expect(requestedParams).toEqual({ is_webui: true });
  });

  test('uses the shared status polling and callback contracts for Cline', async () => {
    const getCalls: Array<{ path: string; params: unknown }> = [];
    let callbackPayload: unknown;
    apiClient.get = (async (path, config) => {
      getCalls.push({ path, params: config?.params });
      return { status: 'wait' };
    }) as typeof apiClient.get;
    apiClient.post = (async (_path, payload) => {
      callbackPayload = payload;
      return { status: 'ok' };
    }) as typeof apiClient.post;

    await expect(oauthApi.getAuthStatus('cline-state')).resolves.toEqual({ status: 'wait' });
    await expect(
      oauthApi.submitCallback('cline', 'http://localhost:1455/auth/callback?code=code&state=cline-state')
    ).resolves.toEqual({ status: 'ok' });

    expect(getCalls).toEqual([{ path: '/get-auth-status', params: { state: 'cline-state' } }]);
    expect(callbackPayload).toEqual({
      provider: 'cline',
      redirect_url: 'http://localhost:1455/auth/callback?code=code&state=cline-state',
    });
  });

  test('includes Cline in auth-file provider presets with a branded icon and label', () => {
    expect(buildOAuthProviderOptions([])).toContain('cline');
    expect(AUTH_FILE_ICONS.cline).toBeDefined();
    expect(getAuthFileIcon('cline', 'light')).toBeTruthy();
    expect(getAuthFileIcon('cline', 'dark')).toBeTruthy();
    expect(supportsAuthFileManualRefresh('cline')).toBe(true);
    expect(
      getTypeLabel(
        ((key: string) => (key === 'auth_files.filter_cline' ? 'Cline' : key)) as never,
        'cline'
      )
    ).toBe('Cline');
  });
});
