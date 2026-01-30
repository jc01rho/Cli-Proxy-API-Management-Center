import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
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
  const [oauthState, setOauthState] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [callbackUrl, setCallbackUrl] = useState('');
  const [callbackSubmitting, setCallbackSubmitting] = useState(false);
  const [callbackStatus, setCallbackStatus] = useState<'success' | 'error' | null>(null);
  const [callbackError, setCallbackError] = useState<string | null>(null);
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

  /**
   * Extract the actual callback URL from user input.
   * If the URL contains auth_callback_url parameter (Trae authorization page URL),
   * extract and decode that value. Otherwise, use the URL as-is.
   */
  const extractCallbackUrl = (inputUrl: string): string => {
    try {
      const parsed = new URL(inputUrl);
      const authCallbackUrl = parsed.searchParams.get('auth_callback_url');
      if (authCallbackUrl) {
        // User pasted the Trae authorization page URL, extract the actual callback URL
        return authCallbackUrl;
      }
      // User pasted the actual callback URL directly
      return inputUrl;
    } catch {
      // Not a valid URL, return as-is
      return inputUrl;
    }
  };

  const handleSubmitCallback = async () => {
    const rawUrl = callbackUrl.trim();
    if (!rawUrl) {
      showNotification(t('auth_login.oauth_callback_required', { defaultValue: 'Please enter the callback URL' }), 'warning');
      return;
    }
    
    // Extract actual callback URL if user pasted authorization page URL
    const url = extractCallbackUrl(rawUrl);
    
    setCallbackSubmitting(true);
    setCallbackStatus(null);
    setCallbackError(null);
    try {
      await oauthApi.submitCallback('trae', url, oauthState || undefined);
      setCallbackStatus('success');
      showNotification(t('auth_login.oauth_callback_success', { defaultValue: 'Callback submitted successfully' }), 'success');
    } catch (err: any) {
      setCallbackStatus('error');
      setCallbackError(err?.message || 'Unknown error');
      showNotification(`${t('auth_login.oauth_callback_error', { defaultValue: 'Callback failed' })}: ${err?.message || ''}`, 'error');
    } finally {
      setCallbackSubmitting(false);
    }
  };

  const handleLogin = async () => {
    setIsLoginInProgress(true);
    setAuthUrl(null);
    setOauthState(null);
    try {
      const res = await oauthApi.startAuth('trae');
      setAuthUrl(res.url);
      if (res.state) {
        setOauthState(res.state);
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
        <>
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

          <div className={styles.callbackSection}>
            <div className={styles.callbackLabel}>
              {t('auth_login.oauth_callback_label', { defaultValue: 'Paste the redirected URL after login:' })}
            </div>
            <Input
              className={styles.callbackInput}
              value={callbackUrl}
              onChange={(e) => {
                setCallbackUrl(e.target.value);
                setCallbackStatus(null);
                setCallbackError(null);
              }}
              placeholder={t('auth_login.oauth_callback_placeholder', { defaultValue: 'https://...' })}
            />
            <div className={styles.callbackHint}>
              {t('auth_login.oauth_callback_hint', { defaultValue: 'Copy the full URL from your browser after completing authentication' })}
            </div>
            <div className={styles.callbackActions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSubmitCallback}
                loading={callbackSubmitting}
              >
                {t('auth_login.oauth_callback_button', { defaultValue: 'Submit Callback' })}
              </Button>
            </div>
            {callbackStatus === 'success' && (
              <div className="status-badge success" style={{ marginTop: 8 }}>
                {t('auth_login.oauth_callback_status_success', { defaultValue: 'Callback submitted successfully!' })}
              </div>
            )}
            {callbackStatus === 'error' && (
              <div className="status-badge error" style={{ marginTop: 8 }}>
                {t('auth_login.oauth_callback_status_error', { defaultValue: 'Callback failed:' })} {callbackError || ''}
              </div>
            )}
          </div>
        </>
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
