import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import en from '@/i18n/locales/en.json';
import zhCN from '@/i18n/locales/zh-CN.json';
import zhTW from '@/i18n/locales/zh-TW.json';
import ru from '@/i18n/locales/ru.json';
import ko from '@/i18n/locales/ko.json';
import vi from '@/i18n/locales/vi.json';
import { OAuthPage } from '@/features/oauth/OAuthPage';
import { OAuthFlowDialog } from '@/features/oauth/components/OAuthFlowDialog';
import type { ProviderFlowState } from '@/features/oauth/hooks/useOAuthFlows';
import {
  CLINE_CALLBACK_URL,
  resolveCallbackUrl,
  XAI_CALLBACK_URL,
} from '@/features/oauth/callbackUrl';
import { resolveFlowView, splitAuthUrl } from '@/features/oauth/flowView';
import {
  buildPluginOAuthProviderCards,
  KIRO_DEVICE_METHODS,
  OAUTH_PROVIDERS,
  supportsManualCallback,
} from '@/features/oauth/providers';
import {
  KIMI_CHINESE_AFFILIATE_URL,
  KIMI_INTERNATIONAL_AFFILIATE_URL,
} from '@/features/providers/kimi';
import type { PluginListEntry } from '@/types';

describe('OAuth dialog view resolution', () => {
  test('maps every flow state to exactly one view', () => {
    expect(resolveFlowView({})).toBe('idle');
    // 正在生成链接：已进入步骤视图（骨架占位）
    expect(resolveFlowView({ status: 'waiting' })).toBe('flow');
    expect(resolveFlowView({ status: 'waiting', url: 'https://a.test' })).toBe('flow');
    expect(resolveFlowView({ status: 'success' })).toBe('success');
    // 轮询网络失败但链接仍在：留在步骤视图，手动回调仍可恢复
    expect(resolveFlowView({ status: 'error', url: 'https://a.test' })).toBe('flow');
    // 链接已失效（启动失败 / Devin 终态失败）：失败视图
    expect(resolveFlowView({ status: 'error', error: 'denied' })).toBe('failed');
  });

  test('highlights the host of the authorization link', () => {
    expect(splitAuthUrl('https://auth.openai.com/oauth/authorize?x=1')).toEqual({
      host: 'auth.openai.com',
      rest: '/oauth/authorize?x=1',
    });
    expect(splitAuthUrl('http://127.0.0.1:8317/cb')).toEqual({
      host: '127.0.0.1:8317',
      rest: '/cb',
    });
    expect(splitAuthUrl('not a url')).toEqual({ host: '', rest: 'not a url' });
  });
});

