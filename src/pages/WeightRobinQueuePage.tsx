import { useCallback, useEffect, useMemo, useState } from 'react';
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
  xiaomi: '#ff5722',
  ollama: '#009688',
  opencode: '#673ab7',
};

function getProviderColor(provider: string): string {
  return PROVIDER_COLORS[provider.toLowerCase()] || '#888';
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y > 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function gcdAll(values: number[]): number {
  const positive = values.filter((v) => v > 0);
  if (positive.length === 0) return 1;
  return positive.reduce((acc, v) => gcd(acc, v));
}

const MAX_CYCLE_CHIPS = 60;

interface ModelGroup {
  model: string;
  entries: WeightRobinQueueEntry[];
  totalWeight: number;
  share: number;
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

  const entries = useMemo<WeightRobinQueueEntry[]>(
    () => snapshot?.entries ?? [],
    [snapshot]
  );
  const cycle = useMemo<WeightRobinCycleEntry[]>(
    () => snapshot?.cycle ?? [],
    [snapshot]
  );
  const totalWeight = snapshot?.totalWeight ?? 0;
  const currentIdx = snapshot?.currentIdx ?? 0;
  const cycleLength = snapshot?.cycleLength ?? 0;
  const lastPicked = snapshot?.lastPicked;
  const activeCount = entries.filter((e) => e.available).length;
  const avgWeight = activeCount > 0 ? totalWeight / activeCount : 0;

  const globalDivisor = useMemo(() => {
    if (totalWeight > 0) return gcdAll(entries.map((e) => e.weight));
    return 1;
  }, [entries, totalWeight]);

  const modelGroups = useMemo<ModelGroup[]>(() => {
    if (entries.length === 0) return [];
    const seenAuths = new Set<string>();
    const map = new Map<string, { entries: WeightRobinQueueEntry[]; weight: number }>();
    for (const entry of entries) {
      const models = entry.models && entry.models.length > 0
        ? entry.models
        : ['(unassigned)'];
      const perModelWeight = entry.models && entry.models.length > 0
        ? entry.weight / entry.models.length
        : entry.weight;
      for (const model of models) {
        const key = model.toLowerCase();
        const slot = map.get(key) ?? { entries: [], weight: 0 };
        if (!seenAuths.has(`${key}:${entry.authId}`)) {
          slot.entries.push(entry);
          seenAuths.add(`${key}:${entry.authId}`);
        }
        slot.weight += perModelWeight;
        map.set(key, slot);
      }
    }
    const groups: ModelGroup[] = [];
    for (const [model, slot] of map.entries()) {
      const roundedTotal = Math.round(slot.weight);
      groups.push({
        model: model === '(unassigned)' ? '(unassigned)' : model,
        entries: slot.entries,
        totalWeight: roundedTotal,
        share: totalWeight > 0 ? (roundedTotal / totalWeight) * 100 : 0,
      });
    }
    groups.sort((a, b) => b.totalWeight - a.totalWeight);
    return groups;
  }, [entries, totalWeight]);

  const normalizedCycleLength = useMemo(() => {
    if (cycleLength <= 0) return 0;
    return Math.max(1, Math.round(cycleLength / globalDivisor));
  }, [cycleLength, globalDivisor]);

  const visibleCycle = useMemo(() => {
    if (cycle.length === 0) return [];
    if (cycle.length <= MAX_CYCLE_CHIPS) return cycle;
    const half = Math.floor(MAX_CYCLE_CHIPS / 2);
    return [...cycle.slice(0, half), ...cycle.slice(cycle.length - half)];
  }, [cycle]);

  const cycleTruncated = cycle.length > MAX_CYCLE_CHIPS;

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
        title={t('weight_robin_queue.alias_queue_title', 'Queue by Alias / Model')}
        className={styles.aliasQueueCard}
      >
        {modelGroups.length === 0 ? (
          <div className={styles.empty}>
            {t('weight_robin_queue.no_alias_groups', 'No alias or model mappings found.')}
          </div>
        ) : (
          <ul className={styles.aliasGroupList}>
            {modelGroups.map((group) => (
              <ModelGroupCard key={group.model} group={group} />
            ))}
          </ul>
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
          {cycleTruncated && (
            <>
              {' '}
              {t(
                'weight_robin_queue.cycle_truncated',
                'Showing {{shown}} of {{total}} slots (head + tail).',
                { shown: visibleCycle.length, total: cycle.length }
              )}
            </>
          )}
        </p>
        {cycle.length === 0 ? (
          <div className={styles.empty}>
            {t('weight_robin_queue.cycle_empty', 'No cycle data available. The selector may not be active yet.')}
          </div>
        ) : (
          <div className={styles.cycleGrid}>
            {visibleCycle.map((entry, idx) => {
              const realIndex = cycleTruncated && idx >= MAX_CYCLE_CHIPS / 2
                ? cycle.length - (visibleCycle.length - idx)
                : idx;
              return (
                <CycleChip
                  key={`${entry.authId}-${idx}`}
                  entry={entry}
                  index={realIndex}
                  isCurrent={realIndex === currentIdx}
                />
              );
            })}
          </div>
        )}
        {cycleLength > 0 && (
          <div className={styles.cycleSummary}>
            <span>
              {t('weight_robin_queue.normalized_length', 'Normalized length')}:{' '}
              <strong>{normalizedCycleLength}</strong>
              <span className={styles.cycleSummaryMeta}>
                {' '}
                ({cycleLength} / {globalDivisor})
              </span>
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}

function ModelGroupCard({
  group,
}: {
  group: ModelGroup;
}) {
  const { t } = useTranslation();
  const color = getProviderColor(group.entries[0]?.provider ?? '');
  return (
    <li className={styles.aliasGroupRow}>
      <div className={styles.aliasGroupHeader}>
        <span
          className={styles.providerBadge}
          style={{
            borderColor: color,
            color,
            background: `color-mix(in srgb, ${color} 12%, transparent)`,
          }}
        >
          {group.model}
        </span>
        <span className={styles.aliasGroupName}>
          {t('weight_robin_queue.provider_group', '{{count}} auths', { count: group.entries.length })}
        </span>
        <span className={styles.aliasGroupTotal}>
          {t('weight_robin_queue.weight_unit', 'w:')} {group.totalWeight}
        </span>
        <span className={styles.aliasGroupPercent}>{group.share.toFixed(1)}%</span>
      </div>
      <div className={styles.distributionBar}>
        {group.entries.map((entry) => {
          const entryColor = getProviderColor(entry.provider);
          const segmentPct = group.totalWeight > 0 ? (entry.weight / group.totalWeight) * 100 : 0;
          return (
            <span
              key={entry.authId}
              className={`${styles.distributionSegment} ${entry.available ? '' : styles.entryInactive}`}
              style={{
                width: `${segmentPct}%`,
                background: `linear-gradient(180deg, ${entryColor}, color-mix(in srgb, ${entryColor} 60%, transparent))`,
              }}
              title={`${entry.name} (w:${entry.weight})`}
            />
          );
        })}
      </div>
      <div className={styles.contributorList}>
        {group.entries.map((entry) => {
          const entryColor = getProviderColor(entry.provider);
          return (
            <span
              key={entry.authId}
              className={`${styles.contributorChip} ${entry.available ? '' : styles.contributorInactive}`}
            >
              <span
                className={styles.contributorDot}
                style={{ background: entryColor }}
              />
              <span className={styles.contributorName} title={entry.name}>
                {entry.name}
              </span>
              <span className={styles.contributorWeight}>
                {entry.weight}
              </span>
            </span>
          );
        })}
      </div>
    </li>
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
