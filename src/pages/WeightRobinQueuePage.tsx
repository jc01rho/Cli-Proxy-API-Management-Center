import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useInterval } from '@/hooks/useInterval';
import { configApi } from '@/services/api';
import type { WeightRobinQueueSnapshot, WeightRobinQueueEntry, WeightRobinCycleEntry } from '@/services/api/config';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import styles from './WeightRobinQueuePage.module.scss';

const REFRESH_INTERVAL_MS = 2000;

const PROVIDER_COLORS: Record<string, string> = {
  claude: '#e97a2b',
  gemini: '#4285f4',
  codex: '#34a853',
  'openai-compatible': '#9b59b6',
  commandcode: '#e97a2b',
  mistral: '#ff6f00',
  'mimo-code': '#6c5ce7',
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

interface ModelGroup {
  model: string;
  entries: WeightRobinQueueEntry[];
  rawTotalWeight: number;
  normalizedTotalWeight: number;
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
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const prevTotalPicks = useRef<number>(0);
  const prevPickedAt = useRef<string>('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await configApi.getWeightRobinQueue(selectedModel || undefined);
      setSnapshot(data);
      setLastUpdated(new Date());
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [selectedModel]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useHeaderRefresh(loadQueue);
  useInterval(() => { void loadQueue(); }, autoRefresh ? REFRESH_INTERVAL_MS : null);

  const picksDelta = useMemo(() => {
    if (!snapshot) return 0;
    return snapshot.totalPicks - prevTotalPicks.current;
  }, [snapshot]);

  useEffect(() => {
    if (snapshot) {
      prevTotalPicks.current = snapshot.totalPicks;
      if (snapshot.lastPickedAt) prevPickedAt.current = snapshot.lastPickedAt;
    }
  }, [snapshot]);

  const entries = useMemo<WeightRobinQueueEntry[]>(
    () => snapshot?.entries ?? [],
    [snapshot]
  );
  const totalWeight = snapshot?.totalWeight ?? 0;
  const currentIdx = snapshot?.currentIdx ?? 0;
  const cycleLength = snapshot?.cycleLength ?? 0;
  const lastPicked = snapshot?.lastPicked;
  const activeCount = entries.filter((e) => e.available).length;
  const avgWeight = activeCount > 0 ? totalWeight / activeCount : 0;

  const gcd = snapshot?.gcd ?? 1;
  const normalizedTotalWeight = gcd > 1 ? Math.round(totalWeight / gcd) : totalWeight;

  const modelGroups = useMemo<ModelGroup[]>(() => {
    if (entries.length === 0) return [];
    const seenAuths = new Set<string>();
    const map = new Map<string, { entries: WeightRobinQueueEntry[]; rawWeight: number; normalizedWeight: number }>();
    for (const entry of entries) {
      const models = entry.models && entry.models.length > 0
        ? entry.models
        : ['(unassigned)'];
      for (const model of models) {
        const key = model.toLowerCase();
        const slot = map.get(key) ?? { entries: [], rawWeight: 0, normalizedWeight: 0 };
        if (!seenAuths.has(`${key}:${entry.authId}`)) {
          slot.entries.push(entry);
          seenAuths.add(`${key}:${entry.authId}`);
        }
        slot.rawWeight += entry.weight;
        slot.normalizedWeight += gcd > 1 ? entry.weight / gcd : entry.weight;
        map.set(key, slot);
      }
    }
    const groups: ModelGroup[] = [];
    for (const [model, slot] of map.entries()) {
      const rawTotal = Math.round(slot.rawWeight);
      const normalizedTotal = Math.round(slot.normalizedWeight);
      groups.push({
        model: model === '(unassigned)' ? '(unassigned)' : model,
        entries: slot.entries,
        rawTotalWeight: rawTotal,
        normalizedTotalWeight: normalizedTotal,
        totalWeight: normalizedTotal,
        share: normalizedTotalWeight > 0 ? (normalizedTotal / normalizedTotalWeight) * 100 : 0,
      });
    }
    return groups
      .filter((group) => new Set(group.entries.map((e) => e.provider)).size > 1)
      .sort((a, b) => b.normalizedTotalWeight - a.normalizedTotalWeight);
   }, [entries, normalizedTotalWeight, gcd]);

   const availableAliases = useMemo<string[]>(() => {
    const set = new Set<string>();
    for (const e of entries) {
      if (e.models && e.models.length > 0) {
        for (const m of e.models) set.add(m);
      }
    }
    return Array.from(set).sort();
  }, [entries]);

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
          {availableAliases.length > 0 && (
            <select
              className={styles.modelSelect}
              value={selectedModel}
              onChange={(e) => {
                prevTotalPicks.current = 0;
                setSelectedModel(e.target.value);
              }}
              aria-label={t('weight_robin_queue.select_model', 'Select model/alias')}
            >
              <option value="">
                {t('weight_robin_queue.all_models', 'All models')}
              </option>
              {availableAliases.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          {lastUpdated && (
            <span className={styles.updatedAt}>
              {autoRefresh ? '● ' : ''}
              {t('weight_robin_queue.last_updated', 'Last updated')}:{' '}
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant={autoRefresh ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
          >
            {autoRefresh
              ? t('weight_robin_queue.auto_refresh_on', 'Auto: ON')
              : t('weight_robin_queue.auto_refresh_off', 'Auto: OFF')}
          </Button>
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
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.total_picks', 'Total Picks')}
          </span>
          <span className={styles.statValue}>{snapshot?.totalPicks ?? 0}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.picks_delta', 'Picks (last 2s)')}
          </span>
          <span
            className={styles.statValue}
            style={{ color: picksDelta > 0 ? '#34a853' : '#888' }}
          >
            +{picksDelta}
          </span>
        </Card>
        {snapshot?.lastPickedAt && (
          <Card className={styles.statCard}>
            <span className={styles.statLabel}>
              {t('weight_robin_queue.last_picked_at', 'Last Picked At')}
            </span>
            <span className={styles.statValue}>
              {new Date(snapshot.lastPickedAt).toLocaleTimeString()}
            </span>
          </Card>
        )}
      </div>

      <Card
        title={t('weight_robin_queue.cycle_title', 'Shuffled Cycle Preview (per Alias)')}
        className={styles.cycleCard}
      >
        <p className={styles.cycleHint}>
          {t('weight_robin_queue.cycle_hint', 'The actual shuffled cycle from the backend, grouped by alias/model. Current position is highlighted.')}
        </p>
        {(!snapshot?.aliasCycles || Object.keys(snapshot.aliasCycles).length === 0) ? (
          <div className={styles.empty}>
            {t('weight_robin_queue.cycle_empty', 'No cycle data available. The selector may not be active yet.')}
          </div>
        ) : (
          <div className={styles.cycleAliasList}>
            {Object.entries(snapshot.aliasCycles)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([aliasKey, aliasCycle]) => (
                <div key={aliasKey} className={styles.cycleGroup}>
                  <div className={styles.cycleGroupHeader}>
                    <span className={styles.cycleGroupAlias}>{aliasKey}</span>
                    <span className={styles.cycleGroupLength}>
                      {aliasCycle.length} {t('weight_robin_queue.cycle_slots', 'slots')}
                    </span>
                  </div>
                  <div className={styles.cycleGrid}>
                    {aliasCycle.map((entry, idx) => (
                      <CycleChip
                        key={`${aliasKey}-${entry.authId}-${idx}`}
                        entry={entry}
                        index={idx}
                        isCurrent={idx === 0}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </Card>

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
              <ModelGroupCard key={group.model} group={group} gcd={gcd} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ModelGroupCard({
  group,
  gcd,
}: {
  group: ModelGroup;
  gcd: number;
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
          {t('weight_robin_queue.weight_unit', 'w:')} {group.rawTotalWeight}
          {gcd > 1 && (
            <span className={styles.aliasGroupNormalized}>
              {' '}
              {t('weight_robin_queue.weight_normalized_format', '/ {{normalized}}', {
                normalized: group.normalizedTotalWeight,
              })}
            </span>
          )}
        </span>
        <span className={styles.aliasGroupPercent}>{group.share.toFixed(1)}%</span>
      </div>
      <div className={styles.distributionBar}>
        {group.entries.map((entry) => {
          const entryColor = getProviderColor(entry.provider);
          const entryNormalized = gcd > 1 ? entry.weight / gcd : entry.weight;
          const segmentPct =
            group.totalWeight > 0 ? (entryNormalized / group.totalWeight) * 100 : 0;
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
                 className={`${styles.contributorChip} ${entry.inCycle ? '' : styles.contributorOutOfCycle}`}
                 title={entry.inCycle ? entry.name : `${entry.name} (not in active cycle)`}
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
  const modelDisplay = entry.model ? `[${entry.model}] ` : '';
  return (
    <span
      className={`${styles.cycleChip} ${isCurrent ? styles.cycleChipCurrent : ''}`}
      style={{
        borderColor: isCurrent ? '#fff' : color,
        color: isCurrent ? '#fff' : color,
        background: isCurrent ? color : `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
      title={`${index}. ${modelDisplay}${entry.name} (${entry.provider})`}
    >
      <span className={styles.cycleIndex}>{index}</span>
      <span className={styles.cycleName}>{modelDisplay}{entry.name}</span>
    </span>
  );
}
