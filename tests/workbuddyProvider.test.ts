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

describe('WorkBuddy provider recognition', () => {
  test('registers WorkBuddy auth files for OAuth selection and manual refresh', () => {
    const type: AuthFileType = 'workbuddy';
    const file: AuthFileItem = { name: 'workbuddy-user.json', type };

    expect(file.type).toBe('workbuddy');
    expect(OAUTH_PROVIDER_PRESETS).toContain('workbuddy');
    // WorkBuddy exposes the same refresh endpoint family as CodeBuddy, so the file
    // card must offer manual refresh instead of hiding it.
    expect(supportsAuthFileManualRefresh('workbuddy')).toBe(true);
  });

  test('provides an icon, quota colors, and a proper display label', () => {
    expect(getAuthFileIcon('workbuddy', 'light')).toBeTruthy();
    expect(getAuthFileIcon('workbuddy', 'dark')).toBeTruthy();
    expect(TYPE_COLORS.workbuddy.light).toBeDefined();
    expect(TYPE_COLORS.workbuddy.dark).toBeDefined();
    expect(providerLabel('workbuddy', 'Unknown')).toBe('WorkBuddy');
  });

  test('preserves WorkBuddy credential identity fields during normalization', () => {
    const credential = {
      name: 'workbuddy-user.json',
      type: 'workbuddy',
      access_token: 'redacted-access-token',
      refresh_token: 'redacted-refresh-token',
      domain: 'www.workbuddy.ai',
      realm: 'global',
      uid: 'redacted-uid',
      enterprise_id: 'redacted-enterprise',
      nickname: 'redacted-nickname',
    };

    const [normalized] = normalizeAuthFilesResponse({ files: [credential] }, 1).files;

    expect(normalized).toMatchObject(credential);
  });
});
