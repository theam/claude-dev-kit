# Angular — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Angular projects. The repo's `CLAUDE.md` and `angular.json` win. Shares the JS/TS toolchain — see [`node`](./node.md) for package-manager/lint details.

## Detect
`angular.json`. Runner (check the `test` builder in `angular.json`): **Vitest** (Angular v21+ default, `@angular/build:unit-test`), **Karma/Jasmine** (legacy, now deprecated), or **jest-preset-angular**.

## Commands
- Install: `npm ci`
- Lint: `ng lint` (ESLint); types: `tsc --noEmit`
- Unit tests: `ng test --no-watch`  (add `CI=true` so it exits — default `ng test` watches)
- Tests with coverage:
  - Vitest builder (v21+): `ng test --no-watch --coverage`
  - Legacy Karma: `ng test --no-watch --code-coverage`

## Coverage
- Report: `coverage/**/lcov.info` (parse per-file line/branch). Coverage is first-class in the CLI.
- **Check the builder first** — the flag differs (`--coverage` for Vitest vs `--code-coverage` for Karma). Karma is deprecated; new projects are on Vitest. Browser tests: `@vitest/browser-playwright` via `angular.json`.

## E2E
- Protractor is retired → **Playwright** or **Cypress**. `ng e2e` prompts to pick a runner.

## Conventions & gotchas
- Specs `*.spec.ts` beside the component; `TestBed` for component setup.
- `provideHttpClientTesting()` / harnesses over deep mocks.
- Always pass `--no-watch`/`CI=true` in automation, or the run hangs.

## Docs
Testing: <https://angular.dev/guide/testing> · Migrating to Vitest: <https://angular.dev/guide/testing/migrating-to-vitest>
