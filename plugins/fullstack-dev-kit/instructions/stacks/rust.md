# Rust — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Rust projects. The repo's `CLAUDE.md` and `Cargo.toml` win over this.

## Detect
`Cargo.toml`. Tests are `#[test]` functions (unit, in-module) and integration tests under `tests/`. `nextest` if configured.

## Commands
- Build: `cargo build`.
- Lint/format: `cargo clippy -- -D warnings` and `cargo fmt --check`.
- Unit tests: `cargo test` (or `cargo nextest run`).
- Tests with coverage (**cargo-llvm-cov** — the current ecosystem standard): `cargo llvm-cov --lcov --output-path lcov.info`

## Coverage
- **cargo-llvm-cov** uses LLVM source-based instrumentation (line + region + branch, cross-platform, works with `cargo test`/`nextest`). Prefer it over tarpaulin (older, ptrace-based, Linux-x86_64 only).
- Report: `lcov.info` (lcov) — parse per-file line/region coverage. `--summary-only` prints totals. Needs the `llvm-tools-preview` component.
- Alternative: `cargo tarpaulin --out Xml` → `cobertura.xml`.

## E2E
- Uncommon; for services, integration tests under `tests/` against a spawned server. UI (if any) via Playwright/Selenium against the built binary.

## Conventions & gotchas
- Unit tests in a `#[cfg(test)] mod tests` block next to the code; integration tests in `tests/`.
- Deterministic: inject clocks/RNG; no reliance on wall-clock or thread ordering.
- Workspaces: run coverage per crate and aggregate for the touched files.

## Docs
cargo-llvm-cov: <https://github.com/taiki-e/cargo-llvm-cov>
