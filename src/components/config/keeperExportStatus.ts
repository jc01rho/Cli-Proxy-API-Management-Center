import type { UsageExportState, UsageExportStatusResponse } from '@/types/keeperExport';

export type KeeperExportStatusTone = {
  readonly kind: 'success' | 'warning' | 'error' | 'muted';
  readonly icon: 'check' | 'retry' | 'alert' | 'minus';
};

export function getKeeperExportStatusTone(state: UsageExportState): KeeperExportStatusTone {
  switch (state) {
    case 'connected':
      return { kind: 'success', icon: 'check' };
    case 'retrying':
      return { kind: 'warning', icon: 'retry' };
    case 'blocked':
    case 'degraded':
      return { kind: 'error', icon: 'alert' };
    case 'disabled':
    case 'starting':
      return { kind: 'muted', icon: 'minus' };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

export type KeeperStatusFetchState = {
  readonly requestId: number;
  readonly status: UsageExportStatusResponse | null;
};

export function beginKeeperStatusRequest(state: KeeperStatusFetchState): {
  readonly requestId: number;
  readonly state: KeeperStatusFetchState;
} {
  const requestId = state.requestId + 1;
  return { requestId, state: { requestId, status: null } };
}

export function finishKeeperStatusRequest(
  state: KeeperStatusFetchState,
  requestId: number,
  status: UsageExportStatusResponse | null
): KeeperStatusFetchState {
  if (requestId !== state.requestId) return state;
  return { requestId, status };
}
