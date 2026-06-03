import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { configApi } from '@/services/api';
import type { WeightRobinQueueSnapshot } from '@/services/api/config';
import styles from './WeightRobinQueueView.module.scss';

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#e97a2b',
  gemini: '#4285f4',
  codex: '#34a853',
  'openai-compatible': '#9b59b6',
  commandcode: '#e97a2b',
  mistral: '#ff6f00',
  kiro: '#00bcd4',
  antigravity: '#607d8b',
  xai: '#00acc1',
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] || '#888';
}

export function WeightRobinQueueView() {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<WeightRobinQueueSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    configApi
      .getWeightRobinQueue()
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = snapshot?.entries ?? [];
  const totalWeight = snapshot?.totalWeight ?? 0;
  const currentIdx = snapshot?.currentIdx ?? 0;

  if (entries.length === 0) {
    return (
      <div className={styles.empty}>
        {t('config_management.visual.sections.network.weight_robin_empty', 'No active auth entries')}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.liveDot} />
        <span className={styles.headerLabel}>
          {t('config_management.visual.sections.network.weight_robin_queue_title', 'Weighted Queue')}
        </span>
        <span className={styles.headerMeta}>
          idx:{currentIdx} / len:{snapshot?.cycleLength ?? 0}
        </span>
      </div>

      <div className={styles.list}>
        {entries.map((entry) => {
          const color = getProviderColor(entry.provider);
          const percent = totalWeight > 0 ? (entry.weight / totalWeight) * 100 : 0;
          return (
            <div
              key={entry.authId}
              className={`${styles.row} ${!entry.available ? styles.rowInactive : ''}`}
            >
              <div className={styles.rowInfo}>
                <span
                  className={styles.providerBadge}
                  style={{
                    borderColor: color,
                    color,
                    background: `color-mix(in srgb, ${color} 12%, transparent)`,
                  }}
                >
                  {entry.provider}
                </span>
                <span className={styles.entryName} title={entry.name}>
                  {entry.name}
                </span>
                <span className={styles.weightBadge}>w:{entry.weight}</span>
              </div>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${percent}%`,
                    background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))`,
                  }}
                />
                <span className={styles.percentLabel}>{percent.toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.summary}>
        {t(
          'config_management.visual.sections.network.weight_robin_total',
          'Total weight: {{weight}} • {{count}} entries • position: {{idx}}',
          { weight: totalWeight, count: entries.length, idx: currentIdx }
        )}
      </div>
    </div>
  );
}
