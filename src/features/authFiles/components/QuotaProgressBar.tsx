import styles from '@/pages/AuthFilesPage.module.scss';

export type QuotaProgressBarProps = {
  percent: number | null;
  highThreshold: number;
  mediumThreshold: number;
};

import type { CSSProperties } from 'react';

export function QuotaProgressBar({ percent }: QuotaProgressBarProps) {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const normalized = percent === null ? null : clamp(percent, 0, 100);
  const widthPercent = Math.round(normalized ?? 0);
  const ratio = (normalized ?? 0) / 100;
  const hue = Math.round(120 * (1 - ratio));
  const fillStyle = {
    width: `${widthPercent}%`,
    '--quota-bar-fill-start': `hsl(${hue} 72% 52%)`,
    '--quota-bar-fill-end': `hsl(${hue} 78% 44%)`
  } as CSSProperties;

  return (
    <div className={styles.quotaBar}>
      <div className={styles.quotaBarFill} style={fillStyle} />
    </div>
  );
}
