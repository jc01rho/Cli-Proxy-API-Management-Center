# Learnings from Task

## React Components

- Implemented `FallbackModelsEditor` for `Record<string, string>` editing.
  - Used `Object.entries` and `Object.fromEntries` to handle key-value pairs.
  - Handled key updates by creating new entries array.
  - **Gotcha**: `Object.fromEntries` with duplicate keys keeps the last one. Accepted this behavior for simple config editing.

## Config Management

- Updated `VisualConfigValues` type and `useVisualConfig` hook.
- Added `routingMode`, `fallbackModels`, `fallbackChain` fields.
- Mapped YAML structure:
  - `routing.mode` -> `routingMode`
  - `fallback.models` -> `fallbackModels`
  - `fallback.chain` -> `fallbackChain`

## i18n

- Added missing keys to `en.json` and `zh-CN.json` under `config_management.visual.sections`.
- Verified key usage in `VisualConfigEditor`.
