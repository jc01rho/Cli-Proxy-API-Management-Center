/**
 * 手动回调输入 → 提交给后端的 redirect_url。
 *
 * xAI 和 Cline 支持从 code 拼回固定的回环地址，Cline 还需补回未回传的 state。
 * Devin 也可补全 state，但 OAuth 流程调用前仍有严格校验，见 devinOAuth.ts。
 */

export const XAI_CALLBACK_URL = 'http://127.0.0.1:56121/callback';
export const CLINE_CALLBACK_URL = 'http://localhost:7829/callback';
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

  // Cline's broker does not echo state; preserve a pasted state when present.
  try {
    const url = new URL(trimmed);
    if (!url.searchParams.get('state')) {
      const callbackState = state?.trim();
      if (!callbackState) return null;
      url.searchParams.set('state', callbackState);
    }
    return url.toString();
  } catch {
    // A raw code or query string is not an absolute redirect URL.
  }

  const params = readQueryLikeCallbackInput(trimmed);
  const callbackState = params?.get('state')?.trim() || state?.trim();
  if (!callbackState) return null;
  const url = new URL(CLINE_CALLBACK_URL);
  url.searchParams.set('code', params?.get('code')?.trim() || trimmed);
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
