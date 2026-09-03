import { useTranslation } from 'react-i18next';
import type { MetaMuseQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaBodyProps } from '../../types';

const WINDOW_KEYS = ['fiveHour', 'weekly'] as const;
type WindowKey = (typeof WINDOW_KEYS)[number];

const i18nWindowKey: Record<WindowKey, string> = {
  fiveHour: 'window_five_hour',
  weekly: 'window_weekly',
};

const resetAtMs = (value: string | null): number | null => {
  if (!value) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
};

const observedAtLabel = (value: string | null, locale: string): string => {
  const milliseconds = resetAtMs(value);
  if (milliseconds === null) return '—';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(milliseconds));
};

export function MetaMuseQuotaBody({ quota, classes }: QuotaBodyProps<MetaMuseQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage ?? 'en';
  const windows = WINDOW_KEYS.map((key) => ({ key, window: quota[key] })).filter(
    ({ window }) => window.usedPercent !== null || window.resetAt !== null
  );

  if (windows.length === 0) {
    return <div className={classes.quotaMessage}>{t('meta_muse_quota.empty_data')}</div>;
  }

  return (
    <>
      {windows.map(({ key, window }, index) => {
        const remaining = window.remainingPercent;
        const resetDisplay = buildResetDisplay(null, resetAtMs(window.resetAt), now, locale);
        return (
          <div key={key} className={classes.quotaRow} data-meta-muse-quota>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>
                {t(`meta_muse_quota.${i18nWindowKey[key]}`)}
              </span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>
                  {remaining === null ? '—' : `${Math.round(remaining)}%`}
                </span>
                {window.usedPercent !== null && (
                  <span className={classes.quotaAmount}>
                    {t('meta_muse_quota.used_of', { used: Math.round(window.usedPercent) })}
                  </span>
                )}
                {resetDisplay && (
                  <span data-meta-muse-reset>
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={false} />
                  </span>
                )}
              </div>
            </div>
            <QuotaMeter percent={remaining} classes={classes} index={index} />
          </div>
        );
      })}
      <p className={classes.quotaMessage} data-meta-muse-passive-observation>
        {t('meta_muse_quota.passive_notice', {
          observedAt: observedAtLabel(quota.observedAt, locale),
        })}
      </p>
    </>
  );
}
