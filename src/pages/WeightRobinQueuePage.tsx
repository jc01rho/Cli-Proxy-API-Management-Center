/**
 * Weight-Robin Queue — standalone detail page.
 * Shows a larger, more detailed view of the weighted cycle queue
 * (entries, weights, distribution, and a preview of the shuffled cycle).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { authFilesApi } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { AuthFileItem } from '@/types';
import styles from './WeightRobinQueuePage.module.scss';

interface QueueEntry {
  name: string;
  type: string;
  priority: number;
  weight: number;
  color: string;
  percent: number;
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
  qoder: '#1890ff',
};

function getProviderColor(type: string): string {
  return PROVIDER_COLORS[type.toLowerCase()] || '#888';
}

function clampWeight(priority: number): number {
  if (priority <= 0) return 1;
  if (priority > 100) return 100;
  return priority;
}

function parsePriorityValue(value: unknown): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

/**
 * Build a preview of the shuffled cycle: each auth appears `weight` times,
 * then the cycle is Fisher-Yates shuffled. This mirrors the backend
 * `WeightedRobinSelector` algorithm so the UI shows what the server will do.
 */
function buildShuffledCycle(items: QueueEntry[]): QueueEntry[] {
  const cycle: QueueEntry[] = [];
  for (const item of items) {
    for (let i = 0; i < item.weight; i += 1) {
      cycle.push(item);
    }
  }
  // Fisher-Yates shuffle (mutates copy)
  const shuffled = [...cycle];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function WeightRobinQueuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFilesApi.list();
      const list = (res?.files ?? res ?? []) as AuthFileItem[];
      setFiles(list);
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

  const entries: QueueEntry[] = useMemo(() => {
    const mapped: QueueEntry[] = [];
    for (const file of files) {
      if (file.disabled || file.unavailable) continue;
      const priority = parsePriorityValue(file.priority);
      if (priority == null) continue;
      mapped.push({
        name: String(file.name ?? file.authIndex ?? ''),
        type: String(file.type ?? file.provider ?? 'unknown'),
        priority,
        weight: clampWeight(priority),
        color: getProviderColor(String(file.type ?? file.provider ?? '')),
        percent: 0,
      });
    }
    mapped.sort((a, b) => b.weight - a.weight);
    const total = mapped.reduce((sum, e) => sum + e.weight, 0);
    return mapped.map((e) => ({
      ...e,
      percent: total > 0 ? (e.weight / total) * 100 : 0,
    }));
  }, [files]);

  const cycle = useMemo(() => buildShuffledCycle(entries), [entries]);
  const totalWeight = useMemo(
    () => entries.reduce((sum, e) => sum + e.weight, 0),
    [entries]
  );
  const avgWeight = entries.length > 0 ? totalWeight / entries.length : 0;

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
                'Detailed view of the weighted cycle used by weight-robin routing strategy.'
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
          <span className={styles.statValue}>{entries.length}</span>
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
          <span className={styles.statValue}>{cycle.length}</span>
        </Card>
      </div>

      <div className={styles.grid}>
        <Card
          title={t('weight_robin_queue.distribution_title', 'Weight Distribution')}
          className={styles.distributionCard}
        >
          {entries.length === 0 ? (
            <div className={styles.empty}>
              {t(
                'weight_robin_queue.no_entries',
                'No active auth entries. Enable at least one auth file with a non-negative priority to use weight-robin.'
              )}
            </div>
          ) : (
            <ul className={styles.distributionList}>
              {entries.map((entry) => (
                <li key={entry.name} className={styles.distributionRow}>
                  <div className={styles.distributionInfo}>
                    <span
                      className={styles.providerBadge}
                      style={{
                        borderColor: entry.color,
                        color: entry.color,
                        background: `color-mix(in srgb, ${entry.color} 12%, transparent)`,
                      }}
                    >
                      {entry.type}
                    </span>
                    <span className={styles.entryName} title={entry.name}>
                      {entry.name}
                    </span>
                    <span className={styles.weightBadge}>
                      w:{entry.weight}
                    </span>
                    <span className={styles.percentBadge}>
                      {entry.percent.toFixed(2)}%
                    </span>
                  </div>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${entry.percent}%`,
                        background: `linear-gradient(90deg, ${entry.color}, color-mix(in srgb, ${entry.color} 40%, transparent))`,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title={t('weight_robin_queue.table_title', 'Auth File Details')}
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
                      {t('weight_robin_queue.col_priority', 'Priority')}
                    </th>
                    <th className={styles.alignRight}>
                      {t('weight_robin_queue.col_weight', 'Weight')}
                    </th>
                    <th className={styles.alignRight}>
                      {t('weight_robin_queue.col_share', 'Share')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.name}>
                      <td>
                        <span
                          className={styles.providerBadge}
                          style={{
                            borderColor: entry.color,
                            color: entry.color,
                            background: `color-mix(in srgb, ${entry.color} 12%, transparent)`,
                          }}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className={styles.entryNameCell} title={entry.name}>
                        {entry.name}
                      </td>
                      <td className={styles.alignRight}>{entry.priority}</td>
                      <td className={styles.alignRight}>{entry.weight}</td>
                      <td className={styles.alignRight}>
                        {entry.percent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card
          title={t('weight_robin_queue.cycle_title', 'Shuffled Cycle Preview')}
          className={styles.cycleCard}
        >
          <p className={styles.cycleHint}>
            {t(
              'weight_robin_queue.cycle_hint',
              'Each auth appears N times (its weight), then the cycle is shuffled. The backend picks the next entry sequentially from this cycle.'
            )}
          </p>
          {cycle.length === 0 ? (
            <div className={styles.empty}>—</div>
          ) : (
            <div className={styles.cycleGrid}>
              {cycle.map((entry, idx) => (
                <span
                  key={`${entry.name}-${idx}`}
                  className={styles.cycleChip}
                  style={{
                    borderColor: entry.color,
                    color: entry.color,
                    background: `color-mix(in srgb, ${entry.color} 12%, transparent)`,
                  }}
                  title={`${idx + 1}. ${entry.name} (${entry.type}, w:${entry.weight})`}
                >
                  <span className={styles.cycleIndex}>{idx + 1}</span>
                  <span className={styles.cycleName}>{entry.name}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
