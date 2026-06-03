/**
 * 配置相关 API
 */

import { apiClient } from './client';
import type { Config } from '@/types';
import { normalizeConfigResponse } from './transformers';

export const configApi = {
  /**
   * 获取配置（会进行字段规范化）
   */
  async getConfig(): Promise<Config> {
    const raw = await apiClient.get('/config');
    return normalizeConfigResponse(raw);
  },

  /**
   * 获取原始配置（不做转换）
   */
  getRawConfig: () => apiClient.get('/config'),

  /**
   * 更新 Debug 模式
   */
  updateDebug: (enabled: boolean) => apiClient.put('/debug', { value: enabled }),

  /**
   * 更新代理 URL
   */
  updateProxyUrl: (proxyUrl: string) => apiClient.put('/proxy-url', { value: proxyUrl }),

  /**
   * 清除代理 URL
   */
  clearProxyUrl: () => apiClient.delete('/proxy-url'),

  /**
   * 更新重试次数
   */
  updateRequestRetry: (retryCount: number) => apiClient.put('/request-retry', { value: retryCount }),

  /**
   * 配额回退：切换项目
   */
  updateSwitchProject: (enabled: boolean) =>
    apiClient.put('/quota-exceeded/switch-project', { value: enabled }),

  /**
   * 配额回退：切换预览模型
   */
  updateSwitchPreviewModel: (enabled: boolean) =>
    apiClient.put('/quota-exceeded/switch-preview-model', { value: enabled }),

  /**
   * 请求日志开关
   */
  updateRequestLog: (enabled: boolean) => apiClient.put('/request-log', { value: enabled }),

  /**
   * 成功请求 body 日志开关
   */
  updateRequestLogSuccessBody: (enabled: boolean) =>
    apiClient.put('/request-log-success-body', { value: enabled }),

  /**
   * 获取详细 API 错误 body 截断限制
   */
  async getDetailedAPIErrorBodyLogLimit(): Promise<number> {
    const data = await apiClient.get<Record<string, unknown>>('/detailed-api-error-body-log-limit');
    const value = data?.['detailed-api-error-body-log-limit'] ?? data?.detailedAPIErrorBodyLogLimit ?? 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  /**
   * 更新详细 API 错误 body 截断限制
   */
  updateDetailedAPIErrorBodyLogLimit: (value: number) =>
    apiClient.put('/detailed-api-error-body-log-limit', { value }),

  /**
   * 写日志到文件开关
   */
  updateLoggingToFile: (enabled: boolean) => apiClient.put('/logging-to-file', { value: enabled }),

  /**
   * 获取日志总大小上限（MB）
   */
  async getLogsMaxTotalSizeMb(): Promise<number> {
    const data = await apiClient.get<Record<string, unknown>>('/logs-max-total-size-mb');
    const value = data?.['logs-max-total-size-mb'] ?? 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  /**
   * 更新日志总大小上限（MB）
   */
  updateLogsMaxTotalSizeMb: (value: number) =>
    apiClient.put('/logs-max-total-size-mb', { value }),

  /**
   * WebSocket 鉴权开关
   */
  updateWsAuth: (enabled: boolean) => apiClient.put('/ws-auth', { value: enabled }),

  /**
   * 获取强制模型前缀开关
   */
  async getForceModelPrefix(): Promise<boolean> {
    const data = await apiClient.get<Record<string, unknown>>('/force-model-prefix');
    return Boolean(data?.['force-model-prefix'] ?? false);
  },

  /**
   * 更新强制模型前缀开关
   */
  updateForceModelPrefix: (enabled: boolean) => apiClient.put('/force-model-prefix', { value: enabled }),

  /**
   * 获取路由策略
   */
  async getRoutingStrategy(): Promise<string> {
    const data = await apiClient.get<Record<string, unknown>>('/routing/strategy');
    const strategy = data?.strategy;
    return typeof strategy === 'string' ? strategy : 'round-robin';
  },

  /**
   * 更新路由策略
   */
  updateRoutingStrategy: (strategy: string) => apiClient.put('/routing/strategy', { value: strategy }),

  getWeightRobinQueue: (model?: string) =>
    apiClient.get<WeightRobinQueueSnapshot>('/weight-robin-queue', {
      params: model ? { model } : undefined,
    }),
};

export interface WeightRobinQueueEntry {
  authId: string;
  name: string;
  provider: string;
  weight: number;
  position: number;
  inCycle: boolean;
  available: boolean;
  models?: string[];
}

export interface WeightRobinCycleEntry {
  authId: string;
  name: string;
  provider: string;
}

export interface WeightRobinQueueSnapshot {
  entries: WeightRobinQueueEntry[];
  cycle: WeightRobinCycleEntry[];
  currentIdx: number;
  totalWeight: number;
  cycleLength: number;
  lastPicked?: string;
}
