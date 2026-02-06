/**
 * Generic quota card component.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { AuthFileItem, ResolvedTheme, ThemeColors } from '@/types';
import { TYPE_COLORS } from '@/utils/quota';
import { StatusBadge } from '@/components/common/StatusBadge';
import { formatRelativeTime, formatAbsoluteTime } from '@/utils/format';
import { providersApi } from '@/services/api/providers';
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
  onTierRefresh?: (authId: string, tier: string, tierName: string) => void;
}

export function QuotaCard<TState extends QuotaStatusState>({
  item,
  quota,
  resolvedTheme,
  i18nPrefix,
  cardClassName,
  defaultType,
  renderQuotaItems,
  onTierRefresh,
}: QuotaCardProps<TState>) {
  const { t } = useTranslation();
  const [refreshingTier, setRefreshingTier] = useState(false);

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

  const exhausted = isExhaustedError(item);

  const handleRefreshTier = async () => {
    if (!item.id || refreshingTier) return;
    setRefreshingTier(true);
    try {
      const result = await providersApi.refreshTier(item.id);
      if (onTierRefresh && result.tier) {
        onTierRefresh(item.id, result.tier, result.tier_name);
      }
    } catch {
    } finally {
      setRefreshingTier(false);
    }
  };

  const tierBadge = displayType === 'antigravity' ? (() => {
    const tierLower = (item.tier || '').toLowerCase();
    let tierClass = styles.tierFree;
    let tierLabel = 'Free';
    
    if (tierLower.includes('ultra')) {
      tierClass = styles.tierUltra;
      tierLabel = 'Ultra';
    } else if (tierLower.includes('pro')) {
      tierClass = styles.tierPro;
      tierLabel = 'Pro';
    } else if (tierLower.includes('standard') || tierLower.includes('free') || tierLower === '') {
      tierClass = styles.tierFree;
      tierLabel = item.tier ? 'Free' : '?';
    }
    
    return (
      <span className={styles.tierBadgeWrapper}>
        <span className={`${styles.tierBadge} ${tierClass}`} title={item.tier_name || item.tier || t('quota_management.tier_unknown')}>
          {tierLabel}
        </span>
        <button
          type="button"
          className={`${styles.tierRefreshBtn} ${refreshingTier ? styles.tierRefreshBtnLoading : ''}`}
          onClick={handleRefreshTier}
          disabled={refreshingTier}
          title={t('quota_management.refresh_tier')}
        >
          ↻
        </button>
      </span>
    );
  })() : null;

  const recoverBadge = displayType === 'antigravity' && 
    (item.quota_exceeded || item.status === 'pending') && 
    (item.quota?.next_recover_at || item.quota_next_recover_at || item.next_retry_after) ? (() => {
      const recoverTime = item.quota?.next_recover_at || item.quota_next_recover_at || item.next_retry_after;
      const relativeTime = formatRelativeTime(recoverTime, t);
      const absoluteTime = formatAbsoluteTime(recoverTime);
      if (!relativeTime) return null;
      return (
        <span className={styles.recoverBadge} title={absoluteTime}>
          {relativeTime}
        </span>
      );
    })() : null;

  const statusBadges: React.ReactNode[] = [];

  if (exhausted) {
    statusBadges.push(<StatusBadge key="exhausted" status="exhausted" />);
  }

  if (!exhausted && item.status && item.status !== 'active') {
    statusBadges.push(<StatusBadge key="status" status={item.status} />);
  }

  if (isNeverRecoverQuota(item)) {
    statusBadges.push(<StatusBadge key="never_recover" status="never_recover" />);
  }

  if (!exhausted && (item.quota_exceeded || item.unavailable) && displayType === 'antigravity') {
    statusBadges.push(
      <span
        key="blocked"
        className={`${styles.statusBadge} ${item.quota_exceeded ? styles.statusBlocked : styles.statusUnavailable}`}
      >
        {item.quota_exceeded
          ? t('quota_management.key_blocked')
          : t('quota_management.key_unavailable')}
      </span>
    );
  }

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
        {tierBadge}
      </div>
      {(statusBadges.length > 0 || recoverBadge) && (
        <div className={styles.badgeRow}>
          {statusBadges}
          {recoverBadge}
        </div>
      )}

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
