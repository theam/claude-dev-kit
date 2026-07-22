# Ruby — stack profile

Baseline for Ruby / Rails projects. The repo's `CLAUDE.md` and `Gemfile` win over this.

## Detect
`Gemfile` or `*.gemspec`. Tests: RSpec (`spec/`) or Minitest (`test/`). Rails if `config/application.rb` exists.

## Commands
- Install: `bundle install`.
- Lint: `bundle exec rubocop`.
- Unit tests: `bundle exec rspec` or `bin/rails test`.
- Tests with coverage: run the suite with **SimpleCov** enabled (add `require 'simplecov'; SimpleCov.start` at the top of `spec/spec_helper.rb` or `test/test_helper.rb` if missing).

## Coverage
- Report: `coverage/.resultset.json` and `coverage/coverage.json` (SimpleCov). Parse per-file line coverage from there.
- For a machine-friendly format, add `simplecov-lcov` → `coverage/lcov.info`. SimpleCov is line-based (no native branch coverage unless `enable_coverage :branch` is set).

## E2E
- Rails system tests (Capybara + Selenium/`cuprite`), or Playwright/Cypress for a decoupled frontend.

## Conventions & gotchas
- RSpec: `describe`/`context`/`it` with behaviour-focused names; use factories (FactoryBot), not fixtures with shared mutable state.
- Enable SimpleCov before the app loads or coverage under-reports.
- Rails: use `ActiveRecord` transactions / `database_cleaner` for isolation.
