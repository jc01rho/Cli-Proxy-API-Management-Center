import type { OAuthModelAliasEntry } from '@/types';
import { generateId } from '@/utils/helpers';

export type ModelAliasRow = OAuthModelAliasEntry & { id: string };

export const buildEmptyRow = (id = generateId()): ModelAliasRow => ({
  id,
  name: '',
  alias: '',
  fork: true,
});

export const toRows = (
  entries: OAuthModelAliasEntry[],
  previousRows: ModelAliasRow[] = []
): ModelAliasRow[] =>
  entries.length === 0
    ? [buildEmptyRow(previousRows[0]?.id)]
    : entries.map((entry, index) => ({
        id: previousRows[index]?.id ?? generateId(),
        name: entry.name ?? '',
        alias: entry.alias ?? '',
        fork: Boolean(entry.fork),
        forceMapping: entry.forceMapping,
      }));
