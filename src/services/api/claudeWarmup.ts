/**
 * Claude OAuth warmup (fork-only): POST /claude-warmup/run triggers one warmup
 * request per eligible Claude OAuth credential and returns per-account results.
 */
import { apiClient } from './client';

export interface ClaudeWarmupAccountResult {
  authId: string;
  label: string;
  success: boolean;
  attempts: number;
  httpStatus: number | null;
  error: string;
}

export interface ClaudeWarmupRunResult {
  model: string;
  maxTokens: number | null;
  results: ClaudeWarmupAccountResult[];
  /** Run-level error (for example a cancelled run); per-account errors live in results. */
  error: string;
}

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export function normalizeClaudeWarmupRunResult(raw: unknown): ClaudeWarmupRunResult {
  const body = asRecord(raw);
  const results = Array.isArray(body?.results) ? body.results : [];
  return {
    model: asString(body?.model),
    maxTokens: asNumber(body?.max_tokens),
    error: asString(body?.error),
    results: results.flatMap((item) => {
      const entry = asRecord(item);
      if (!entry) return [];
      return [
        {
          authId: asString(entry.auth_id),
          label: asString(entry.label),
          success: entry.success === true,
          attempts: asNumber(entry.attempts) ?? 0,
          httpStatus: asNumber(entry.http_status),
          error: asString(entry.error),
        },
      ];
    }),
  };
}

export const claudeWarmupApi = {
  /** Runs immediately with the saved config. jitter=false skips the delay between accounts. */
  async run(options: { jitter?: boolean } = {}): Promise<ClaudeWarmupRunResult> {
    const raw = await apiClient.post<unknown>('/claude-warmup/run', undefined, {
      params: { jitter: options.jitter === true ? 'true' : 'false' },
    });
    return normalizeClaudeWarmupRunResult(raw);
  },
};
