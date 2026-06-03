/**
 * Weight-Robin Queue — standalone detail page.
 * Shows a larger, more detailed view of the weighted cycle queue
 * (entries, weights, distribution, and a preview of the shuffled cycle).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { authFilesApi, providersApi } from '@/services/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { AuthFileItem } from '@/types';
import type { GeminiKeyConfig, OpenAIProviderConfig, ProviderKeyConfig } from '@/types/provider';
import styles from './WeightRobinQueuePage.module.scss';

interface QueueEntry {
  /** Display name. For aliased providers this is the model name. */
  name: string;
  /** Provider type (e.g. "codex", "github-copilot", "openai-compatible"). */
  type: string;
  /** Raw priority value from the config. */
  priority: number;
  /** Clamped weight used by the backend selector. */
  weight: number;
  /** Provider color. */
  color: string;
  /** Percent of total weight, 0–100. */
  percent: number;
  /** Auth file name or provider config name (for tooltips). */
  source: string;
  /** Aliased destinations (no pre-allocated weight — tracked dynamically). */
  aliases: { name: string; alias: string }[];
  /** Disabled / unavailable flag — such entries are shown with weight 0. */
  inactive: boolean;
  /** Inactive reason (e.g. "disabled", "unavailable", "no priority"). */
  inactiveReason?: string;
}

/** Provider key config (Claude, Codex, CommandCode, Mistral, Vertex, Gemini). */
interface ProviderKeyEntry {
  apiKey: string;
  priority?: number;
  models?: { name: string; alias?: string }[];
  authIndex?: string;
}

interface AliasContributor {
  name: string;
  type: string;
  weight: number;
  color: string;
  inactive: boolean;
  modelName?: string;
}

interface AliasGroup {
  alias: string;
  modelNames: string[];
  contributors: AliasContributor[];
  totalWeight: number;
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
  vertex: '#4285f4',
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

export function WeightRobinQueuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [files, setFiles] = useState<AuthFileItem[]>([]);
  const [openAIProviders, setOpenAIProviders] = useState<OpenAIProviderConfig[]>([]);
  const [claudeKeys, setClaudeKeys] = useState<ProviderKeyConfig[]>([]);
  const [codexKeys, setCodexKeys] = useState<ProviderKeyConfig[]>([]);
  const [geminiKeys, setGeminiKeys] = useState<GeminiKeyConfig[]>([]);
  const [commandCodeKeys, setCommandCodeKeys] = useState<ProviderKeyConfig[]>([]);
  const [mistralKeys, setMistralKeys] = useState<ProviderKeyConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [authRes, providers, claude, codex, gemini, commandCode, mistral] = await Promise.all([
        authFilesApi.list(),
        providersApi.getOpenAIProviders().catch(() => [] as OpenAIProviderConfig[]),
        providersApi.getClaudeConfigs().catch(() => [] as ProviderKeyConfig[]),
        providersApi.getCodexConfigs().catch(() => [] as ProviderKeyConfig[]),
        providersApi.getGeminiKeys().catch(() => [] as GeminiKeyConfig[]),
        providersApi.getCommandCodeConfigs().catch(() => [] as ProviderKeyConfig[]),
        providersApi.getMistralConfigs().catch(() => [] as ProviderKeyConfig[]),
      ]);
      const list = (authRes?.files ?? authRes ?? []) as AuthFileItem[];
      setFiles(list);
      setOpenAIProviders(providers);
      setClaudeKeys(claude);
      setCodexKeys(codex);
      setGeminiKeys(gemini);
      setCommandCodeKeys(commandCode);
      setMistralKeys(mistral);
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

    // 1) OAuth auth files — each file with a valid priority becomes one entry.
    for (const file of files) {
      const priority = parsePriorityValue(file.priority);
      const inactive = !!file.disabled || !!file.unavailable;
      const reason = file.disabled
        ? 'disabled'
        : file.unavailable
          ? 'unavailable'
          : undefined;
      mapped.push({
        name: String(file.name ?? file.authIndex ?? ''),
        type: String(file.type ?? file.provider ?? 'oauth'),
        priority: priority ?? 1,
        weight: inactive ? 0 : clampWeight(priority ?? 1),
        color: getProviderColor(String(file.type ?? file.provider ?? '')),
        percent: 0,
        source: String(file.name ?? file.authIndex ?? ''),
        aliases: [],
        inactive,
        inactiveReason: reason,
      });
    }

