# PHP sample — the stack matrix's first real row

A deliberately small PHP project whose only job is to run the [PHP stack
profile](../../instructions/stacks/php.md)'s documented commands **for real** in CI, so a
profile that goes stale fails loudly instead of silently degrading the kit for the stack
(issue #50; the completeness lint in `scripts/stack-profiles.test.mjs` is the other half).

What the CI job (`.github/workflows/stacks.yml`, job `php`) proves on every run:

| Gate | Command (from the profile) | Enforced how |
|---|---|---|
| Install | `composer install` | job fails on error |
| Unit tests | `vendor/bin/phpunit` | job fails on failure |
| Coverage ≥ 95% per file | `vendor/bin/phpunit --coverage-clover coverage.xml` under **PCOV** | `scripts/check-clover.mjs coverage.xml 95` |
| E2E | — | **not applicable** and reported as such: the sample has no user-facing surface, and the adaptive-gates doctrine forbids scaffolding a framework to fake one |

Notes:

- `composer.lock` is deliberately **not** committed: the sample should exercise the
  profile against current dependencies, so a breaking PHPUnit or toolchain change
  surfaces here first — that is the staleness alarm working as intended.
- The class under test mirrors the kit's own coverage gate and carries real branches;
  a branchless sample would prove nothing about branch-level metrics.

Run it locally:

```bash
cd samples/php
composer install
vendor/bin/phpunit --coverage-clover coverage.xml   # needs PCOV or Xdebug (see the profile)
node ../../scripts/check-clover.mjs coverage.xml 95
```
