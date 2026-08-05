# Go — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for Go projects. The repo's `CLAUDE.md` and `Makefile` targets win over this.

## Detect
`go.mod`. Tests are `*_test.go` files using the standard `testing` package (often table-driven).

## Commands
- Build: `go build ./...`.
- Vet/lint: `go vet ./...` and `golangci-lint run` (if configured); format check: `gofmt -l .`.
- Unit tests: `go test ./...`.
- Tests with coverage: `go test ./... -coverprofile=cover.out -covermode=atomic`
  - Summary: `go tool cover -func=cover.out` (per-function + total); HTML: `go tool cover -html=cover.out`.

## Coverage
- Report: `cover.out` (Go coverprofile). Parse per-file/function % from `go tool cover -func`.
- Go coverage is **line-based**; branch/function metrics aren't native — report line coverage and say so rather than inventing a branch number.
- `-covermode=atomic` when tests run in parallel; `-coverpkg=./...` to include cross-package coverage.

## E2E
- API/integration via `net/http/httptest` and table-driven tests. Web UI (if any) via Playwright/Selenium against the built binary.

## Conventions & gotchas
- Table-driven tests with `t.Run` subtests; keep tests in-package or a `_test` package.
- No unseeded randomness or real clocks — inject them.

## Docs
`go test` / cover: <https://go.dev/blog/cover> · golangci-lint: <https://golangci-lint.run>
