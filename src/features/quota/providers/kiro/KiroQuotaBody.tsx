/**
 * Kiro quota body: subscription badge and usage meters.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { KiroQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';

const formatKiroAmount = (used: number, limit: number, unit?: string): string => {
  const suffix = unit ? ` ${unit}` : '';
  return `${used.toLocaleString()} / ${limit.toLocaleString()}${suffix}`;
};

export function KiroQuotaBody({ quota, classes }: QuotaBodyProps<KiroQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('kiro', quota), now),
    [quota, now]
  );

  if (quota.rows.length === 0) {
    return <div className={classes.quotaMessage}>{t('kiro_quota.empty_data')}</div>;
  }

  const plan = quota.subscriptionTitle ?? quota.subscriptionType;

  return (
    <>
      {plan && (
        <div className={classes.codexPlan}>
          <span className={classes.codexPlanLabel}>{t('kiro_quota.plan_label')}</span>
          <span className={classes.codexPlanValue}>{plan}</span>
        </div>
      )}
      {quota.rows.map((row, index) => {
        const remaining =
          row.limit > 0
            ? Math.max(0, Math.min(100, Math.round(((row.limit - row.used) / row.limit) * 100)))
            : row.used > 0
              ? 0
              : null;
        const resetDisplay = buildResetDisplay(
          null,
          row.resetAtMs,
          now,
          i18n.resolvedLanguage
        );
        const soon = row.id === soonestRowId;

        return (
          <div
            key={row.id}
            className={classes.quotaRow}
            data-kiro-quota
            title={soon ? t('quota_management.soonest_row_hint') : undefined}
          >
            <div className={classes.quotaRowHeader}>
              <span className={classes.quotaModel}>{row.label}</span>
              <div className={classes.quotaMeta}>
                <span className={classes.quotaPercent}>
                  {remaining === null ? '--' : `${remaining}%`}
                </span>
                <span className={classes.quotaAmount}>
                  {formatKiroAmount(row.used, row.limit, row.unit)}
                </span>
                {resetDisplay && (
                  <span data-kiro-reset>
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />
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
