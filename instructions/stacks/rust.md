# Rust — stack profile

Baseline for Rust projects. The repo's `CLAUDE.md` and `Cargo.toml` win over this.

## Detect
`Cargo.toml`. Tests are `#[test]` functions (unit, in-module) and integration tests under `tests/`.

## Commands
- Build: `cargo build`.
- Lint/format: `cargo clippy -- -D warnings` and `cargo fmt --check`.
- Unit tests: `cargo test`.
- Tests with coverage (prefer `cargo-llvm-cov`): `cargo llvm-cov --lcov --output-path lcov.info`
  - Alternative: `cargo tarpaulin --out Xml` → `cobertura.xml`.

## Coverage
- Report: `lcov.info` (lcov) from llvm-cov, or `cobertura.xml` from tarpaulin. Parse per-file line/region coverage.
- `cargo llvm-cov --summary-only` prints totals; the tool requires the `llvm-tools-preview` component.

## E2E
- Less common; for web services, integration tests under `tests/` hitting a spawned server, or Playwright/Selenium against the built binary for any UI.

## Conventions & gotchas
- Unit tests live in a `#[cfg(test)] mod tests` block next to the code; integration tests in `tests/`.
- Deterministic tests: inject clocks/RNG, no reliance on wall-clock or thread ordering.
- Workspaces: run coverage per crate and aggregate for the touched files.
