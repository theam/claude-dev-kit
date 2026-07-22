# PHP — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for PHP projects (Laravel, Symfony, or plain). The repo's `CLAUDE.md` and `composer.json` scripts win over this.

## Detect
`composer.json`. Tests: PHPUnit (`phpunit.xml`/`phpunit.xml.dist`) or Pest. Framework: Laravel (`artisan`) / Symfony (`bin/console`).

## Commands
- Install: `composer install`.
- Lint/static analysis: `vendor/bin/php-cs-fixer fix --dry-run` / `vendor/bin/phpcs`; `vendor/bin/phpstan analyse` or `vendor/bin/psalm` if configured.
- Unit tests: `vendor/bin/phpunit` (or `vendor/bin/pest`, or `php artisan test` on Laravel).
- Tests with coverage: `vendor/bin/phpunit --coverage-clover coverage.xml`
  - Pest: `vendor/bin/pest --coverage --coverage-clover coverage.xml`.

## Coverage
- Report: `coverage.xml` (**Clover** format). Parse per-file line/branch metrics from the `<file>` / `<metrics>` nodes.
- **Prerequisite:** coverage needs a driver — **Xdebug** (`XDEBUG_MODE=coverage`) or **PCOV** installed. Without it PHPUnit reports no coverage; detect this and say so rather than reporting 0%.

## E2E
- Laravel Dusk or Codeception for full-stack; Playwright/Cypress for a decoupled frontend; API flows via PHPUnit feature tests against the app.

## Conventions & gotchas
- PSR-4 layout; tests under `tests/` (`tests/Unit`, `tests/Feature`).
- Laravel: use `RefreshDatabase`/transactions for isolation; factories over shared fixtures.
- Confirm the coverage driver is present before trusting (or failing) the 95% gate.
