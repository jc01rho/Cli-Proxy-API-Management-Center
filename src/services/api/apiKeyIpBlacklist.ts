import { apiClient } from './client';
import type { APIKeyBlacklistEntry } from '@/types/visualConfig';

type APIKeyIpBlacklistResponse = {
  'blocked-ips'?: BlockedIpWireEntry[];
};

type BlockedIpWireEntry = {
  ip?: string;
  'failure-count'?: number;
  'last-failure-at'?: string;
  'blocked-until'?: string;
  'remaining-block-seconds'?: number;
};

function normalizeBlockedIpEntry(raw: BlockedIpWireEntry | undefined): APIKeyBlacklistEntry | null {
  if (!raw || typeof raw.ip !== 'string' || !raw.ip.trim()) return null;
  return {
    ip: raw.ip,
    failureCount: Number(raw['failure-count'] ?? 0) || 0,
    lastFailureAt: typeof raw['last-failure-at'] === 'string' ? raw['last-failure-at'] : undefined,
    blockedUntil: typeof raw['blocked-until'] === 'string' ? raw['blocked-until'] : undefined,
    remainingBlockSeconds: Number(raw['remaining-block-seconds'] ?? 0) || 0,
  };
}

export const apiKeyIpBlacklistApi = {
  async listBlockedIps(): Promise<APIKeyBlacklistEntry[]> {
    const response = await apiClient.get<APIKeyIpBlacklistResponse>('/api-key-ip-blacklist');
    return (response['blocked-ips'] ?? [])
      .map((entry) => normalizeBlockedIpEntry(entry))
      .filter(Boolean) as APIKeyBlacklistEntry[];
  },

  async ban(ip: string): Promise<void> {
    await apiClient.post('/api-key-ip-blacklist', { ip });
  },

  async unban(ip: string): Promise<void> {
    await apiClient.delete(`/api-key-ip-blacklist?ip=${encodeURIComponent(ip)}`);
  },
};
