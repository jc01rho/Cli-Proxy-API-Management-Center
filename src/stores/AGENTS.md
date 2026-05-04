# ZUSTAND STORES

> Parent: [../../AGENTS.md](../../AGENTS.md)

## OVERVIEW

`src/stores/` owns global UI state for auth/session, config, quota/models, language/theme, notifications, edit drafts, and usage stats.

## STRUCTURE

```text
stores/
├── index.ts
├── useAuthStore.ts
├── useConfigStore.ts
├── useModelsStore.ts
├── useQuotaStore.ts
├── useNotificationStore.ts
├── useLanguageStore.ts
├── useThemeStore.ts
├── useClaudeEditDraftStore.ts
├── useOpenAIEditDraftStore.ts
└── useUsageStatsStore.ts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Session/auth | `useAuthStore.ts` | secureStorage and unauthorized flow. |
| Config load/save | `useConfigStore.ts` | Provider sections and update actions. |
| Models/quota | `useModelsStore.ts`, `useQuotaStore.ts` | Refresh state and errors. |
| Edit drafts | `useClaudeEditDraftStore.ts`, `useOpenAIEditDraftStore.ts` | Preserve unsaved form state. |
| Usage stats | `useUsageStatsStore.ts` | Legacy/management usage screen state. |

## CONVENTIONS

- All state changes go through store actions.
- Sensitive persisted values use `secureStorage`; avoid raw `localStorage`.
- Prefer selector-based subscription over whole-store reads in frequently rendering components.
- Adding a provider config section requires store defaults, fetch normalization, and reset/update handling.

## ANTI-PATTERNS

- No direct state mutation from components.
- No plaintext sensitive values in browser persistence.
- No circular store dependencies for convenience.
