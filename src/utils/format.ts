/**
 * 格式化工具函数
 * 从原项目 src/utils/string.js 迁移
 */

/**
 * 隐藏 API Key 中间部分，仅保留前后两位
 */
export function maskApiKey(key: string): string {
  const trimmed = String(key || '').trim();
  if (!trimmed) {
    return '';
  }

  const MASKED_LENGTH = 10;
  const visibleChars = trimmed.length < 4 ? 1 : 2;
  const start = trimmed.slice(0, visibleChars);
  const end = trimmed.slice(-visibleChars);
  const maskedLength = Math.max(MASKED_LENGTH - visibleChars * 2, 1);
  const masked = '*'.repeat(maskedLength);

  return `${start}${masked}${end}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 格式化日期时间
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }

  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * 将 Unix 时间戳（秒/毫秒/微秒/纳秒）格式化为本地时间字符串
 */
export function formatUnixTimestamp(value: unknown, locale?: string): string {
  if (value === null || value === undefined || value === '') return '';

  const asNumber = typeof value === 'number' ? value : Number(value);
  const date = (() => {
    if (!Number.isFinite(asNumber) || Number.isNaN(asNumber)) {
      return new Date(String(value));
    }

    const abs = Math.abs(asNumber);

    // 秒：常见 10 位（~1e9）
    if (abs < 1e11) return new Date(asNumber * 1000);

    // 毫秒：常见 13 位（~1e12）
    if (abs < 1e14) return new Date(asNumber);

    // 微秒：常见 16 位（~1e15）
    if (abs < 1e17) return new Date(Math.round(asNumber / 1000));

    // 纳秒：常见 19 位（~1e18）
    return new Date(Math.round(asNumber / 1e6));
  })();

  if (Number.isNaN(date.getTime())) return '';
  return locale ? date.toLocaleString(locale) : date.toLocaleString();
}

/**
 * 格式化数字（添加千位分隔符）
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN');
}

/**
 * 截断长文本
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength) + '...';
}

/**
 * Format a future timestamp as relative time (e.g., "in 5 min", "in 2 hours")
 * Returns a translation key for past times or null values
 * @param dateString - ISO 8601 timestamp string
 * @param t - i18next translation function (optional)
 * @returns Formatted relative time string or translation key
 */
export function formatRelativeTime(
  dateString: string | null | undefined,
  t?: (key: string, options?: Record<string, unknown>) => string
): string {
  if (!dateString) {
    return '';
  }

  const targetDate = new Date(dateString);
  if (isNaN(targetDate.getTime())) {
    return '';
  }

  const now = Date.now();
  const diffMs = targetDate.getTime() - now;

  // Past time - return "resuming soon" translation key
  if (diffMs <= 0) {
    return t ? t('recover_time.resuming_soon') : 'Resuming soon';
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return t 
      ? t('recover_time.in_days', { count: diffDays })
      : `in ${diffDays}d`;
  }
  if (diffHours > 0) {
    return t 
      ? t('recover_time.in_hours', { count: diffHours })
      : `in ${diffHours}h`;
  }
  if (diffMinutes > 0) {
    return t 
      ? t('recover_time.in_minutes', { count: diffMinutes })
      : `in ${diffMinutes}m`;
  }
  return t 
    ? t('recover_time.in_seconds', { count: diffSeconds })
    : `in ${diffSeconds}s`;
}

/**
 * Format a timestamp as absolute datetime for tooltip display
 */
export function formatAbsoluteTime(dateString: string | null | undefined): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
}
