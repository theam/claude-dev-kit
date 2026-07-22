# PHP — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for PHP projects (Laravel, Symfony, or plain). The repo's `CLAUDE.md` and `composer.json` scripts win over this.

## Detect
`composer.json`. Tests: PHPUnit (`phpunit.xml[.dist]`) or Pest (`Pest.php`). Framework: Laravel (`artisan`) or Symfony (`bin/console`).

## Commands
- Install: `composer install`
- Static analysis: `vendor/bin/phpstan analyse` or `vendor/bin/psalm` (if configured)
- Style: `vendor/bin/php-cs-fixer fix --dry-run --diff` or `vendor/bin/phpcs`
- Unit tests: `vendor/bin/phpunit` · `vendor/bin/pest` · Laravel `php artisan test`
- Tests with coverage: `XDEBUG_MODE=coverage vendor/bin/phpunit --coverage-clover coverage.xml`
  (Pest: `vendor/bin/pest --coverage --coverage-clover coverage.xml`)

## Coverage
- **A coverage driver is required** or PHPUnit reports *no* coverage — detect its absence and say so rather than reporting 0%:
  - **PCOV** — line coverage only, 2–5× faster; best for CI.
  - **Xdebug 3** — line **and branch** coverage (needed for a branch gate); requires `XDEBUG_MODE=coverage`, much slower.
- Report: `coverage.xml` (**Clover**) — parse per-file line/branch from `<file>`/`<metrics>`. `--coverage-cobertura` is an alternative format.
- Scope covered files via `<source>` in `phpunit.xml` (best practice) to avoid vendor noise.

## E2E
- Laravel: feature tests (HTTP) + **Dusk** (browser). Symfony: **Panther**. Codeception is common project-wide. Decoupled SPA frontend: Playwright/Cypress in its own tree.

## Conventions & gotchas
- PSR-4; tests under `tests/` (`tests/Unit`, `tests/Feature`).
- Laravel: `RefreshDatabase`/transactions for isolation; factories over shared fixtures.
- If only PCOV is present, branch coverage isn't available — report line coverage and note it.

## Docs
PHPUnit coverage: <https://docs.phpunit.de/en/12.5/code-coverage.html> · Pest: <https://pestphp.com/docs/test-coverage>
