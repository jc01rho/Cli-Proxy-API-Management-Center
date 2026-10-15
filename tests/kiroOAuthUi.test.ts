import { afterEach, describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import en from '../src/i18n/locales/en.json';
import { OAuthFlowDialog } from '../src/features/oauth/components/OAuthFlowDialog';
import type { ProviderFlowState } from '../src/features/oauth/hooks/useOAuthFlows';
import {
  AUTH_FILE_ICONS,
  buildOAuthProviderOptions,
  getAuthFileIcon,
  getTypeLabel,
  supportsAuthFileManualRefresh,
} from '../src/features/authFiles/constants';
import {
  buildKiroStartParams,
  CALLBACK_SUPPORTED,
  KIRO_DEVICE_METHODS,
  startKiroLogin,
} from '../src/features/oauth/providers';
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
  const method = (id: (typeof KIRO_DEVICE_METHODS)[number]['id']) => {
    const selected = KIRO_DEVICE_METHODS.find((item) => item.id === id);
    if (!selected) throw new Error(`Missing Kiro method ${id}`);
    return selected;
  };

  test('offers all device methods and locks method selection during polling', async () => {
    expect(KIRO_DEVICE_METHODS.map((method) => method.id)).toEqual([
      'builder-id',
      'google',
      'github',
      'organization',
      'apikey',
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
    expect(markup.match(/<button[^>]*disabled/g)).toHaveLength(5);
    expect(markup).toMatch(/<output[^>]*>ABCD-EFGH<\/output>/);
    expect(markup).not.toContain('<input');
    expect(markup).not.toContain('auth_login.');
  });

  test('hides the browser steps while an API-key login is running', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const render = (state: ProviderFlowState) =>
      renderToStaticMarkup(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(OAuthFlowDialog, {
            open: true,
            providerId: 'kiro',
            heading: { title: 'Kiro', caption: '', icon: '' },
            state,
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

    const device = render({
      status: 'waiting',
      url: 'https://aws.amazon.com/device',
      userCode: 'ABCD-EFGH',
    });
    expect(device).toContain('<ol');
    expect(device).toContain('ABCD-EFGH');

    const apiKey = render({ status: 'waiting', flow: 'apikey' });
    expect(apiKey).not.toContain('<ol');
    expect(apiKey).not.toContain('user_code');
    expect(apiKey).not.toContain('auth_login.');
  });

  test('starts organization login with its provider, start URL, and region', async () => {
    let requestedParams: unknown;
    apiClient.get = (async (_path, config) => {
      requestedParams = config?.params;
      return { url: 'https://aws.amazon.com/device', state: 'organization-1' };
    }) as typeof apiClient.get;

    let started: Promise<unknown> | undefined;
    startKiroLogin(
      method('organization'),
      {
        startUrl: ' https://example.awsapps.com/start ',
        region: ' us-west-2 ',
        apiKey: 'ksk_not_for_this_method',
      },
      (params) => {
        started = oauthApi.startAuth('kiro', params);
      }
    );
    await started;
    expect(requestedParams).toEqual({
      provider: 'organization',
      startUrl: 'https://example.awsapps.com/start',
      region: 'us-west-2',
    });
  });

  test('starts API-key login with its provider and trimmed key', async () => {
    let requestedParams: unknown;
    apiClient.get = (async (_path, config) => {
      requestedParams = config?.params;
      return { state: 'apikey-1', flow: 'apikey' };
    }) as typeof apiClient.get;

    let started: Promise<unknown> | undefined;
    startKiroLogin(method('apikey'), { apiKey: ' ksk_test ' }, (params) => {
      started = oauthApi.startAuth('kiro', params);
    });
    await started;
    expect(requestedParams).toEqual({ provider: 'apikey', apiKey: 'ksk_test' });
  });

  test('does not start a Kiro method while a required input is empty', () => {
    let requestCount = 0;
    apiClient.get = (async () => {
      requestCount += 1;
      return { state: 'unexpected' };
    }) as typeof apiClient.get;

    for (const id of ['organization', 'apikey'] as const) {
      for (const values of [{}, { startUrl: '   ', apiKey: ' \n ' }]) {
        startKiroLogin(method(id), values, (params) => {
          void oauthApi.startAuth('kiro', params);
        });
        expect(buildKiroStartParams(method(id), values)).toBeUndefined();
      }
    }
    expect(requestCount).toBe(0);
  });

  test('keeps legacy Kiro methods to the provider parameter only', async () => {
    const requestedParams: unknown[] = [];
    apiClient.get = (async (_path, config) => {
      requestedParams.push(config?.params);
      return { state: 'legacy', url: 'https://aws.amazon.com/device' };
    }) as typeof apiClient.get;

    for (const id of ['builder-id', 'google', 'github'] as const) {
      let started: Promise<unknown> | undefined;
      startKiroLogin(method(id), { startUrl: 'ignored', apiKey: 'ignored' }, (params) => {
        started = oauthApi.startAuth('kiro', params);
      });
      await started;
    }
    expect(requestedParams).toEqual([
      { provider: 'builder-id' },
      { provider: 'google' },
      { provider: 'github' },
    ]);
  });

  test('omits the optional blank region so the backend can use its default', () => {
    expect(
      buildKiroStartParams(method('organization'), {
        startUrl: 'https://example.awsapps.com/start',
        region: ' ',
      })
    ).toEqual({ provider: 'organization', startUrl: 'https://example.awsapps.com/start' });
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
