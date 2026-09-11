import { afterEach, describe, expect, test } from 'bun:test';
import {
  AUTH_FILE_ICONS,
  buildOAuthProviderOptions,
  getAuthFileIcon,
  getTypeLabel,
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

describe('Devin OAuth UI support', () => {
  test('treats Devin as a callback-supported built-in OAuth provider', () => {
    const provider: BuiltInOAuthProvider = 'devin';

    expect(WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
    expect(CALLBACK_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(true);
  });

  test('uses Devin’s management start-auth contract without is_webui', async () => {
    let requestedPath = '';
    let requestedParams: unknown;
    apiClient.get = (async (path, config) => {
      requestedPath = path;
      requestedParams = config?.params;
      return { url: 'https://app.devin.ai/auth/cli/continue?state=x&cli_pkce_marker=1', state: 'x' };
    }) as typeof apiClient.get;

    await expect(oauthApi.startAuth('devin')).resolves.toEqual({
      url: 'https://app.devin.ai/auth/cli/continue?state=x&cli_pkce_marker=1',
      state: 'x',
    });
    expect(requestedPath).toBe('/devin-auth-url');
    expect(requestedParams).toBeUndefined();
  });

  test('includes Devin in auth-file provider presets with a branded icon and label', () => {
    expect(buildOAuthProviderOptions([])).toContain('devin');
    expect(AUTH_FILE_ICONS.devin).toBeDefined();

    const t = ((key: string) => key) as Parameters<typeof getTypeLabel>[0];
    expect(getTypeLabel(t, 'devin')).toBe('Devin');
    expect(getAuthFileIcon('devin', 'light')).toBe(AUTH_FILE_ICONS.devin);
  });
});
