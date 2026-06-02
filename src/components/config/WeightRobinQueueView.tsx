import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './WeightRobinQueueView.module.scss';

export interface WeightRobinEntry {
  name: string;
  type: string;
  priority: number;
}

interface WeightRobinQueueViewProps {
  entries: WeightRobinEntry[];
}

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

function getProviderColor(type: string): string {
  return PROVIDER_COLORS[type.toLowerCase()] || '#888';
}

function clampWeight(priority: number): number {
  if (priority <= 0) return 1;
  if (priority > 100) return 100;
  return priority;
}

export function WeightRobinQueueView({ entries }: WeightRobinQueueViewProps) {
  const { t } = useTranslation();

  const { items, totalWeight } = useMemo(() => {
    const mapped = entries.map((e) => ({
      ...e,
      weight: clampWeight(e.priority),
      color: getProviderColor(e.type),
    }));
    const total = mapped.reduce((sum, e) => sum + e.weight, 0);
    return {
      items: mapped.map((e) => ({
        ...e,
        percent: total > 0 ? (e.weight / total) * 100 : 0,
      })),
      totalWeight: total,
    };
  }, [entries]);

  if (items.length === 0) {
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
      </div>

      <div className={styles.list}>
        {items.map((item) => (
          <div key={item.name} className={styles.row}>
            <div className={styles.rowInfo}>
              <span
                className={styles.providerBadge}
                style={{
                  borderColor: item.color,
                  color: item.color,
                  background: `color-mix(in srgb, ${item.color} 12%, transparent)`,
                }}
              >
                {item.type}
              </span>
              <span className={styles.entryName} title={item.name}>
                {item.name}
              </span>
              <span className={styles.weightBadge}>
                w:{item.weight}
              </span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={styles.barFill}
                style={{
                  width: `${item.percent}%`,
                  background: `linear-gradient(90deg, ${item.color}, color-mix(in srgb, ${item.color} 40%, transparent))`,
                }}
              />
              <span className={styles.percentLabel}>{item.percent.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.summary}>
        {t('config_management.visual.sections.network.weight_robin_total', 'Total weight: {{weight}} • {{count}} active entries', {
          weight: totalWeight,
          count: items.length,
        })}
      </div>
    </div>
  );
}