describe('manual callback input', () => {
  test('restores the Cline attempt state when its broker omits it', () => {
    const built = new URL(
      resolveCallbackUrl('cline', 'https://broker.example/callback?code=abc', 'current')!
    );
    expect(built.origin).toBe('https://broker.example');
    expect(built.searchParams.get('code')).toBe('abc');
    expect(built.searchParams.get('state')).toBe('current');
    expect(resolveCallbackUrl('cline', 'cline://callback?code=abc', 'current')).toBe(
      'cline://callback?code=abc&state=current'
    );
    expect(
      new URL(
        resolveCallbackUrl(
          'cline',
          'https://broker.example/callback?code=abc&state=pasted',
          'current'
        )!
      ).searchParams.get('state')
    ).toBe('pasted');
  });

  test('builds Cline callbacks from raw and query codes without inventing a state', () => {
    for (const input of ['abc', '?code=abc', 'code=abc']) {
      const built = new URL(resolveCallbackUrl('cline', input, 'current')!);
      expect(`${built.origin}${built.pathname}`).toBe(CLINE_CALLBACK_URL);
      expect(built.searchParams.get('code')).toBe('abc');
      expect(built.searchParams.get('state')).toBe('current');
      expect(resolveCallbackUrl('cline', input)).toBeNull();
    }
    expect(
      new URL(resolveCallbackUrl('cline', '?code=abc&state=pasted', 'current')!).searchParams.get(
        'state'
      )
    ).toBe('pasted');
    expect(resolveCallbackUrl('cline', 'https://broker.example/callback?code=abc')).toBeNull();
    expect(resolveCallbackUrl('cline', ' ', 'current')).toBeNull();
  });

  test('submits non-xAI input verbatim (trimmed)', () => {
    expect(resolveCallbackUrl('codex', '  http://localhost:1455/auth/callback?code=c  ')).toBe(
      'http://localhost:1455/auth/callback?code=c'
    );
  });

  test('passes absolute xAI callback URLs through', () => {
    const url = 'http://127.0.0.1:56121/callback?code=c&state=s';
    expect(resolveCallbackUrl('xai', url, 'other')).toBe(url);
  });

  test('builds the xAI loopback URL from a displayed code and the attempt state', () => {
    const built = new URL(resolveCallbackUrl('xai', 'abc123', 'st-1')!);
    expect(`${built.origin}${built.pathname}`).toBe(XAI_CALLBACK_URL);
    expect(built.searchParams.get('code')).toBe('abc123');
    expect(built.searchParams.get('state')).toBe('st-1');
    expect(new URL(resolveCallbackUrl('xai', 'code: xyz', 'st-1')!).searchParams.get('code')).toBe(
      'xyz'
    );
  });

  test('prefers the pasted query state and keeps provider errors', () => {
    const built = new URL(
      resolveCallbackUrl('xai', '?error=access_denied&error_description=no&state=pasted', 'st')!
    );
    expect(built.searchParams.get('state')).toBe('pasted');
    expect(built.searchParams.get('error')).toBe('access_denied');
    expect(built.searchParams.get('error_description')).toBe('no');
  });

  test('refuses to invent a state for xAI', () => {
    expect(resolveCallbackUrl('xai', 'abc123')).toBeNull();
    expect(resolveCallbackUrl('xai', 'code=abc123')).toBeNull();
    expect(resolveCallbackUrl('xai', '   ', 'st')).toBeNull();
  });

  test('normalizes Cline raw codes, query codes, and redirects without losing attempt state', () => {
    for (const input of ['fixture-code', '?code=fixture-code']) {
      const url = new URL(resolveCallbackUrl('cline', input, 'attempt')!);
      expect(url.origin + url.pathname).toBe('http://localhost:7829/callback');
      expect(url.searchParams.get('code')).toBe('fixture-code');
      expect(url.searchParams.get('state')).toBe('attempt');
    }
    const redirect = 'http://localhost:7829/callback?code=fixture-code';
    expect(new URL(resolveCallbackUrl('cline', redirect, 'attempt')!).searchParams.get('state'))
      .toBe('attempt');
    expect(
      new URL(resolveCallbackUrl('cline', `${redirect}&state=pasted`, 'attempt')!)
        .searchParams.get('state')
    ).toBe('pasted');
    expect(resolveCallbackUrl('cline', 'fixture-code')).toBeNull();
    expect(resolveCallbackUrl('cline', redirect)).toBeNull();
    expect(resolveCallbackUrl('cline', ' ', 'attempt')).toBeNull();
  });

  test('preserves a validated Devin redirect including custom port, TLS, and denial fields', () => {
    const redirect = 'https://localhost:9443/devin/callback?error=denied&state=attempt';
    expect(resolveCallbackUrl('devin', redirect, 'attempt')).toBe(redirect);
  });

  test('normalizes Devin redirects and codes while preserving explicit callback state', () => {
    const redirect = 'https://localhost:9443/devin/callback?code=fixture-code';
    const built = new URL(resolveCallbackUrl('devin', redirect, 'attempt')!);
    expect(built.origin + built.pathname).toBe('https://localhost:9443/devin/callback');
    expect(built.searchParams.get('code')).toBe('fixture-code');
    expect(built.searchParams.get('state')).toBe('attempt');
    expect(
      new URL(resolveCallbackUrl('devin', `${redirect}&state=pasted`, 'attempt')!)
        .searchParams.get('state')
    ).toBe('pasted');
    for (const input of ['fixture-code', '?code=fixture-code']) {
      const url = new URL(resolveCallbackUrl('devin', input, 'attempt')!);
      expect(url.origin + url.pathname).toBe('http://localhost/oauth-callback');
      expect(url.searchParams.get('code')).toBe('fixture-code');
      expect(url.searchParams.get('state')).toBe('attempt');
      expect(resolveCallbackUrl('devin', input)).toBeNull();
    }
    expect(resolveCallbackUrl('devin', redirect)).toBeNull();
    expect(resolveCallbackUrl('devin', ' ', 'attempt')).toBeNull();
  });
});

const plugin = (overrides: Partial<PluginListEntry>): PluginListEntry => ({
  id: 'example',
  path: '/plugins/example',
  configured: true,
  registered: true,
  enabled: true,
  effectiveEnabled: true,
  supportsOAuth: true,
  oauthProvider: 'example',
  supportsQuota: false,
  logo: '',
  configFields: [],
  menus: [],
  metadata: null,
  ...overrides,
});

