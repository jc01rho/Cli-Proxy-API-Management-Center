import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { claudeWarmupApi, type ClaudeWarmupRunResult } from '@/services/api';
import { getErrorMessage } from '@/utils/helpers';
import styles from './VisualConfigEditor.module.scss';

interface ClaudeWarmupRunPanelProps {
  readonly disabled: boolean;
  readonly runWarmup?: () => Promise<ClaudeWarmupRunResult>;
  readonly initialResult?: ClaudeWarmupRunResult | null;
}

const defaultRun = () => claudeWarmupApi.run({ jitter: false });

export function ClaudeWarmupRunPanel({
  disabled,
  runWarmup = defaultRun,
  initialResult = null,
}: ClaudeWarmupRunPanelProps) {
  const { t } = useTranslation();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ClaudeWarmupRunResult | null>(initialResult);
  const [error, setError] = useState('');

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError('');
    try {
      setResult(await runWarmup());
    } catch (err: unknown) {
      setResult(null);
      setError(
        getErrorMessage(err, t('config_management.visual.sections.quota.claude_warmup.run_failed'))
      );
    } finally {
      setRunning(false);
    }
  }, [runWarmup, t]);

  const succeeded = result?.results.filter((item) => item.success).length ?? 0;

  return (
    <div className={styles.claudeWarmupRun}>
      <div className={styles.claudeWarmupRunHeader}>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void handleRun()}
          disabled={disabled || running}
          loading={running}
        >
          {t('config_management.visual.sections.quota.claude_warmup.run_now')}
        </Button>
        <span className={styles.claudeWarmupRunHint}>
          {t('config_management.visual.sections.quota.claude_warmup.run_hint')}
        </span>
      </div>
      {error ? (
        <div className="error-box" role="alert">
          {error}
        </div>
      ) : null}
      {result ? (
        <div className={styles.claudeWarmupResults} role="status">
          <div className={styles.claudeWarmupSummary}>
            {t('config_management.visual.sections.quota.claude_warmup.run_summary', {
              succeeded,
              total: result.results.length,
              model: result.model,
            })}
          </div>
          {result.error ? <div className="error-box">{result.error}</div> : null}
          {result.results.length === 0 ? (
            result.error ? null : (
              <div className={styles.claudeWarmupRunHint}>
                {t('config_management.visual.sections.quota.claude_warmup.run_empty')}
              </div>
            )
          ) : (
            <table className={styles.claudeWarmupTable}>
              <thead>
                <tr>
                  <th>{t('config_management.visual.sections.quota.claude_warmup.col_account')}</th>
                  <th>{t('config_management.visual.sections.quota.claude_warmup.col_result')}</th>
                  <th>{t('config_management.visual.sections.quota.claude_warmup.col_attempts')}</th>
                  <th>{t('config_management.visual.sections.quota.claude_warmup.col_detail')}</th>
                </tr>
              </thead>
              <tbody>
                {result.results.map((item) => (
                  <tr key={item.authId}>
                    <td title={item.authId}>{item.label || item.authId}</td>
                    <td className={item.success ? styles.claudeWarmupOk : styles.claudeWarmupFail}>
                      {item.success
                        ? t('config_management.visual.sections.quota.claude_warmup.result_ok')
                        : t('config_management.visual.sections.quota.claude_warmup.result_failed')}
                    </td>
                    <td>{item.attempts}</td>
                    <td className={styles.claudeWarmupDetail}>
                      {item.success
                        ? ''
                        : [item.httpStatus ? `HTTP ${item.httpStatus}` : '', item.error]
                            .filter(Boolean)
                            .join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  );
}
