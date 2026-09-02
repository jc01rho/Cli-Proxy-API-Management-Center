/**
 * Zcode quota body: plan level badge + fixed quota-window meters
 * (five-hour, weekly, MCP/time limit, monthly).
 */

import { useTranslation } from 'react-i18next';
import type { ZcodeQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import type { QuotaBodyProps } from '../../types';
import { isZcodeWindowPresent } from './data';

const WINDOW_KEYS = ['fiveHour', 'weekly', 'mcp', 'monthly'] as const;
type WindowKey = (typeof WINDOW_KEYS)[number];

const i18nWindowKey: Record<WindowKey, string> = {
  fiveHour: 'window_five_hour',
  weekly: 'window_weekly',
  mcp: 'window_mcp',
  monthly: 'window_monthly',
};

const resetAtMs = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
};

export function ZcodeQuotaBody({ quota, classes }: QuotaBodyProps<ZcodeQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const locale = i18n.resolvedLanguage ?? 'en';

  const windows = WINDOW_KEYS.map((key) => ({ key, win: quota[key] })).filter(({ win }) =>
    isZcodeWindowPresent(win)
  );

  if (windows.length === 0) {
    return <div className={classes.quotaMessage}>{t('zcode_quota.empty_data')}</div>;
  }

  return (
    <>
      {quota.level && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('zcode_quota.plan_label')}</span>
          <span className={classes.codexPlanValue}>{quota.level}</span>
        </div>
      )}
      {windows.map(({ key, win }, index) => {
        if (!win) return null;
        const used = win.used_percent ?? 0;
        const remaining = Math.max(0, Math.min(100, Math.round(100 - used)));
        const resetDisplay = buildResetDisplay(null, resetAtMs(win.reset_at), now, locale);
        return (
          <div key={key} className={classes.quotaRow} data-zcode-quota>
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{t(`zcode_quota.${i18nWindowKey[key]}`)}</span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>{`${remaining}%`}</span>
                <span className={classes.quotaAmount}>
                  {t('zcode_quota.used_of', { used: Math.round(used) })}
                </span>
                {resetDisplay && (
                  <span data-zcode-reset>
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={false} />
                  </span>
                )}
              </div>
            </div>
            <QuotaMeter percent={remaining} classes={classes} index={index} />
          </div>
        );
      })}
    </>
  );
}
