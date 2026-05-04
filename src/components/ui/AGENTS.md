# UI COMPONENTS

> Parent: [../../../AGENTS.md](../../../AGENTS.md)

## OVERVIEW

`src/components/ui/` contains shared primitives and reusable form/list helpers used by pages and provider sections.

## STRUCTURE

```text
ui/
├── Button.tsx / Card.tsx / Input.tsx / Modal.tsx / Select.tsx
├── ToggleSwitch.tsx / SelectionCheckbox.tsx
├── EmptyState.tsx / LoadingSpinner.tsx
├── HeaderInputList.tsx / ModelInputList.tsx / modelInputListUtils.ts
├── icons.tsx
└── *.module.scss
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Base control | `{Name}.tsx` + `{Name}.module.scss` | Keep CSS Modules pattern. |
| Model/header form lists | `ModelInputList.tsx`, `HeaderInputList.tsx` | Shared config editing widgets. |
| Empty/loading states | `EmptyState.tsx`, `LoadingSpinner.tsx` | Use before local one-off states. |
| Icons | `icons.tsx` | Inline SVG set. |

## CONVENTIONS

- Use CSS Modules plus existing CSS variables.
- Extract repeated form/list behavior here only when used across screens.
- Props should be typed at the component boundary; no `as any` escapes.

## ANTI-PATTERNS

- Do not add hardcoded colors that bypass theme variables.
- Do not create 500+ line primitive components; split helpers.
- Do not use inline styles for reusable layout rules.