    const apiKeyProviders: { keys: ProviderKeyEntry[]; type: string }[] = [
      { keys: claudeKeys, type: 'claude' },
      { keys: codexKeys, type: 'codex' },
      { keys: geminiKeys, type: 'gemini' },
      { keys: commandCodeKeys, type: 'commandcode' },
      { keys: mistralKeys, type: 'mistral' },
    ];

    for (const { keys, type } of apiKeyProviders) {
      for (const key of keys) {
        const priority = parsePriorityValue(key.priority);
        const effectivePriority = priority ?? 1;
        const displayName = key.authIndex || key.apiKey.slice(0, 12) + '...';
        mapped.push({
          name: displayName,
          type,
          priority: effectivePriority,
          weight: clampWeight(effectivePriority),
          color: getProviderColor(type),
          percent: 0,
          source: displayName,
          aliases: (key.models ?? []).map((m) => ({
            name: String(m.name ?? ''),
            alias: String(m.alias ?? ''),
          })),
          inactive: false,
        });
      }
    }

    for (const provider of openAIProviders) {
      if (provider.disabled) continue;
      const priority = parsePriorityValue(provider.priority);
      const effectivePriority = priority ?? 1;
      const providerType = 'openai-compatible';
      mapped.push({
        name: provider.name,
        type: providerType,
        priority: effectivePriority,
        weight: clampWeight(effectivePriority),
        color: getProviderColor(providerType),
        percent: 0,
        source: provider.name,
        aliases: (provider.models ?? []).map((m) => ({
          name: String(m.name ?? ''),
          alias: String(m.alias ?? ''),
        })),
        inactive: false,
      });
    }

