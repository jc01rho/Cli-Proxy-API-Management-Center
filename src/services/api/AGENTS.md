# API SERVICES

> Parent: [../../AGENTS.md](../../AGENTS.md)

## OVERVIEW

`src/services/api/` is the only browser-side management API layer. It owns Axios setup, endpoint names, request helpers, and response shape normalization.

## STRUCTURE

```text
api/
├── client.ts
├── apiCall.ts
├── authFiles.ts
├── config.ts / configFile.ts
├── providers.ts / apiKeys.ts / vertex.ts
├── oauth.ts / models.ts / usage.ts / logs.ts / version.ts
├── transformers.ts
└── index.ts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Base client/auth | `client.ts` | `/v0/management` prefix and unauthorized flow. |
| Provider config calls | `providers.ts`, `config.ts` | Keep provider key names in sync with YAML. |
| Auth file APIs | `authFiles.ts` | Encode file names. |
| External API proxy calls | `apiCall.ts`, `models.ts` | Used by model discovery UI. |
| Shape normalization | `transformers.ts` | Backend snake/kebab/camel differences. |

## CONVENTIONS

- Encode route/path parameters with `encodeURIComponent()`.
- Keep response normalization here, not in pages/stores.
- 401 handling must preserve the global unauthorized event flow.
- New provider model-list helpers should use the management API proxy path rather than raw browser fetch.

## ANTI-PATTERNS

- Do not import Axios directly in components/pages.
- Do not reintroduce deprecated endpoint strings.
- Do not leak provider API keys into URLs or logs.
