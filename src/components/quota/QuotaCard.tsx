/**
 * Generic quota card component.
 */

import { useTranslation } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { AuthFileItem, ResolvedTheme, ThemeColors } from '@/types';
import { TYPE_COLORS } from '@/utils/quota';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatRelativeTime, formatAbsoluteTime } from '@/utils/format';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaStatus = 'idle' | 'loading' | 'success' | 'error';

function isGoZeroTime(timeStr?: string): boolean {
  if (!timeStr) return false;
  return timeStr.startsWith('0001-01-01');
}

function isExhaustedError(item: AuthFileItem): boolean {
  if (!item.last_error) return false;
  const { http_status, message } = item.last_error;
  return http_status === 429 && 
    (message?.includes('RESOURCE_EXHAUSTED') || message?.includes('Resource has been exhausted'));
}

function isNeverRecoverQuota(item: AuthFileItem): boolean {
  // Only show "never recover" if quota is actually exceeded
  if (!item.quota?.exceeded && !item.quota_exceeded) return false;
  const recoverAt = item.quota?.next_recover_at || item.quota_next_recover_at;
  return isGoZeroTime(recoverAt);
}

export interface QuotaStatusState {
  status: QuotaStatus;
  error?: string;
  errorStatus?: number;
}

export interface QuotaProgressBarProps {
  percent: number | null;
  highThreshold: number;
  mediumThreshold: number;
}

export function QuotaProgressBar({
  percent,
  highThreshold,
  mediumThreshold,
}: QuotaProgressBarProps) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const fillClass =
    normalized === null
      ? styles.quotaBarFillMedium
      : normalized >= highThreshold
        ? styles.quotaBarFillHigh
        : normalized >= mediumThreshold
          ? styles.quotaBarFillMedium
          : styles.quotaBarFillLow;
  const widthPercent = Math.round(normalized ?? 0);

  return (
    <div className={styles.quotaBar}>
      <div
        className={`${styles.quotaBarFill} ${fillClass}`}
        style={{ width: `${widthPercent}%` }}
      />
    </div>
  );
}

export interface QuotaRenderHelpers {
  styles: typeof styles;
  QuotaProgressBar: (props: QuotaProgressBarProps) => ReactElement;
}

interface QuotaCardProps<TState extends QuotaStatusState> {
  item: AuthFileItem;
  quota?: TState;
  resolvedTheme: ResolvedTheme;
  i18nPrefix: string;
  cardClassName: string;
  defaultType: string;
  renderQuotaItems: (quota: TState, t: TFunction, helpers: QuotaRenderHelpers) => ReactNode;
}

export function QuotaCard<TState extends QuotaStatusState>({
  item,
  quota,
  resolvedTheme,
  i18nPrefix,
  cardClassName,
  defaultType,
  renderQuotaItems,
}: QuotaCardProps<TState>) {
  const { t } = useTranslation();

  const displayType = item.type || item.provider || defaultType;
  const typeColorSet = TYPE_COLORS[displayType] || TYPE_COLORS.unknown;
  const typeColor: ThemeColors =
    resolvedTheme === 'dark' && typeColorSet.dark ? typeColorSet.dark : typeColorSet.light;

  const quotaStatus = quota?.status ?? 'idle';
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );

  const getTypeLabel = (type: string): string => {
    const key = `auth_files.filter_${type}`;
    const translated = t(key);
    if (translated !== key) return translated;
    if (type.toLowerCase() === 'iflow') return 'iFlow';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className={`${styles.fileCard} ${cardClassName}`}>
      <div className={styles.cardHeader}>
        <span
          className={styles.typeBadge}
          style={{
            backgroundColor: typeColor.bg,
            color: typeColor.text,
            ...(typeColor.border ? { border: typeColor.border } : {}),
          }}
        >
          {getTypeLabel(displayType)}
        </span>
        <span className={styles.fileName}>{item.name}</span>
        {item.status && <StatusBadge status={item.status} />}
        {isExhaustedError(item) && <StatusBadge status="exhausted" />}
        {isNeverRecoverQuota(item) && <StatusBadge status="never_recover" />}
        {item.tier && displayType === 'antigravity' && (() => {
          const tierLower = item.tier.toLowerCase();
          let tierClass = styles.tierFree;
          let tierLabel = item.tier_name || item.tier;
          
          if (tierLower.includes('ultra')) {
            tierClass = styles.tierUltra;
            tierLabel = item.tier_name || 'Ultra';
          } else if (tierLower.includes('pro')) {
            tierClass = styles.tierPro;
            tierLabel = item.tier_name || 'Pro';
          } else if (tierLower.includes('standard') || tierLower.includes('free')) {
            tierClass = styles.tierFree;
            tierLabel = item.tier_name || 'Free';
          }
          
          return (
            <span className={`${styles.tierBadge} ${tierClass}`}>
              {tierLabel}
            </span>
          );
        })()}
        {(item.quota_exceeded || item.unavailable) && displayType === 'antigravity' && (
          <span
            className={`${styles.statusBadge} ${item.quota_exceeded ? styles.statusBlocked : styles.statusUnavailable}`}
          >
            {item.quota_exceeded
              ? t('quota_management.key_blocked')
              : t('quota_management.key_unavailable')}
          </span>
        )}
        {displayType === 'antigravity' && 
          (item.quota_exceeded || item.status === 'pending') && 
          (item.quota?.next_recover_at || item.quota_next_recover_at || item.next_retry_after) && (() => {
            const recoverTime = item.quota?.next_recover_at || item.quota_next_recover_at || item.next_retry_after;
            const relativeTime = formatRelativeTime(recoverTime, t);
            const absoluteTime = formatAbsoluteTime(recoverTime);
            if (!relativeTime) return null;
            return (
              <span className={styles.recoverBadge} title={absoluteTime}>
                {relativeTime}
              </span>
            );
          })()}
      </div>

      <div className={styles.quotaSection}>
        {quotaStatus === 'loading' ? (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.loading`)}</div>
        ) : quotaStatus === 'idle' ? (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.idle`)}</div>
        ) : quotaStatus === 'error' ? (
          <div className={styles.quotaError}>
            {t(`${i18nPrefix}.load_failed`, {
              message: quotaErrorMessage,
            })}
          </div>
        ) : quota ? (
          renderQuotaItems(quota, t, { styles, QuotaProgressBar })
        ) : (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.idle`)}</div>
        )}
      </div>
    </div>
  );
}

const resolveQuotaErrorMessage = (
  t: TFunction,
  status: number | undefined,
  fallback: string
): string => {
  if (status === 404) return t('common.quota_update_required');
  if (status === 403) return t('common.quota_check_credential');
  return fallback;
};
