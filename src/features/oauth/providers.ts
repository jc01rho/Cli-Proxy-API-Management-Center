import type { BuiltInOAuthProvider } from '@/services/api';
import { getPluginTitle, resolvePluginAssetURL } from '@/features/plugins/pluginResources';
import {
  KIMI_CHINESE_AFFILIATE_URL,
  KIMI_INTERNATIONAL_AFFILIATE_URL,
} from '@/features/providers/kimi';
import type { PluginListEntry } from '@/types';
import iconMeta from '@/assets/icons/meta.svg';
import iconCodex from '@/assets/icons/codex.svg';
import iconClaude from '@/assets/icons/claude.svg';
import iconAntigravity from '@/assets/icons/antigravity.svg';
// 赞助卡用的 App 图标版：K 与蓝点等比内缩进方块，蓝点不再顶出圆角
import iconKimiTileBlack from '@/assets/icons/kimi-tile-black.svg';
import iconKimiTileWhite from '@/assets/icons/kimi-tile-white.svg';
import iconGrok from '@/assets/icons/grok.svg';
import iconGrokDark from '@/assets/icons/grok-dark.svg';
import iconDevin from '@/assets/icons/devin.svg';
import iconDevinDark from '@/assets/icons/devin-dark.svg';
import iconClineLight from '@/assets/icons/cline-light.svg';
import iconClineDark from '@/assets/icons/cline-dark.svg';
import iconCursor from '@/assets/icons/cursor.svg';
import iconKilo from '@/assets/icons/kilo.svg';
import iconGlm from '@/assets/icons/glm.svg';
import iconWorkBuddy from '@/assets/icons/workbuddy.svg';

const iconKiro =
  'https://assets.sso-portal.us-east-1.amazonaws.com/2026-04-23-22-28-30-834/dfdedec4059f625ed152.svg';

export interface KiroLoginMethod {
  id: 'builder-id' | 'google' | 'github' | 'organization' | 'apikey';
  labelKey: string;
  fields?: readonly {
    name: 'startUrl' | 'region' | 'apiKey';
    labelKey: string;
    placeholderKey: string;
    required: boolean;
    type: 'text' | 'password';
  }[];
}

export const KIRO_DEVICE_METHODS: readonly KiroLoginMethod[] = [
  { id: 'builder-id', labelKey: 'auth_login.kiro_oauth_method_builder_id' },
  { id: 'google', labelKey: 'auth_login.kiro_oauth_method_google' },
  { id: 'github', labelKey: 'auth_login.kiro_oauth_method_github' },
  {
    id: 'organization',
    labelKey: 'auth_login.kiro_oauth_method_organization',
    fields: [
      {
        name: 'startUrl',
        labelKey: 'auth_login.kiro_oauth_start_url_label',
        placeholderKey: 'auth_login.kiro_oauth_start_url_placeholder',
        required: true,
        type: 'text',
      },
      {
        name: 'region',
        labelKey: 'auth_login.kiro_oauth_region_label',
        placeholderKey: 'auth_login.kiro_oauth_region_placeholder',
        required: false,
        type: 'text',
      },
    ],
  },
  {
    id: 'apikey',
    labelKey: 'auth_login.kiro_oauth_method_apikey',
    fields: [
      {
        name: 'apiKey',
        labelKey: 'auth_login.kiro_oauth_api_key_label',
        placeholderKey: 'auth_login.kiro_oauth_api_key_placeholder',
        required: true,
        type: 'password',
      },
    ],
  },
] as const;

export const buildKiroStartParams = (
  method: KiroLoginMethod,
  values: Record<string, string>
): Record<string, string> | undefined => {
  const params: Record<string, string> = { provider: method.id };
  for (const field of method.fields ?? []) {
    const value = (values[field.name] ?? '').trim();
    if (field.required && !value) return undefined;
    if (value) params[field.name] = value;
  }
  return params;
};

export const startKiroLogin = (
  method: KiroLoginMethod,
  values: Record<string, string>,
  onStart: (params: Record<string, string>) => void
): void => {
  const params = buildKiroStartParams(method, values);
  if (params) onStart(params);
};

export type ThemedIcon = string | { light: string; dark: string };

/** 设备码流程会返回 user_code；浏览器流程依赖回调（本地自动 / 远程手动粘贴）。 */
export type OAuthFlowKind = 'device' | 'browser';

export interface BuiltInOAuthProviderCard {
  kind: 'builtin';
  id: BuiltInOAuthProvider;
  /** 磁贴短名：品牌名是常量（与仪表盘 providerLabel 一致），区域站点走 i18n。 */
  label: string | { key: string };
  /** 对话框标题，沿用 `auth_login.<id>_oauth_title`。 */
  titleKey: string;
  icon: ThemedIcon;
  flow: OAuthFlowKind;
  /** 区分同品牌的不同站点，磁贴副行展示。 */
  domain?: string;
  /**
   * 赞助商：同品牌的各站点合并进画廊首行的一张品牌卡，每站一个登录入口 + 开放平台注册链接
   * （目前是 Kimi 国内站 / 国际站）。`siteKey` 是卡内站点短名（品牌名由卡片标题承载）。
   */
  sponsor?: SponsorSite;
}

export interface SponsorSite {
  signUpUrl: string;
  siteKey: string;
}

