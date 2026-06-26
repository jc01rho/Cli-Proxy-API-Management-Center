/**
 * Generic quota card component.
 */

import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { Button } from '@/components/ui/Button';
import { IconRefreshCw } from '@/components/ui/icons';
import type { AuthFileItem, ResolvedTheme, ThemeColors } from '@/types';
import { TYPE_COLORS } from '@/utils/quota';
import styles from '@/pages/QuotaPage.module.scss';

type QuotaStatus = 'idle' | 'loading' | 'success' | 'error';

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

export function QuotaProgressBar({ percent }: QuotaProgressBarProps) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const widthPercent = Math.round(normalized ?? 0);
  const colorPercent = percent ?? 0;
  const clampedColorPercent = clamp(colorPercent, 5, 100);
  const colorRatio = (clampedColorPercent - 5) / 95;
  const successWeight = Math.round(colorRatio * 100);
  const dangerWeight = 100 - successWeight;
  const fillBaseColor = `color-mix(in srgb, var(--danger-color) ${dangerWeight}%, var(--success-color) ${successWeight}%)`;
  const fillEdgeColor = `color-mix(in srgb, ${fillBaseColor} 84%, var(--text-primary) 16%)`;
  const fillStyle = {
    width: `${widthPercent}%`,
    '--quota-bar-fill-start': fillBaseColor,
    '--quota-bar-fill-end': fillEdgeColor
  } as CSSProperties;

  return (
    <div className={styles.quotaBar}>
      <div className={styles.quotaBarFill} style={fillStyle} />
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
  cardIdleMessageKey?: string;
  cardClassName: string;
  defaultType: string;
  canRefresh?: boolean;
  onRefresh?: () => void;
  resetQuotaAction?: ReactNode;
  renderQuotaItems: (quota: TState, t: TFunction, helpers: QuotaRenderHelpers) => ReactNode;
}

export function QuotaCard<TState extends QuotaStatusState>({
  item,
  quota,
  resolvedTheme,
  i18nPrefix,
  cardIdleMessageKey,
  cardClassName,
  defaultType,
  canRefresh = false,
  onRefresh,
  resetQuotaAction,
  renderQuotaItems,
}: QuotaCardProps<TState>) {
  const { t } = useTranslation();

  const displayType = item.type || item.provider || defaultType;
  const typeColorSet = TYPE_COLORS[displayType] || TYPE_COLORS.unknown;
  const typeColor: ThemeColors =
    resolvedTheme === 'dark' && typeColorSet.dark ? typeColorSet.dark : typeColorSet.light;

  const quotaStatus = quota?.status ?? 'idle';
  const quotaLoading = quotaStatus === 'loading';
  const quotaErrorMessage = resolveQuotaErrorMessage(
    t,
    quota?.errorStatus,
    quota?.error || t('common.unknown_error')
  );
  const idleMessageKey = onRefresh
    ? `${i18nPrefix}.idle`
    : (cardIdleMessageKey ?? `${i18nPrefix}.idle`);

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
        <div className={styles.cardBadgeRow} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          <span
            className={styles.typeBadge}
            style={{
              backgroundColor: typeColor.bg,
              color: typeColor.text,
              ...(typeColor.border ? { border: typeColor.border } : {})
            }}
          >
            {getTypeLabel(displayType)}
          </span>
          {item.primary_info && (
            <span 
              className={item.primary_info.is_primary ? styles.primaryBadge : styles.standbyBadge}
              style={{
                opacity: item.disabled ? 0.4 : (item.primary_info.is_primary ? 0.9 : 1)
              }}
            >
              {item.primary_info.is_primary 
                ? t('quota_management.primary_credential') 
                : `${t('quota_management.standby_credential')} (${item.primary_info.order})`}
            </span>
          )}
        </div>
        <span className={styles.fileName}>{item.name}</span>
      </div>

      <div className={styles.quotaSection}>
        {quotaLoading ? (
          <div className={styles.quotaMessage}>{t(`${i18nPrefix}.loading`)}</div>
        ) : quotaStatus === 'idle' ? (
          onRefresh ? (
            <button
              type="button"
              className={`${styles.quotaMessage} ${styles.quotaMessageAction}`}
              onClick={onRefresh}
              disabled={!canRefresh}
            >
              {t(idleMessageKey)}
            </button>
          ) : (
            <div className={styles.quotaMessage}>{t(idleMessageKey)}</div>
          )
        ) : quotaStatus === 'error' ? (
          <div className={styles.quotaError}>
            {t(`${i18nPrefix}.load_failed`, {
              message: quotaErrorMessage,
            })}
          </div>
        ) : quota ? (
          renderQuotaItems(quota, t, { styles, QuotaProgressBar })
        ) : (
          <div className={styles.quotaMessage}>{t(idleMessageKey)}</div>
        )}
      </div>

      {(resetQuotaAction || (onRefresh && quotaStatus !== 'idle')) && (
        <div className={styles.quotaCardActions}>
          {resetQuotaAction}
          {onRefresh && quotaStatus !== 'idle' && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={styles.quotaRefreshButton}
              onClick={onRefresh}
              disabled={!canRefresh || quotaLoading}
              loading={quotaLoading}
              title={t('auth_files.quota_refresh_hint')}
            >
              {!quotaLoading && <IconRefreshCw size={14} />}
              {t('auth_files.quota_refresh_single')}
            </Button>
          )}
        </div>
      )}
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
