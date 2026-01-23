import { useTranslation } from 'react-i18next';
import styles from './StatusBadge.module.scss';

export type AuthStatus = 'active' | 'pending' | 'refreshing' | 'error' | 'disabled' | 'unknown' | 'exhausted' | 'never_recover';

interface StatusBadgeProps {
  status?: AuthStatus | string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { t } = useTranslation();

  if (!status) {
    return null;
  }

  const normalizedStatus = normalizeStatus(status);
  const statusClass = getStatusClass(normalizedStatus);
  const label = t(`auth_status.${normalizedStatus}`, { defaultValue: status });

  return (
    <span className={`${styles.badge} ${statusClass} ${className || ''}`}>
      {label}
    </span>
  );
}

function normalizeStatus(status: string): AuthStatus {
  const lower = status.toLowerCase();
  if (lower === 'active') return 'active';
  if (lower === 'pending') return 'pending';
  if (lower === 'refreshing') return 'refreshing';
  if (lower === 'error') return 'error';
  if (lower === 'disabled') return 'disabled';
  if (lower === 'exhausted') return 'exhausted';
  if (lower === 'never_recover') return 'never_recover';
  return 'unknown';
}

function getStatusClass(status: AuthStatus): string {
  switch (status) {
    case 'active':
      return styles.statusActive;
    case 'pending':
      return styles.statusPending;
    case 'refreshing':
      return styles.statusRefreshing;
    case 'error':
      return styles.statusError;
    case 'disabled':
      return styles.statusDisabled;
    case 'exhausted':
      return styles.statusExhausted;
    case 'never_recover':
      return styles.statusNeverRecover;
    default:
      return styles.statusUnknown;
  }
}

export default StatusBadge;