describe('plugin OAuth tiles', () => {
  test('appends enabled OAuth plugins once and never shadows built-in providers', () => {
    const cards = buildPluginOAuthProviderCards(
      [
        plugin({ id: 'a', oauthProvider: 'acme' }),
        plugin({ id: 'a-dup', oauthProvider: 'acme' }),
        plugin({ id: 'b', oauthProvider: 'codex' }),
        plugin({ id: 'fork-duplicate', oauthProvider: 'cline' }),
        plugin({ id: 'c', oauthProvider: 'off', effectiveEnabled: false }),
        plugin({ id: 'd', oauthProvider: 'nooauth', supportsOAuth: false }),
        plugin({ id: 'e', oauthProvider: undefined }),
      ],
      'http://127.0.0.1:8317'
    );
    expect(cards.map((card) => [card.id, card.title])).toEqual([['acme', 'a']]);
  });
});

describe('OAuth provider gallery', () => {
  test('preserves fork login cards and their callback capabilities', () => {
    for (const id of ['cline', 'cursor', 'kilo', 'kiro', 'zcode', 'workbuddy']) {
      const card = OAUTH_PROVIDERS.find((provider) => provider.id === id);
      expect(card).toBeDefined();
      expect(supportsManualCallback(card!)).toBe(id === 'cline');
    }
    for (const id of ['gemini', 'qwen', 'iflow', 'trae']) {
      expect(OAUTH_PROVIDERS.some((provider) => provider.id === id)).toBe(false);
    }
  });

  const locales = { en, 'zh-CN': zhCN, 'zh-TW': zhTW, ru, ko, vi } as const;

  test('keeps all fork providers and their manual-callback capabilities', () => {
    for (const id of ['cline', 'cursor', 'kilo', 'kiro', 'zcode', 'workbuddy']) {
      const provider = OAUTH_PROVIDERS.find((card) => card.id === id);
      expect(provider).toBeDefined();
      expect(supportsManualCallback(provider!)).toBe(id === 'cline');
      expect(
        buildPluginOAuthProviderCards([plugin({ oauthProvider: id })], 'http://localhost:8317')
      ).toEqual([]);
    }
    expect(KIRO_DEVICE_METHODS.map((method) => method.id)).toEqual([
      'builder-id', 'google', 'github',
    ]);
  });

  for (const [lng, translation] of Object.entries(locales)) {
    test(`renders every provider tile without raw keys (${lng})`, async () => {
      const i18n = createInstance();
      await i18n.init({ lng, resources: { [lng]: { translation } } });
      const markup = renderToStaticMarkup(
        createElement(
          I18nextProvider,
          { i18n },
          createElement(MemoryRouter, null, createElement(OAuthPage))
        )
      );
      for (const provider of OAUTH_PROVIDERS) {
        const label =
          typeof provider.label === 'string' ? provider.label : i18n.t(provider.label.key);
        expect(markup).toContain(label);
      }
      expect(markup).toContain('Vertex AI');
      expect(markup).not.toMatch(/auth_login\.|vertex_import\./);
      // 每个磁贴都是打开对话框的按钮
      expect(markup.match(/aria-haspopup="dialog"/g)?.length).toBe(OAUTH_PROVIDERS.length + 1);
    });

    test(`renders Kiro method choices, device code, and retry states (${lng})`, async () => {
      const i18n = createInstance();
      await i18n.init({ lng, resources: { [lng]: { translation } } });
      const renderDialog = (state: ProviderFlowState) =>
        renderToStaticMarkup(
          createElement(
            I18nextProvider,
            { i18n },
            createElement(OAuthFlowDialog, {
              open: true,
              providerId: 'kiro',
              heading: { title: i18n.t('auth_login.kiro_oauth_title'), caption: '', icon: '' },
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
      for (const state of [
        {},
        { status: 'error' },
        { status: 'error', url: 'https://aws.example/device' },
        { status: 'success' },
      ] satisfies ProviderFlowState[]) {
        const markup = renderDialog(state);
        for (const method of KIRO_DEVICE_METHODS) {
          expect(markup).toContain(i18n.t(method.labelKey));
        }
        expect(markup).not.toContain('auth_login.');
      }
      const waiting = renderDialog({
        status: 'waiting',
        url: 'https://aws.example/device',
        userCode: 'ABCD-EFGH',
      });
      expect(waiting).toContain('ABCD-EFGH');
      expect(waiting).toContain(i18n.t('auth_login.device_code_copy'));
      expect(waiting).not.toContain(i18n.t('auth_login.oauth_callback_label'));
    });
  }

  test('keeps both Kimi registration links as safe external links', async () => {
    const i18n = createInstance();
    await i18n.init({ lng: 'en', resources: { en: { translation: en } } });
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MemoryRouter, null, createElement(OAuthPage))
      )
    );
    for (const url of [KIMI_CHINESE_AFFILIATE_URL, KIMI_INTERNATIONAL_AFFILIATE_URL]) {
      const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/&/g, '&amp;');
      expect(markup).toMatch(
        new RegExp(`href="${escaped}" target="_blank" rel="noopener noreferrer"`)
      );
    }
  });
});
