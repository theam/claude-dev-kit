# Vue — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Vue 3 projects. The repo's `CLAUDE.md` wins. Shares the JS/TS toolchain — see [`node`](./node.md) for package-manager/lint details.

## Detect
`vue` in `package.json` (+ `@vitejs/plugin-vue` / `vite.config.*`, or `vue.config.js` for legacy Vue CLI). `create-vue` scaffolds Vitest + an e2e choice.

## Commands
- Install: `npm ci`
- Lint: `npm run lint` (ESLint); types: `vue-tsc --noEmit`  (not plain `tsc` — needs template type-checking)
- Unit tests: `npm run test:unit`  (Vitest)
- Tests with coverage: `npx vitest run --coverage`

## Coverage
- Report: `coverage/lcov.info` (parse per-file line/branch/function). Vitest `v8`/`istanbul` provider — enable the `lcov` reporter.

## E2E
- **Playwright** or **Cypress** (`create-vue` offers both, plus Nightwatch). Component tests: `@vue/test-utils` in jsdom (fast) or Playwright/Vitest browser mode (real browser).

## Conventions & gotchas
- **`@vue/test-utils`** is the official unit helper (`mount`/`shallowMount`); query by role/text.
- Vitest is Vite-native — it reuses the project's Vite config/plugins, so setup is minimal.

## Docs
Vue testing: <https://vuejs.org/guide/scaling-up/testing> · Vue Test Utils: <https://test-utils.vuejs.org>
