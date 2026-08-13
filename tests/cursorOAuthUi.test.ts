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

describe('Cursor OAuth UI support', () => {
  test('treats Cursor as a poll-only built-in OAuth provider', () => {
    const provider: BuiltInOAuthProvider = 'cursor';

    expect(WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
    expect(CALLBACK_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
  });

  test('uses Cursor’s management poll start-auth contract without is_webui', async () => {
    let requestedPath = '';
    let requestedParams: unknown;
    apiClient.get = (async (path, config) => {
      requestedPath = path;
      requestedParams = config?.params;
      return { url: 'https://cursor.com/loginDeepControl?challenge=x&uuid=y', state: 'csr-1' };
    }) as typeof apiClient.get;

    await expect(oauthApi.startAuth('cursor')).resolves.toEqual({
      url: 'https://cursor.com/loginDeepControl?challenge=x&uuid=y',
      state: 'csr-1',
    });
    expect(requestedPath).toBe('/cursor-auth-url');
    expect(requestedParams).toBeUndefined();
  });

  test('includes Cursor in auth-file provider presets with a branded icon and label', () => {
    expect(buildOAuthProviderOptions([])).toContain('cursor');
    expect(AUTH_FILE_ICONS.cursor).toBeDefined();
    expect(getAuthFileIcon('cursor', 'light')).toBeTruthy();
    expect(supportsAuthFileManualRefresh('cursor')).toBe(true);
    expect(
      getTypeLabel(
        ((key: string) => (key === 'auth_files.filter_cursor' ? 'Cursor' : key)) as never,
        'cursor'
      )
    ).toBe('Cursor');
  });
});
