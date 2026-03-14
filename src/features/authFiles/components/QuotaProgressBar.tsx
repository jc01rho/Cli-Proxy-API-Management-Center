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