export interface PluginOAuthProviderCard {
  kind: 'plugin';
  id: string;
  title: string;
  icon: string;
}

export type OAuthProviderCard = BuiltInOAuthProviderCard | PluginOAuthProviderCard;

/** 展示顺序即数组顺序：赞助商（Kimi 两站）置首，其余沿用原有次序。 */
export const OAUTH_PROVIDERS: BuiltInOAuthProviderCard[] = [
  {
    kind: 'builtin',
    id: 'kimi',
    label: { key: 'auth_login.kimi_oauth_name' },
    titleKey: 'auth_login.kimi_oauth_title',
    icon: { light: iconKimiTileBlack, dark: iconKimiTileWhite },
    flow: 'device',
    domain: 'kimi.com',
    sponsor: { signUpUrl: KIMI_CHINESE_AFFILIATE_URL, siteKey: 'auth_login.sponsor_site_china' },
  },
  {
    kind: 'builtin',
    id: 'kimi-ai',
    label: { key: 'auth_login.kimi_ai_oauth_name' },
    titleKey: 'auth_login.kimi_ai_oauth_title',
    icon: { light: iconKimiTileBlack, dark: iconKimiTileWhite },
    flow: 'device',
    domain: 'kimi.ai',
    sponsor: {
      signUpUrl: KIMI_INTERNATIONAL_AFFILIATE_URL,
      siteKey: 'auth_login.sponsor_site_international',
    },
  },
  {
    kind: 'builtin',
    id: 'meta',
    label: 'Muse (Meta)',
    titleKey: 'auth_login.meta_oauth_title',
    icon: iconMeta,
    flow: 'device',
  },
  {
    kind: 'builtin',
    id: 'codex',
    label: 'Codex',
    titleKey: 'auth_login.codex_oauth_title',
    icon: iconCodex,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'anthropic',
    label: 'Claude',
    titleKey: 'auth_login.anthropic_oauth_title',
    icon: iconClaude,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'antigravity',
    label: 'Antigravity',
    titleKey: 'auth_login.antigravity_oauth_title',
    icon: iconAntigravity,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'xai',
    label: 'xAI',
    titleKey: 'auth_login.xai_oauth_title',
    icon: { light: iconGrok, dark: iconGrokDark },
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'cline',
    label: 'Cline',
    titleKey: 'auth_login.cline_oauth_title',
    icon: { light: iconClineLight, dark: iconClineDark },
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'cursor',
    label: 'Cursor',
    titleKey: 'auth_login.cursor_oauth_title',
    icon: iconCursor,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'kilo',
    label: 'Kilo',
    titleKey: 'auth_login.kilo_oauth_title',
    icon: iconKilo,
    flow: 'device',
  },
  {
    kind: 'builtin',
    id: 'kiro',
    label: 'Kiro',
    titleKey: 'auth_login.kiro_oauth_title',
    icon: iconKiro,
    flow: 'device',
  },
  {
    kind: 'builtin',
    id: 'zcode',
    label: 'Zcode',
    titleKey: 'auth_login.zcode_oauth_title',
    icon: iconGlm,
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'devin',
    label: 'Devin',
    titleKey: 'auth_login.devin_oauth_title',
    icon: { light: iconDevin, dark: iconDevinDark },
    flow: 'browser',
  },
  {
    kind: 'builtin',
    id: 'workbuddy',
    label: 'WorkBuddy',
    titleKey: 'auth_login.workbuddy_oauth_title',
    icon: iconWorkBuddy,
    flow: 'browser',
  },
];

const BUILTIN_PROVIDER_IDS = new Set<string>(OAUTH_PROVIDERS.map((provider) => provider.id));

/** 后端接受手动回调提交的内置提供商；插件提供商一律允许。 */
export const CALLBACK_SUPPORTED = new Set<string>([
  'codex',
  'anthropic',
  'antigravity',
  'xai',
  'cline',
  'devin',
]);

export const supportsManualCallback = (provider: OAuthProviderCard): boolean =>
  provider.kind === 'plugin' || CALLBACK_SUPPORTED.has(provider.id);

export const isSponsor = (
  provider: OAuthProviderCard
): provider is BuiltInOAuthProviderCard & { sponsor: SponsorSite } =>
  provider.kind === 'builtin' && Boolean(provider.sponsor);

export const resolveThemedIcon = (icon: ThemedIcon, theme: 'light' | 'dark'): string =>
  typeof icon === 'string' ? icon : icon[theme];

export const buildPluginOAuthProviderCards = (
  plugins: PluginListEntry[],
  apiBase: string
): PluginOAuthProviderCard[] => {
  const seenProviders = new Set(BUILTIN_PROVIDER_IDS);
  return plugins.flatMap((plugin) => {
    const provider = plugin.oauthProvider;
    if (
      !plugin.supportsOAuth ||
      !plugin.effectiveEnabled ||
      !provider ||
      seenProviders.has(provider)
    ) {
      return [];
    }
    seenProviders.add(provider);
    return [
      {
        kind: 'plugin' as const,
        id: provider,
        title: getPluginTitle(plugin),
        icon: resolvePluginAssetURL(plugin.logo || plugin.metadata?.logo || '', apiBase),
      },
    ];
  });
};
