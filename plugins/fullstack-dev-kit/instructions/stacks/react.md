# React — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for React projects. The repo's `CLAUDE.md` wins. Shares the JS/TS toolchain — see [`node`](./node.md) for package-manager/lint details.

## Detect
`react` / `react-dom` in `package.json`. Bundler/meta-framework: Vite (`vite.config.*`), Next.js (`next.config.*`), or legacy CRA (`react-scripts` — end-of-life).

## Commands
- Install: `npm ci`
- Lint: `npm run lint` (ESLint); types: `tsc --noEmit`
- Unit tests: `npm test`
- Tests with coverage:
  - Vitest (Vite / new projects): `npx vitest run --coverage`
  - Jest (existing suites): `npx jest --coverage`
  - Next.js: match the configured runner.

## Coverage
- Report: `coverage/lcov.info` (parse per-file line/branch/function). Vitest `v8`/`istanbul` or Jest istanbul — enable the `lcov` reporter.
- New projects → **Vitest** (default in 2026); existing Jest is fine. CRA is EOL — migrate off it.

## E2E
- **Playwright** (`npx playwright test`) or **Cypress**. Next.js: same.

## Conventions & gotchas
- **`@testing-library/react`** — query by role/label/visible text; test behaviour, not internals. **MSW** for network mocking.
- No Enzyme / no asserting on implementation details in new code.

## Docs
React Testing Library: <https://testing-library.com/docs/react-testing-library/intro> · Vitest coverage: <https://vitest.dev/guide/coverage>