    // Sort: active entries by weight desc, inactive entries after
    mapped.sort((a, b) => {
      if (a.inactive !== b.inactive) return a.inactive ? 1 : -1;
      return b.weight - a.weight;
    });
    const total = mapped.reduce((sum, e) => sum + e.weight, 0);
    return mapped.map((e) => ({
      ...e,
      percent: total > 0 ? (e.weight / total) * 100 : 0,
    }));
  }, [files, openAIProviders, claudeKeys, codexKeys, geminiKeys, commandCodeKeys, mistralKeys]);

  const totalWeight = useMemo(
    () => entries.reduce((sum, e) => sum + e.weight, 0),
    [entries]
  );
  const activeCount = entries.filter((e) => !e.inactive).length;
  const avgWeight = activeCount > 0 ? totalWeight / activeCount : 0;

  const aliasGroups: AliasGroup[] = useMemo(() => {
    const groupMap = new Map<string, AliasGroup>();

    const ensureGroup = (alias: string, modelName: string): AliasGroup => {
      const key = alias || modelName;
      const existing = groupMap.get(key);
      if (existing) {
        if (modelName && !existing.modelNames.includes(modelName)) {
          existing.modelNames.push(modelName);
        }
        return existing;
      }
      const group: AliasGroup = {
        alias: key,
        modelNames: modelName ? [modelName] : [],
        contributors: [],
        totalWeight: 0,
        percent: 0,
      };
      groupMap.set(key, group);
      return group;
    };

    for (const entry of entries) {
      const contributor: AliasContributor = {
        name: entry.name,
        type: entry.type,
        weight: entry.weight,
        color: entry.color,
        inactive: entry.inactive,
      };

      if (entry.aliases.length > 0) {
        for (const a of entry.aliases) {
          const group = ensureGroup(a.alias || a.name, a.name);
          group.contributors.push({ ...contributor, modelName: a.name });
          group.totalWeight += entry.weight;
        }
      }
      // OAuth auth files without aliases are skipped — they don't represent
      // a specific model/alias, so grouping them by file name is misleading.
    }

    const groups = [...groupMap.values()].sort((a, b) => b.totalWeight - a.totalWeight);
    const grandTotal = groups.reduce((sum, g) => sum + g.totalWeight, 0);
    return groups.map((g) => ({
      ...g,
      percent: grandTotal > 0 ? (g.totalWeight / grandTotal) * 100 : 0,
    }));
  }, [entries]);

  const aliasCycles: Map<string, AliasContributor[]> = useMemo(() => {
    const map = new Map<string, AliasContributor[]>();
    for (const group of aliasGroups) {
      const active = group.contributors.filter((c) => !c.inactive && c.weight > 0);
      const cycle: AliasContributor[] = [];
      for (const c of active) {
        for (let i = 0; i < c.weight; i += 1) {
          cycle.push(c);
        }
      }
      for (let i = cycle.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [cycle[i], cycle[j]] = [cycle[j], cycle[i]];
      }
      map.set(group.alias, cycle);
    }
    return map;
  }, [aliasGroups]);

  const totalCycleLength = useMemo(() => {
    let total = 0;
    for (const cycle of aliasCycles.values()) total += cycle.length;
    return total;
  }, [aliasCycles]);

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
          <span className={styles.statValue}>{totalCycleLength}</span>
        </Card>
        <Card className={styles.statCard}>
          <span className={styles.statLabel}>
            {t('weight_robin_queue.alias_groups', 'Alias / Model Groups')}
          </span>
          <span className={styles.statValue}>{aliasGroups.length}</span>
        </Card>
      </div>

      <Card
        title={t('weight_robin_queue.alias_queue_title', 'Queue by Alias / Model')}
        className={styles.aliasQueueCard}
      >
        {aliasGroups.length === 0 ? (
          <div className={styles.empty}>
            {t(
              'weight_robin_queue.no_alias_groups',
              'No alias or model mappings found. Configure aliases in your openai-compatibility providers to see per-alias queues.'
            )}
          </div>
        ) : (
          <ul className={styles.aliasGroupList}>
            {aliasGroups.map((group) => (
              <li key={group.alias} className={styles.aliasGroupRow}>
                <div className={styles.aliasGroupHeader}>
                  <span className={styles.aliasGroupName} title={group.alias}>
                    {group.alias}
                  </span>
                  <span className={styles.aliasGroupTotal}>
                    w:{group.totalWeight}
                  </span>
                  <span className={styles.aliasGroupPercent}>
                    {group.percent.toFixed(2)}%
                  </span>
                </div>
                {group.modelNames.length > 0 &&
                  !group.modelNames.every((m) => m === group.alias) && (
                    <div className={styles.aliasGroupModels}>
                      {group.modelNames.map((m) => (
                        <span key={m} className={styles.aliasGroupModelTag}>
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${group.percent}%`,
                      background: `linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 40%, transparent))`,
                    }}
                  />
                </div>
                <ul className={styles.contributorList}>
                  {group.contributors.map((c, idx) => (
                    <li
                      key={`${c.name}-${idx}`}
                      className={`${styles.contributorChip} ${c.inactive ? styles.contributorInactive : ''}`}
                      title={`${c.name} (${c.type}, w:${c.weight})${c.modelName ? ` [${c.modelName}]` : ''}`}
                    >
                      <span
                        className={styles.providerBadge}
                        style={{
                          borderColor: c.color,
                          color: c.color,
                          background: `color-mix(in srgb, ${c.color} 12%, transparent)`,
                        }}
                      >
                        {c.type}
                      </span>
                      <span className={styles.contributorName}>{c.name}</span>
                      {c.modelName && c.modelName !== c.name && (
                        <span className={styles.contributorModel}>{c.modelName}</span>
                      )}
                      <span className={styles.contributorWeight}>w:{c.weight}</span>
                    </li>
                  ))}
                </ul>
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
          title={t('weight_robin_queue.cycle_title', 'Shuffled Cycle Preview (per Alias)')}
          className={styles.cycleCard}
        >
          <p className={styles.cycleHint}>
            {t(
              'weight_robin_queue.cycle_hint',
              'Each auth appears N times (its weight), then the cycle is shuffled. The backend builds a separate cycle for each alias/model since requests are dispatched independently per model.'
            )}
          </p>
          {aliasGroups.length === 0 ? (
            <div className={styles.empty}>—</div>
          ) : (
            <div className={styles.cycleList}>
              {aliasGroups.map((group) => {
                const cycle = aliasCycles.get(group.alias) ?? [];
                return (
                  <div key={group.alias} className={styles.cycleGroup}>
                    <div className={styles.cycleGroupHeader}>
                      <span className={styles.cycleGroupAlias}>{group.alias}</span>
                      <span className={styles.cycleGroupLength}>
                        {t('weight_robin_queue.cycle_length_short', 'length')}: {cycle.length}
                      </span>
                    </div>
                    {cycle.length === 0 ? (
                      <div className={styles.empty}>
                        {t('weight_robin_queue.cycle_empty', 'No active auths in this cycle')}
                      </div>
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
                  </div>
                );
              })}
            </div>
          )}
        </Card>
    </div>
  );
}
