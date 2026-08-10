export type ApiKeyModelWhitelists = Record<string, string[]>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizePatterns(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((pattern) => String(pattern).trim())
        .filter(Boolean)
    )
  );
}

export function normalizeApiKeyModelWhitelists(
  value: ApiKeyModelWhitelists,
  apiKeys: string[]
): ApiKeyModelWhitelists {
  const activeKeys = new Set(apiKeys);
  const normalized: ApiKeyModelWhitelists = {};
  for (const [apiKey, patterns] of Object.entries(value)) {
    if (!activeKeys.has(apiKey)) continue;
    const nextPatterns = normalizePatterns(patterns);
    if (nextPatterns.length > 0) {
      normalized[apiKey] = nextPatterns;
    }
  }
  return normalized;
}

export function parseApiKeyModelWhitelists(
  raw: unknown,
  apiKeys: string[]
): ApiKeyModelWhitelists {
  const record = asRecord(raw);
  if (!record) return {};
  const parsed: ApiKeyModelWhitelists = {};
  for (const [apiKey, patterns] of Object.entries(record)) {
    parsed[apiKey] = normalizePatterns(patterns);
  }
  return normalizeApiKeyModelWhitelists(parsed, apiKeys);
}
