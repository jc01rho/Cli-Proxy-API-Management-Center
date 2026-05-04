# PROVIDER COMPONENTS

> Parent: [../../../AGENTS.md](../../../AGENTS.md)

## OVERVIEW

`src/components/providers/` renders provider cards, status bars, lists, and provider-specific sections used by `AiProvidersPage` and edit layouts.

## STRUCTURE

```text
providers/
├── AmpcodeSection/
├── ClaudeSection/
├── CodexSection/        # also parameterized for Codex-like API-key providers
├── GeminiSection/
├── OpenAISection/
├── VertexSection/
├── ProviderNav/
├── ProviderList.tsx
├── ProviderStatusBar.tsx
├── hooks/
└── types.ts / utils.ts
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| New provider section | `{Provider}Section/` or parameterized existing section | Keep page/store/API route in sync. |
| Provider list rendering | `ProviderList.tsx` | Generic items, delete/enable actions. |
| Status display | `ProviderStatusBar.tsx` | Credential health/availability. |
| Provider navigation | `ProviderNav/` | Edit-page nav metadata. |
| Polling hooks | `hooks/` | Cleanup timers. |

## CONVENTIONS

- Section component + export + `AiProvidersPage` wiring are one unit.
- Reuse `ProviderList` and `ProviderStatusBar` before adding bespoke cards.
- Provider-visible text must go through i18n locale files.

## ANTI-PATTERNS

- Do not copy provider common UI into each Section.
- Do not reintroduce Trae UI flows.
- Do not leave timers/intervals without cleanup.
