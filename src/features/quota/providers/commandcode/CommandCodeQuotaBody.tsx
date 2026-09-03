/**
 * Command Code quota body: fixed quota-window meters (five-hour, weekly) plus
 * an optional subscription credits spend row (credits_usd).
 */

import { useTranslation } from 'react-i18next';
import type { CommandCodeQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaBodyProps } from '../../types';
import { isCommandCodeWindowPresent } from './data';

const WINDOW_KEYS = ['fiveHour', 'weekly'] as const;
type WindowKey = (typeof WINDOW_KEYS)[number];

const i18nWindowKey: Record<WindowKey, string> = {
  fiveHour: 'window_five_hour',
  weekly: 'window_weekly',
};

const resetAtMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

export function CommandCodeQuotaBody({ quota, classes }: QuotaBodyProps<CommandCodeQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage ?? 'en';

  const windows = WINDOW_KEYS.map((key) => ({ key, win: quota[key] })).filter(({ win }) =>
    isCommandCodeWindowPresent(win)
  );

  const credits = quota.creditsUsd;
  const hasCredits = Boolean(credits && credits.limit > 0);

  if (windows.length === 0 && !hasCredits) {
    return <div className={classes.quotaMessage}>{t('commandcode_quota.empty_data')}</div>;
  }

  return (
    <>
      {windows.map(({ key, win }, index) => {
        if (!win) return null;
        const used = win.used_percent ?? 0;
        const remaining = Math.max(0, Math.min(100, Math.round(100 - used)));
        const resetDisplay = buildResetDisplay(null, resetAtMs(win.reset_at), now, locale);
        return (
          <div key={key} className={classes.quotaRow} data-commandcode-quota>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>
                {t(`commandcode_quota.${i18nWindowKey[key]}`)}
              </span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>{`${remaining}%`}</span>
                <span className={classes.quotaAmount}>
                  {t('commandcode_quota.used_of', { used: Math.round(used) })}
                </span>
                {resetDisplay && (
                  <span data-commandcode-reset>
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={false} />
                  </span>
                )}
              </div>
            </div>
            <QuotaMeter percent={remaining} classes={classes} index={index} />
          </div>
        );
      })}
      {hasCredits && credits && (
        <div key="credits" className={classes.quotaRow} data-commandcode-credits>
          <div className={classes.quotaRowHeader}>
            <span className={classes.quotaModel}>{t('commandcode_quota.credits_label')}</span>
            <div className={classes.quotaMeta}>
              <span className={classes.quotaPercent}>{`${Math.round(credits.percent)}%`}</span>
              <span className={classes.quotaAmount}>
                {t('commandcode_quota.credits_used', {
                  used: Math.round(credits.used),
                  limit: Math.round(credits.limit),
                })}
              </span>
              {credits.expires_at &&
                (() => {
                  const creditsReset = buildResetDisplay(
                    null,
                    resetAtMs(credits.expires_at),
                    now,
                    locale
                  );
                  return creditsReset ? (
                    <span data-commandcode-credits-reset>
                      <QuotaResetLabel display={creditsReset} classes={classes} soon={false} />
                    </span>
                  ) : null;
                })()}
            </div>
          </div>
          <QuotaMeter percent={Math.round(100 - credits.percent)} classes={classes} index={2} />
        </div>
      )}
    </>
  );
}
