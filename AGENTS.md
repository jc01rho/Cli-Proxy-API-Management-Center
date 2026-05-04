# MANAGEMENT CENTER KNOWLEDGE BASE

**Generated:** 2026-05-04
**Commit:** 05e755d
**Branch:** main

## OVERVIEW

React 19 + Vite management UI for `CLIProxyAPIPlus` management endpoints. It builds a single-file bundle that is served as `management.html` by Plus.

## STRUCTURE

```text
Cli-Proxy-API-Management-Center/
├── src/main.tsx                  # React root
├── src/App.tsx                   # app shell
├── src/router/MainRoutes.tsx     # hash routes under management.html
├── src/pages/                    # route screens
├── src/services/api/             # management API client layer
├── src/stores/                   # Zustand state
├── src/components/providers/     # provider sections/lists/status
├── src/components/ui/            # base UI widgets
└── vite.config.ts                # vite-plugin-singlefile build
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Route registration | `src/router/MainRoutes.tsx` | New pages must be added here. |
| Provider list/edit | `src/pages/AiProvidersPage.tsx`, `src/pages/AiProviders*EditPage.tsx` | Keep section + route + store/API types aligned. |
| Backend calls | `src/services/api/` | No component-level raw management requests. |
| Global config state | `src/stores/useConfigStore.ts` | Config sections, loading, persistence. |
| Navigation shell | `src/components/layout/MainLayout.tsx`, `src/components/providers/ProviderNav/` | Provider nav and active item metadata. |
| Translations | `src/i18n/locales/*.json` | Add keys for every visible string. |

## CONVENTIONS

- Config keys mirror backend YAML, including kebab-case provider keys such as `openai-compatibility` and `ollama-api-key`.
- UI state updates go through Zustand actions; do not mutate store objects in components.
- `services/api/transformers.ts` absorbs backend naming differences before data reaches pages/stores.
- Provider UI changes usually require `types/config.ts`, `services/api/providers.ts`, `stores/useConfigStore.ts`, route/page, section, nav, and translations.

## ANTI-PATTERNS

- Do not call `/v0/management/*` directly from pages/components.
- Do not add private endpoints or real keys to placeholders, translations, fixtures, or the bundle.
- Do not reintroduce removed Trae provider UX.
- Do not use `as any` to bypass config/provider type mismatches.

## COMMANDS

```bash
npm run type-check
npm run build
npm run lint
```

## NOTES

- Release workflow renames `dist/index.html` to `management.html` for GitHub Releases.
- Local embedding requires copying built `dist/index.html` into `CLIProxyAPIPlus/management.html`.

## SUB-DOCUMENTS

```text
src/pages/AGENTS.md
src/services/api/AGENTS.md
src/stores/AGENTS.md
src/components/providers/AGENTS.md
src/components/ui/AGENTS.md
```
