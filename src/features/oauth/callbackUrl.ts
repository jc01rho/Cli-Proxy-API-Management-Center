/**
 * 手动回调输入 → 提交给后端的 redirect_url。
 *
 * xAI 和 Cline 可用本次登录的 state 补全页面显示的 code。
 * Devin 在调用前仍需严格校验完整 URL 与 state，见 devinOAuth.ts。
 */

export const XAI_CALLBACK_URL = 'http://127.0.0.1:56121/callback';
const CLINE_CALLBACK_URL = 'http://localhost:7829/callback';
const DEVIN_CALLBACK_URL = 'http://localhost/oauth-callback';

// 只认 http(s)：`code: xyz` 这类页面展示文本也能被 URL 解析（`code:` 是合法 scheme）。
const isAbsoluteHttpUrl = (value: string): boolean => {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const readQueryLikeCallbackInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const queryStart = trimmed.indexOf('?');
  const hashStart = trimmed.indexOf('#');
  const rawParams =
    queryStart >= 0
      ? trimmed.slice(queryStart + 1)
      : hashStart >= 0
        ? trimmed.slice(hashStart + 1)
        : trimmed;

  if (!/(^|[&#?])(code|state|error)=/i.test(rawParams)) return null;
  return new URLSearchParams(rawParams.replace(/^[?#]/, ''));
};

const extractDisplayedXaiCode = (value: string): string => {
  const trimmed = value.trim();
  const codeMatch = trimmed.match(/\bcode\s*[:=]\s*([^\s&]+)/i);
  return (codeMatch?.[1] ?? trimmed).trim();
};

const buildXaiCallbackUrl = (input: string, state?: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (isAbsoluteHttpUrl(trimmed)) return trimmed;

  const params = readQueryLikeCallbackInput(trimmed);
  if (params) {
    const code = params.get('code')?.trim();
    const error = params.get('error')?.trim();
    const errorDescription = params.get('error_description')?.trim();
    const callbackState = params.get('state')?.trim() || state?.trim();
    if (!callbackState) return null;

    const callbackUrl = new URL(XAI_CALLBACK_URL);
    callbackUrl.searchParams.set('state', callbackState);
    if (code) callbackUrl.searchParams.set('code', code);
    if (error) callbackUrl.searchParams.set('error', error);
    if (errorDescription) callbackUrl.searchParams.set('error_description', errorDescription);
    return callbackUrl.toString();
  }

  const code = extractDisplayedXaiCode(trimmed);
  const callbackState = state?.trim();
  if (!code || !callbackState) return null;

  const callbackUrl = new URL(XAI_CALLBACK_URL);
  callbackUrl.searchParams.set('code', code);
  callbackUrl.searchParams.set('state', callbackState);
  return callbackUrl.toString();
};

const buildClineCallbackUrl = (input: string, state?: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // If the input is already an absolute URL (the full callback redirect from
  // 9Router/WorkOS), just ensure it carries the state parameter. 9Router does
  // not echo state back, so we inject the state we generated at auth start.
  if (isAbsoluteHttpUrl(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!url.searchParams.get('state')) {
        const callbackState = state?.trim();
        if (!callbackState) return null;
        url.searchParams.set('state', callbackState);
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  // Query-like input (e.g. "code=eyJ...") or a raw code value.
  const params = readQueryLikeCallbackInput(trimmed);
  const callbackState = params?.get('state')?.trim() || state?.trim();
  if (!callbackState) return null;

  const url = new URL(CLINE_CALLBACK_URL);
  const code = params?.get('code')?.trim() || trimmed;
  url.searchParams.set('code', code);
  url.searchParams.set('state', callbackState);
  return url.toString();
};

const buildDevinCallbackUrl = (input: string, state?: string): string | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (isAbsoluteHttpUrl(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (!url.searchParams.get('state')) {
        const callbackState = state?.trim();
        if (!callbackState) return null;
        url.searchParams.set('state', callbackState);
      }
      return url.toString();
    } catch {
      return null;
    }
  }

  const params = readQueryLikeCallbackInput(trimmed);
  const callbackState = params?.get('state')?.trim() || state?.trim();
  if (!callbackState) return null;

  const url = new URL(DEVIN_CALLBACK_URL);
  const code = params?.get('code')?.trim() || trimmed;
  url.searchParams.set('code', code);
  url.searchParams.set('state', callbackState);
  return url.toString();
};

export const resolveCallbackUrl = (
  provider: string,
  input: string,
  state?: string
): string | null => {
  if (provider === 'xai') return buildXaiCallbackUrl(input, state);
  if (provider === 'cline') return buildClineCallbackUrl(input, state);
  if (provider === 'devin') return buildDevinCallbackUrl(input, state);
  return input.trim();
};
