/**
 * 认证文件相关类型
 * 基于原项目 src/modules/auth-files.js
 */

export type AuthFileType =
  | 'qwen'
  | 'gemini'
  | 'gemini-cli'
  | 'aistudio'
  | 'claude'
  | 'codex'
  | 'antigravity'
  | 'iflow'
  | 'vertex'
  | 'empty'
  | 'unknown';

export interface LastError {
  code?: string;
  message: string;
  retryable: boolean;
  http_status?: number;
}

export interface QuotaState {
  exceeded: boolean;
  reason?: string;
  next_recover_at?: string;
  backoff_level?: number;
}

export interface AuthFileItem {
  name: string;
  type?: AuthFileType | string;
  provider?: string;
  size?: number;
  authIndex?: string | number | null;
  runtimeOnly?: boolean | string;
  disabled?: boolean;
  modified?: number;

  // Key status fields
  status?: 'active' | 'pending' | 'refreshing' | 'error' | 'disabled' | 'unknown';
  status_message?: string;
  unavailable?: boolean;
  quota_exceeded?: boolean;
  quota_reason?: string;
  quota_next_recover_at?: string;
  quota_backoff_level?: number;
  blocked_models?: string[];

  quota?: QuotaState;
  last_error?: LastError | null;
  next_retry_after?: string;

  // Antigravity tier info
  tier?: 'pro' | 'free' | 'ultra' | string;
  tier_name?: string;

  [key: string]: any;
}

export interface AuthFilesResponse {
  files: AuthFileItem[];
  total?: number;
}
