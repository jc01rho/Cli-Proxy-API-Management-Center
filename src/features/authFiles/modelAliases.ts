import type { OAuthModelAliasEntry } from '@/types';
import { serializeOauthModelAliases } from '@/services/api/authFiles';

/**
 * Per-auth model alias helpers for the credential details sheet.
 *
 * These are pure functions so the client-side validation and the raw-JSON
 * read/apply round-trip can be unit-tested without a DOM renderer. The editor
 * hook and the sheet component both consume them.
 */

export type ModelAliasValidationErrorKey =
  | 'auth_file_details.model_aliases.error_empty_name'
  | 'auth_file_details.model_aliases.error_empty_alias'
  | 'auth_file_details.model_aliases.error_name_equals_alias'
  | 'auth_file_details.model_aliases.error_duplicate_alias';

/**
 * Validates a list of alias rows. Returns the first offending i18n key, or
 * null when every row is valid. Mirrors the backend PATCH validation so the
 * UI never sends a payload the server would reject with 400.
 */
export const validateModelAliasRows = (
  rows: OAuthModelAliasEntry[]
): ModelAliasValidationErrorKey | null => {
  const seenAliases = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    const alias = row.alias.trim();
    if (!name) return 'auth_file_details.model_aliases.error_empty_name';
    if (!alias) return 'auth_file_details.model_aliases.error_empty_alias';
    if (name.toLowerCase() === alias.toLowerCase()) {
      return 'auth_file_details.model_aliases.error_name_equals_alias';
    }
    const aliasKey = alias.toLowerCase();
    if (seenAliases.has(aliasKey)) {
      return 'auth_file_details.model_aliases.error_duplicate_alias';
    }
    seenAliases.add(aliasKey);
  }
  return null;
};

/**
 * Reads the per-auth model_aliases array from a raw auth-file JSON record,
 * falling back to the legacy "model-aliases" key. Rows with an empty name or
 * alias are dropped (they cannot be represented as a valid alias entry).
 */
export const readModelAliases = (value: Record<string, unknown>): OAuthModelAliasEntry[] => {
  const raw = value.model_aliases ?? value['model-aliases'];
  if (!Array.isArray(raw)) return [];
  const result: OAuthModelAliasEntry[] = [];
  raw.forEach((item) => {
    if (!item || typeof item !== 'object') return;
    const entry = item as Record<string, unknown>;
    const name = String(entry.name ?? '').trim();
    const alias = String(entry.alias ?? '').trim();
    if (!name || !alias) return;
    const normalized: OAuthModelAliasEntry = { name, alias };
    if (entry.fork === true) normalized.fork = true;
    if (typeof entry['force-mapping'] === 'boolean') {
      normalized.forceMapping = entry['force-mapping'];
    }
    result.push(normalized);
  });
  return result;
};

/**
 * Applies a model_aliases array onto a raw auth-file JSON record, writing the
 * canonical "model_aliases" key and removing the legacy "model-aliases" key.
 * An empty array removes the key entirely.
 */
export const applyModelAliases = (
  value: Record<string, unknown>,
  aliases: OAuthModelAliasEntry[]
): Record<string, unknown> => {
  const next = { ...value };
  delete next['model-aliases'];
  if (aliases.length === 0) {
    delete next.model_aliases;
  } else {
    next.model_aliases = serializeOauthModelAliases(aliases);
  }
  return next;
};
