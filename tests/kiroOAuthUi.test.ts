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

afterEach(() => {
  apiClient.get = originalGet;
});

describe('Kiro OAuth UI support', () => {
  test('treats Kiro as a poll-only built-in OAuth provider', () => {
    const provider: BuiltInOAuthProvider = 'kiro';

    expect(WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
    expect(CALLBACK_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
  });

  test('uses Kiro’s management poll start-auth contract with provider query and without is_webui', async () => {
    let requestedPath = '';
    let requestedParams: unknown;
    apiClient.get = (async (path, config) => {
      requestedPath = path;
      requestedParams = config?.params;
      return {
        url: 'https://aws.amazon.com/device?user_code=ABCD',
        state: 'kiro-1',
        user_code: 'ABCD-EFGH',
        expires_in: 600,
      };
    }) as typeof apiClient.get;

    await expect(oauthApi.startAuth('kiro', { provider: 'google' })).resolves.toEqual({
      url: 'https://aws.amazon.com/device?user_code=ABCD',
      state: 'kiro-1',
      user_code: 'ABCD-EFGH',
      expires_in: 600,
    });
    expect(requestedPath).toBe('/kiro-auth-url');
    expect(requestedParams).toEqual({ provider: 'google' });
  });

  test('includes Kiro in auth-file provider presets with a branded icon and label', () => {
    expect(buildOAuthProviderOptions([])).toContain('kiro');
    expect(AUTH_FILE_ICONS.kiro).toBeDefined();
    expect(getAuthFileIcon('kiro', 'light')).toBeTruthy();
    expect(supportsAuthFileManualRefresh('kiro')).toBe(true);
    expect(
      getTypeLabel(
        ((key: string) => (key === 'auth_files.filter_kiro' ? 'Kiro' : key)) as never,
        'kiro'
      )
    ).toBe('Kiro');
  });
});
