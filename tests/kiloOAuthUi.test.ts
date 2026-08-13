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

describe('Kilo OAuth UI support', () => {
  test('treats Kilo as a poll-only built-in OAuth provider', () => {
    const provider: BuiltInOAuthProvider = 'kilo';

    expect(WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
    expect(CALLBACK_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
  });

  test('uses Kilo’s management poll start-auth contract without is_webui', async () => {
    let requestedPath = '';
    let requestedParams: unknown;
    apiClient.get = (async (path, config) => {
      requestedPath = path;
      requestedParams = config?.params;
      return { url: 'https://kilo.ai/device?code=x', state: 'kilo-1' };
    }) as typeof apiClient.get;

    await expect(oauthApi.startAuth('kilo')).resolves.toEqual({
      url: 'https://kilo.ai/device?code=x',
      state: 'kilo-1',
    });
    expect(requestedPath).toBe('/kilo-auth-url');
    expect(requestedParams).toBeUndefined();
  });

  test('includes Kilo in auth-file provider presets with a branded icon and label', () => {
    expect(buildOAuthProviderOptions([])).toContain('kilo');
    expect(AUTH_FILE_ICONS.kilo).toBeDefined();
    expect(getAuthFileIcon('kilo', 'light')).toBeTruthy();
    expect(supportsAuthFileManualRefresh('kilo')).toBe(true);
    expect(
      getTypeLabel(
        ((key: string) => (key === 'auth_files.filter_kilo' ? 'Kilo' : key)) as never,
        'kilo'
      )
    ).toBe('Kilo');
  });
});
