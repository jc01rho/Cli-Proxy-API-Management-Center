import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Button } from '@/components/ui/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { useThemeStore } from '@/stores';
import {
  StatCards,
  UsageChart,
  ChartLineSelector,
  ApiDetailsCard,
  ModelStatsCard,
  PriceSettingsCard,
  useUsageData,
  useSparklines,
  useChartData
} from '@/components/usage';
import {
  getModelNamesFromUsage,
  getApiStats,
  getModelStats,
  maskUsageSensitiveValue
} from '@/utils/usage';
import styles from './UsagePage.module.scss';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Local interface for better type safety
interface UsageDetail {
  failed?: boolean;
  [key: string]: unknown;
}

interface ApiEntry {
  models?: Record<string, {
    details?: UsageDetail[];
    success_count?: number;
    failure_count?: number;
    total_requests?: number;
    total_tokens?: number;
  }>;
  total_requests?: number;
  total_tokens?: number;
  success_count?: number;
  failure_count?: number;
}

export function UsagePage() {
  const { t } = useTranslation();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  // Data hook
  const {
    usage,
    loading,
    error,
    modelPrices,
    setModelPrices,
    loadUsage,
    handleExport,
    handleImport,
    handleImportChange,
    importInputRef,
    exporting,
    importing
  } = useUsageData();

  useHeaderRefresh(loadUsage);

  // Filter state
  const [selectedApiKey, setSelectedApiKey] = useState<string>('all');

  // Available API keys
  const apiKeys = useMemo(() => {
    if (!usage?.apis) return [];
    return Object.keys(usage.apis).sort();
  }, [usage]);

  // Filtered usage data
  const filteredUsage = useMemo(() => {
    if (!usage || selectedApiKey === 'all' || !usage.apis || !usage.apis[selectedApiKey]) {
      return usage;
    }

    const apiEntry = usage.apis[selectedApiKey] as ApiEntry;
    const models = apiEntry.models || {};

    let derivedSuccessCount = 0;
    let derivedFailureCount = 0;

    // Calculate derived counts from models if needed
    Object.values(models).forEach((modelEntry) => {
      const details = Array.isArray(modelEntry.details) ? modelEntry.details : [];
      const hasExplicitCounts =
        typeof modelEntry.success_count === 'number' || typeof modelEntry.failure_count === 'number';

      if (hasExplicitCounts) {
        derivedSuccessCount += Number(modelEntry.success_count) || 0;
        derivedFailureCount += Number(modelEntry.failure_count) || 0;
      } else {
        details.forEach((detail) => {
          if (detail?.failed === true) {
            derivedFailureCount += 1;
          } else {
            derivedSuccessCount += 1;
          }
        });
      }
    });

    const hasApiExplicitCounts =
      typeof apiEntry.success_count === 'number' || typeof apiEntry.failure_count === 'number';

    const successCount = hasApiExplicitCounts
      ? Number(apiEntry.success_count) || 0
      : derivedSuccessCount;

    const failureCount = hasApiExplicitCounts
      ? Number(apiEntry.failure_count) || 0
      : derivedFailureCount;

    return {
      ...usage,
      total_requests: Number(apiEntry.total_requests) || 0,
      total_tokens: Number(apiEntry.total_tokens) || 0,
      success_count: successCount,
      failure_count: failureCount,
      apis: {
        [selectedApiKey]: apiEntry
      }
    };
  }, [usage, selectedApiKey]);

  // Chart lines state
  const [chartLines, setChartLines] = useState<string[]>(['all']);
  const MAX_CHART_LINES = 9;

  // Sparklines hook
  const {
    requestsSparkline,
    tokensSparkline,
    rpmSparkline,
    tpmSparkline,
    costSparkline
  } = useSparklines({ usage: filteredUsage, loading });

  // Chart data hook
  const {
    requestsPeriod,
    setRequestsPeriod,
    tokensPeriod,
    setTokensPeriod,
    requestsChartData,
    tokensChartData,
    requestsChartOptions,
    tokensChartOptions
  } = useChartData({ usage: filteredUsage, chartLines, isDark, isMobile });

  // Derived data
  const modelNames = useMemo(() => getModelNamesFromUsage(filteredUsage), [filteredUsage]);
  const apiStats = useMemo(() => getApiStats(filteredUsage, modelPrices), [filteredUsage, modelPrices]);
  const modelStats = useMemo(() => getModelStats(filteredUsage, modelPrices), [filteredUsage, modelPrices]);
  const hasPrices = Object.keys(modelPrices).length > 0;

  return (
    <div className={styles.container}>
      {loading && !usage && (
        <div className={styles.loadingOverlay} aria-busy="true">
          <div className={styles.loadingOverlayContent}>
            <LoadingSpinner size={28} className={styles.loadingOverlaySpinner} />
            <span className={styles.loadingOverlayText}>{t('common.loading')}</span>
          </div>
        </div>
      )}

      <div className={styles.header}>
        <h1 className={styles.pageTitle}>{t('usage_stats.title')}</h1>
        <div className={styles.headerActions}>
          <select
            className={styles.select}
            value={selectedApiKey}
            onChange={(e) => setSelectedApiKey(e.target.value)}
            disabled={loading || !usage}
          >
            <option value="all">{t('usage_stats.filter_all_keys')}</option>
            {apiKeys.map((key) => (
              <option key={key} value={key}>
                {maskUsageSensitiveValue(key)}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExport}
            loading={exporting}
            disabled={loading || importing}
          >
            {t('usage_stats.export')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
            loading={importing}
            disabled={loading || exporting}
          >
            {t('usage_stats.import')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadUsage}
            disabled={loading || exporting || importing}
          >
            {loading ? t('common.loading') : t('usage_stats.refresh')}
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleImportChange}
          />
        </div>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Stats Overview Cards */}
      <StatCards
        usage={filteredUsage}
        loading={loading}
        modelPrices={modelPrices}
        sparklines={{
          requests: requestsSparkline,
          tokens: tokensSparkline,
          rpm: rpmSparkline,
          tpm: tpmSparkline,
          cost: costSparkline
        }}
      />

      {/* Chart Line Selection */}
      <ChartLineSelector
        chartLines={chartLines}
        modelNames={modelNames}
        maxLines={MAX_CHART_LINES}
        onChange={setChartLines}
      />

      {/* Charts Grid */}
      <div className={styles.chartsGrid}>
        <UsageChart
          title={t('usage_stats.requests_trend')}
          period={requestsPeriod}
          onPeriodChange={setRequestsPeriod}
          chartData={requestsChartData}
          chartOptions={requestsChartOptions}
          loading={loading}
          isMobile={isMobile}
          emptyText={t('usage_stats.no_data')}
        />
        <UsageChart
          title={t('usage_stats.tokens_trend')}
          period={tokensPeriod}
          onPeriodChange={setTokensPeriod}
          chartData={tokensChartData}
          chartOptions={tokensChartOptions}
          loading={loading}
          isMobile={isMobile}
          emptyText={t('usage_stats.no_data')}
        />
      </div>

      {/* Details Grid */}
      <div className={styles.detailsGrid}>
        <ApiDetailsCard apiStats={apiStats} loading={loading} hasPrices={hasPrices} />
        <ModelStatsCard modelStats={modelStats} loading={loading} hasPrices={hasPrices} />
      </div>

      {/* Price Settings */}
      <PriceSettingsCard
        modelNames={modelNames}
        modelPrices={modelPrices}
        onPricesChange={setModelPrices}
      />
    </div>
  );
}
