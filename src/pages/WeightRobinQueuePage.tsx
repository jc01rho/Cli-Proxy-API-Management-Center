import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { configApi } from '@/services/api';
import type { WeightRobinQueueSnapshot, WeightRobinQueueEntry, WeightRobinCycleEntry } from '@/services/api/config';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import styles from './WeightRobinQueuePage.module.scss';

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
  qoder: '#1890ff',
  vertex: '#4285f4',
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] || '#888';
}

export function WeightRobinQueuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<WeightRobinQueueSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await configApi.getWeightRobinQueue();
      setSnapshot(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useHeaderRefresh(loadQueue);

  const entries = snapshot?.entries ?? [];
  const cycle = snapshot?.cycle ?? [];
  const totalWeight = snapshot?.totalWeight ?? 0;
  const currentIdx = snapshot?.currentIdx ?? 0;
  const cycleLength = snapshot?.cycleLength ?? 0;
  const lastPicked = snapshot?.lastPicked;
  const activeCount = entries.filter((e) => e.available).length;
  const avgWeight = activeCount > 0 ? totalWeight / activeCount : 0;

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/config')}
            aria-label={t('weight_robin_queue.back_to_config', 'Back to Config')}
          >
            ← {t('weight_robin_queue.back_to_config', 'Back to Config')}
          </Button>
          <div>
            <h1 className={styles.title}>
              {t('weight_robin_queue.page_title', 'Weight-Robin Queue')}
            </h1>
            <p className={styles.subtitle}>
              {t(
                'weight_robin_queue.page_subtitle',
                'Real-time view of the weighted cycle used by weight-robin routing strategy.'
              )}
            </p>
          </div>
        </div>
        <div className={styles.headerRight}>
          {lastUpdated && (
            <span className={styles.updatedAt}>
              {t('weight_robin_queue.last_updated', 'Last updated')}:{' '}
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadQueue()}
            disabled={loading}
          >
            {loading
              ? t('weight_robin_queue.refreshing', 'Refreshing...')
              : t('weight_robin_queue.refresh', 'Refresh')}
          </Button>
        </div>
      </header>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.statRow}>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.active_entries', 'Active Entries')}
          </span>
          <span className={styles.statValue}>{activeCount}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.total_weight', 'Total Weight')}
          </span>
          <span className={styles.statValue}>{totalWeight}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.avg_weight', 'Average Weight')}
          </span>
          <span className={styles.statValue}>{avgWeight.toFixed(2)}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.cycle_length', 'Cycle Length')}
          </span>
          <span className={styles.statValue}>{cycleLength}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.current_position', 'Current Position')}
          </span>
          <span className={styles.statValue}>{currentIdx}</span>
        </Card>
        {lastPicked && (
          <Card className={styles.statCard}>
            <span className={styles.statLabel}>
              {t('weight_robin_queue.last_picked', 'Last Picked')}
            </span>
            <span className={styles.statValue}>{lastPicked}</span>
          </Card>
        )}
      </div>

      <Card
        title={t('weight_robin_queue.table_title', 'Queue Entries')}
        className={styles.tableCard}
      >
        {entries.length === 0 ? (
          <div className={styles.empty}>—</div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('weight_robin_queue.col_provider', 'Provider')}</th>
                  <th>{t('weight_robin_queue.col_name', 'Name')}</th>
                  <th className={styles.alignRight}>
                    {t('weight_robin_queue.col_weight', 'Weight')}
                  </th>
                  <th>{t('weight_robin_queue.col_status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <EntryRow key={entry.authId} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title={t('weight_robin_queue.cycle_title', 'Live Cycle')}
        className={styles.cycleCard}
      >
        <p className={styles.cycleHint}>
          {t(
            'weight_robin_queue.cycle_hint',
            'The actual shuffled cycle from the backend. Current position is highlighted.'
          )}
        </p>
        {cycle.length === 0 ? (
          <div className={styles.empty}>
            {t('weight_robin_queue.cycle_empty', 'No cycle data available. The selector may not be active yet.')}
          </div>
        ) : (
          <div className={styles.cycleGrid}>
            {cycle.map((entry, idx) => (
              <CycleChip
                key={`${entry.authId}-${idx}`}
                entry={entry}
                index={idx}
                isCurrent={idx === currentIdx}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function EntryRow({ entry }: { entry: WeightRobinQueueEntry }) {
  const color = getProviderColor(entry.provider);
  return (
    <tr className={entry.available ? '' : styles.entryInactive}>
      <td>
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
      </td>
      <td className={styles.entryNameCell} title={entry.name}>
        {entry.name}
      </td>
      <td className={styles.alignRight}>{entry.weight}</td>
      <td>
        <span className={entry.available ? styles.statusAvailable : styles.statusUnavailable}>
          {entry.available ? '●' : '○'}
        </span>
      </td>
    </tr>
  );
}

function CycleChip({
  entry,
  index,
  isCurrent,
}: {
  entry: WeightRobinCycleEntry;
  index: number;
  isCurrent: boolean;
}) {
  const color = getProviderColor(entry.provider);
  return (
    <span
      className={`${styles.cycleChip} ${isCurrent ? styles.cycleChipCurrent : ''}`}
      style={{
        borderColor: isCurrent ? '#fff' : color,
        color: isCurrent ? '#fff' : color,
        background: isCurrent ? color : `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={`${index}. ${entry.name} (${entry.provider})`}
    >
      <span className={styles.cycleIndex}>{index}</span>
      <span className={styles.cycleName}>{entry.name}</span>
    </span>
  );
}
