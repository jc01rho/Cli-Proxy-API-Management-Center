import { describe, expect, test } from 'bun:test';
import {
  getAuthFileIcon,
  OAUTH_PROVIDER_PRESETS,
  supportsAuthFileManualRefresh,
} from '@/features/authFiles/constants';
import { providerLabel } from '@/features/dashboard/utils';
import { normalizeAuthFilesResponse } from '@/services/api/authFiles';
import type { AuthFileItem, AuthFileType } from '@/types/authFile';
import { TYPE_COLORS } from '@/utils/quota/constants';

describe('CodeBuddy provider recognition', () => {
  test('registers CodeBuddy auth files for OAuth selection and manual refresh', () => {
    const type: AuthFileType = 'codebuddy';
    const file: AuthFileItem = { name: 'codebuddy-user.json', type };

    expect(file.type).toBe('codebuddy');
    expect(OAUTH_PROVIDER_PRESETS).toContain('codebuddy');
    // CodeBuddy uses the same token refresh endpoint family as WorkBuddy.
    expect(supportsAuthFileManualRefresh('codebuddy')).toBe(true);
  });

  test('provides an icon, quota colors, and a proper display label', () => {
    expect(getAuthFileIcon('codebuddy', 'light')).toBeTruthy();
    expect(getAuthFileIcon('codebuddy', 'dark')).toBeTruthy();
    expect(TYPE_COLORS.codebuddy.light).toBeDefined();
    expect(TYPE_COLORS.codebuddy.dark).toBeDefined();
    expect(providerLabel('codebuddy', 'Unknown')).toBe('CodeBuddy');
  });

  test('preserves CodeBuddy credential identity fields during normalization', () => {
    const credential = {
      name: 'codebuddy-user.json',
      type: 'codebuddy',
      access_token: 'redacted-access-token',
      refresh_token: 'redacted-refresh-token',
      domain: 'www.codebuddy.cn',
      realm: 'default',
      uid: 'redacted-uid',
      nickname: 'redacted-nickname',
    };

    const [normalized] = normalizeAuthFilesResponse({ files: [credential] }, 1).files;

    expect(normalized).toMatchObject(credential);
  });
});
