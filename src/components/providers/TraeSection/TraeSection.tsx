import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconBot } from '@/components/ui/icons';
import { useNotificationStore } from '@/stores';
import { authFilesApi, oauthApi } from '@/services/api';
import type { AuthFileItem } from '@/types';
import styles from './TraeSection.module.css';
import { ProviderList } from '../ProviderList';

interface TraeSectionProps {
  disableControls?: boolean;
}

export function TraeSection({ disableControls }: TraeSectionProps) {
  const { t } = useTranslation();
  const { showNotification, showConfirmation } = useNotificationStore();
  const [configs, setConfigs] = useState<AuthFileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoginInProgress, setIsLoginInProgress] = useState(false);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const pollingTimer = useRef<number | null>(null);

  const actionsDisabled = disableControls || loading || isLoginInProgress;

  const loadTraeConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFilesApi.list();
      const traeFiles = res.files.filter((f) => f.provider === 'trae' || f.type === 'trae');
      setConfigs(traeFiles);
    } catch (err: any) {
      console.error('Failed to load Trae configs', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTraeConfigs();
    return () => {
      if (pollingTimer.current) window.clearInterval(pollingTimer.current);
    };
  }, [loadTraeConfigs]);

  const startPolling = (state: string) => {
    if (pollingTimer.current) window.clearInterval(pollingTimer.current);
    
    pollingTimer.current = window.setInterval(async () => {
      try {
        const res = await oauthApi.getAuthStatus(state);
        if (res.status === 'ok') {
          showNotification(t('providers.trae.status_success', { defaultValue: 'Authentication successful!' }), 'success');
          setIsLoginInProgress(false);
          setAuthUrl(null);
          if (pollingTimer.current) window.clearInterval(pollingTimer.current);
          loadTraeConfigs();
        } else if (res.status === 'error') {
          showNotification(`${t('providers.trae.status_error', { defaultValue: 'Authentication failed:' })} ${res.error || ''}`, 'error');
          setIsLoginInProgress(false);
          if (pollingTimer.current) window.clearInterval(pollingTimer.current);
        }
      } catch (err: any) {
        console.error('Polling failed', err);
      }
    }, 3000);
  };

  const handleLogin = async () => {
    setIsLoginInProgress(true);
    setAuthUrl(null);
    try {
      const res = await oauthApi.startAuth('trae');
      setAuthUrl(res.url);
      if (res.state) {
        startPolling(res.state);
      }
    } catch (err: any) {
      showNotification(`${t('providers.trae.errors.login_failed', { defaultValue: 'Login failed' })}: ${err.message}`, 'error');
      setIsLoginInProgress(false);
    }
  };

  const handleDelete = async (index: number) => {
    const item = configs[index];
    if (!item) return;

    showConfirmation({
      title: t('common.delete'),
      message: t('auth_files.delete_confirm') + ` "${item.name}"?`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          await authFilesApi.deleteFile(item.name);
          showNotification(t('auth_files.delete_success'), 'success');
          loadTraeConfigs();
        } catch (err: any) {
          showNotification(t('notification.delete_failed'), 'error');
        }
      },
    });
  };

  const copyLink = async () => {
    if (!authUrl) return;
    try {
      await navigator.clipboard.writeText(authUrl);
      showNotification(t('notification.link_copied'), 'success');
    } catch {
      showNotification('Copy failed', 'error');
    }
  };

  return (
    <Card
      title={
        <span className={styles.cardTitle}>
          <IconBot className={styles.cardTitleIcon} />
          {t('providers.trae.title')}
        </span>
      }
      extra={
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="sm" variant="secondary" onClick={loadTraeConfigs} disabled={loading || disableControls}>
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={handleLogin} loading={isLoginInProgress} disabled={disableControls}>
            {t('providers.trae.login')}
          </Button>
        </div>
      }
    >
      <div className="hint" style={{ marginBottom: 16 }}>{t('providers.trae.description')}</div>

      {authUrl && (
        <div className={styles.authUrlBox}>
          <div className={styles.authUrlLabel}>{t('providers.trae.url_label', { defaultValue: 'Authorization URL:' })}</div>
          <div className={styles.authUrlValue}>{authUrl}</div>
          <div className={styles.authUrlActions}>
            <Button variant="secondary" size="sm" onClick={copyLink}>
              {t('providers.trae.copy_link', { defaultValue: 'Copy Link' })}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.open(authUrl, '_blank', 'noopener,noreferrer')}
            >
              {t('providers.trae.open_link', { defaultValue: 'Open Link' })}
            </Button>
          </div>
        </div>
      )}

      <ProviderList<AuthFileItem>
        items={configs}
        loading={loading}
        actionsDisabled={actionsDisabled}
        keyField={(item) => item.name}
        emptyTitle={t('providers.trae.empty_title', { defaultValue: 'No Trae Auth Files' })}
        emptyDescription={t('providers.trae.empty_desc', { defaultValue: 'Login to start using Trae provider.' })}
        onDelete={handleDelete}
        renderContent={(item) => (
          <Fragment>
            <div className="item-title">{t('providers.trae.item_title', { defaultValue: 'Trae Account' })}</div>
            <div className={styles.fieldRow}>
              <span className={styles.fieldLabel}>{t('providers.trae.account.label')}:</span>
              <span className={styles.fieldValue}>{item.email || (item.metadata as any)?.email || item.name}</span>
            </div>
            {item.status && (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t('common.status')}:</span>
                <span className={`status-badge ${item.status === 'active' ? 'success' : 'warning'}`}>
                  {t(`auth_status.${item.status}`)}
                </span>
              </div>
            )}
            {(item.last_refresh || item.updated_at || item.modtime) && (
              <div className={styles.fieldRow}>
                <span className={styles.fieldLabel}>{t('auth_files.file_modified')}:</span>
                <span className={styles.fieldValue}>{new Date(item.last_refresh || item.updated_at || item.modtime).toLocaleString()}</span>
              </div>
            )}
            {item.expires_at && (
               <div className={styles.fieldRow}>
               <span className={styles.fieldLabel}>Expires:</span>
               <span className={styles.fieldValue}>{new Date(item.expires_at).toLocaleString()}</span>
             </div>
            )}
          </Fragment>
        )}
      />
    </Card>
  );
}
