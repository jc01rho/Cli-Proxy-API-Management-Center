# PAGES

> Parent: [../../AGENTS.md](../../AGENTS.md)

## OVERVIEW

`src/pages/` contains route-level screens. Provider edit pages are the largest family and must stay aligned with `MainRoutes.tsx` and provider sections.

## STRUCTURE

```text
pages/
├── DashboardPage.tsx
├── AiProvidersPage.tsx
├── AiProviders*EditPage.tsx / AiProviders*ModelsPage.tsx
├── AuthFilesPage.tsx
├── AuthFilesOAuthExcludedEditPage.tsx
├── AuthFilesOAuthModelAliasEditPage.tsx
├── OAuthPage.tsx
├── ConfigPage.tsx / LogsPage.tsx / QuotaPage.tsx / SystemPage.tsx
├── LoginPage.tsx
├── Login/
└── hooks/
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| AI providers overview | `AiProvidersPage.tsx` | Section state, enable/delete, list refresh. |
| Provider edit flows | `AiProviders*EditPage.tsx`, `AiProviders*EditLayout.tsx` | Route-specific config editing. |
| Auth file management | `AuthFilesPage.tsx` | Large hotspot; prefer extraction for new complexity. |
| OAuth/device flows | `OAuthPage.tsx`, `hooks/` | Polling and cleanup matter. |
| Login UX | `LoginPage.tsx`, `Login/` | Auth store/session contract. |

## CONVENTIONS

- Every new page route needs `MainRoutes.tsx`, labels/translations, and navigation metadata if user-visible.
- Pages compose `services/api` + stores; they do not own backend path construction.
- Provider edit pages should preserve draft state and model list refresh behavior.

## ANTI-PATTERNS

- Do not grow `AuthFilesPage.tsx` or provider edit pages with unrelated feature logic.
- Do not suppress hook dependency warnings for polling/async effects.
- Do not manually mutate Zustand store state from page code.
