# Ruby — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Ruby / Rails projects. The repo's `CLAUDE.md` and `Gemfile` win over this.

## Detect
`Gemfile` or `*.gemspec`. Tests: RSpec (`spec/`) or Minitest (`test/`). Rails if `config/application.rb` exists.

## Commands
- Install: `bundle install`.
- Lint: `bundle exec rubocop`.
- Unit tests: `bundle exec rspec` or `bin/rails test`.
- Tests with coverage: run the suite with **SimpleCov** enabled (add `require 'simplecov'; SimpleCov.start 'rails'` at the very top of `spec/spec_helper.rb` / `test/test_helper.rb` if missing).

## Coverage
- SimpleCov default output: `coverage/.resultset.json` + an HTML report (line-based).
- For a machine-parseable file, add a formatter gem: **`simplecov-cobertura`** → `coverage/coverage.xml` (Cobertura, recommended) or `simplecov-json` → `coverage/coverage.json`. (`simplecov-lcov` exists but the lcov format is being retired by some tools — prefer Cobertura/JSON.)
- Branch coverage: `SimpleCov.start { enable_coverage :branch }`. Without it, report line coverage and say so.

## E2E
- Rails system tests (Capybara + Selenium or `cuprite`), or Playwright/Cypress for a decoupled frontend.

## Conventions & gotchas
- **SimpleCov must start before the app loads** or coverage under-reports.
- RSpec: `describe`/`context`/`it` with behaviour-focused names; FactoryBot over shared fixtures.
- Rails: transactions / `database_cleaner` for isolation.

## Docs
SimpleCov: <https://github.com/simplecov-ruby/simplecov>
