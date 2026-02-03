/**
 * Builder functions for constructing quota data structures.
 */

import type {
  AntigravityQuotaGroup,
  AntigravityQuotaInfo,
  AntigravityModelsPayload,
  GeminiCliParsedBucket,
  GeminiCliQuotaBucketState,
} from '@/types';
import { normalizeQuotaFraction } from './parsers';
import { isIgnoredGeminiCliModel } from './validators';

export function pickEarlierResetTime(current?: string, next?: string): string | undefined {
  if (!current) return next;
  if (!next) return current;
  const currentTime = new Date(current).getTime();
  const nextTime = new Date(next).getTime();
  if (Number.isNaN(currentTime)) return next;
  if (Number.isNaN(nextTime)) return current;
  return currentTime <= nextTime ? current : next;
}

export function minNullableNumber(current: number | null, next: number | null): number | null {
  if (current === null) return next;
  if (next === null) return current;
  return Math.min(current, next);
}

export function buildGeminiCliQuotaBuckets(
  buckets: GeminiCliParsedBucket[]
): GeminiCliQuotaBucketState[] {
  if (buckets.length === 0) return [];

  const result: GeminiCliQuotaBucketState[] = [];

  for (const bucket of buckets) {
    if (isIgnoredGeminiCliModel(bucket.modelId)) continue;

    result.push({
      id: bucket.modelId,
      label: bucket.modelId,
      remainingFraction: bucket.remainingFraction,
      remainingAmount: bucket.remainingAmount,
      resetTime: bucket.resetTime,
      tokenType: bucket.tokenType,
      modelIds: [bucket.modelId],
    });
  }

  return result;
}

export function getAntigravityQuotaInfo(entry?: AntigravityQuotaInfo): {
  remainingFraction: number | null;
  resetTime?: string;
  displayName?: string;
} {
  if (!entry) {
    return { remainingFraction: null };
  }
  const quotaInfo = entry.quotaInfo ?? entry.quota_info ?? {};
  const remainingValue =
    quotaInfo.remainingFraction ?? quotaInfo.remaining_fraction ?? quotaInfo.remaining;
  const remainingFraction = normalizeQuotaFraction(remainingValue);
  const resetValue = quotaInfo.resetTime ?? quotaInfo.reset_time;
  const resetTime = typeof resetValue === 'string' ? resetValue : undefined;
  const displayName = typeof entry.displayName === 'string' ? entry.displayName : undefined;

  return {
    remainingFraction,
    resetTime,
    displayName,
  };
}

const IGNORED_ANTIGRAVITY_MODELS = new Set([
  'tab_flash_lite_preview',
  'gpt-oss-120b-medium',
  'chat_20706',
  'chat_23310',
  'ulw',
]);

function isClaudeModel(modelId: string): boolean {
  return modelId.toLowerCase().startsWith('claude');
}

export function buildAntigravityQuotaGroups(
  models: AntigravityModelsPayload
): AntigravityQuotaGroup[] {
  const groups: AntigravityQuotaGroup[] = [];
  let claudeGroup: AntigravityQuotaGroup | null = null;

  for (const [modelId, entry] of Object.entries(models)) {
    if (IGNORED_ANTIGRAVITY_MODELS.has(modelId)) continue;

    const info = getAntigravityQuotaInfo(entry);
    const remainingFraction = info.remainingFraction ?? (info.resetTime ? 0 : null);
    if (remainingFraction === null) continue;

    if (isClaudeModel(modelId)) {
      if (!claudeGroup) {
        claudeGroup = {
          id: 'claude-merged',
          label: 'Claude',
          models: [modelId],
          remainingFraction,
          resetTime: info.resetTime,
        };
      } else {
        claudeGroup.models.push(modelId);
        claudeGroup.remainingFraction = Math.min(claudeGroup.remainingFraction, remainingFraction);
        claudeGroup.resetTime = pickEarlierResetTime(claudeGroup.resetTime, info.resetTime);
      }
      continue;
    }

    groups.push({
      id: modelId,
      label: info.displayName ?? modelId,
      models: [modelId],
      remainingFraction,
      resetTime: info.resetTime,
    });
  }

  if (claudeGroup) {
    groups.unshift(claudeGroup);
  }

  return groups;
}
