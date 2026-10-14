import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import en from '../src/i18n/locales/en.json';
import { OAuthFlowDialog } from '../src/features/oauth/components/OAuthFlowDialog';
import {
  AUTH_FILE_ICONS,
  buildOAuthProviderOptions,
  getAuthFileIcon,
  getTypeLabel,
  supportsAuthFileManualRefresh,
} from '../src/features/authFiles/constants';
import { CALLBACK_SUPPORTED, KIRO_DEVICE_METHODS } from '../src/features/oauth/providers';
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
  test('offers all device methods and locks method selection during polling', async () => {
    expect(KIRO_DEVICE_METHODS.map((method) => method.id)).toEqual([
      'builder-id',
      'google',
      'github',
    ]);
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(OAuthFlowDialog, {
          open: true,
          providerId: 'kiro',
          heading: { title: 'Kiro', caption: '', icon: '' },
          state: {
            status: 'waiting',
            polling: true,
            url: 'https://aws.amazon.com/device',
            userCode: 'ABCD-EFGH',
          },
          text: (suffix: string) => i18n.t(`auth_login.kiro_${suffix}`),
          supportsCallback: false,
          onStart: () => {},
          onCancel: () => {},
          onCallbackChange: () => {},
          onCallbackSubmit: () => {},
          onViewAuthFiles: () => {},
          onClose: () => {},
        })
      )
    );
    expect(markup.match(/<button[^>]*disabled/g)).toHaveLength(3);
    expect(markup).toMatch(/<output[^>]*>ABCD-EFGH<\/output>/);
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('auth_login.');
  });

  test('treats Kiro as a poll-only built-in OAuth provider', () => {
    const provider: BuiltInOAuthProvider = 'kiro';

    expect(WEBUI_SUPPORTED_OAUTH_PROVIDERS.has(provider)).toBe(false);
    expect(CALLBACK_SUPPORTED.has(provider)).toBe(false);
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

    for (const method of KIRO_DEVICE_METHODS) {
      await expect(oauthApi.startAuth('kiro', { provider: method.id })).resolves.toEqual({
        url: 'https://aws.amazon.com/device?user_code=ABCD',
        state: 'kiro-1',
        user_code: 'ABCD-EFGH',
        expires_in: 600,
      });
      expect(requestedPath).toBe('/v0/management/kiro-auth-url');
      expect(requestedParams).toEqual({ provider: method.id });
    }
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
