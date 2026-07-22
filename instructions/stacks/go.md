# Go — stack profile

Baseline for Go projects. The repo's `CLAUDE.md` and `Makefile` targets win over this.

## Detect
`go.mod`. Tests are `*_test.go` files using the standard `testing` package.

## Commands
- Build: `go build ./...`.
- Lint/vet: `go vet ./...` and `golangci-lint run` if configured; format: `gofmt -l .`.
- Unit tests: `go test ./...`.
- Tests with coverage: `go test ./... -coverprofile=cover.out -covermode=atomic`
  - Per-package/func summary: `go tool cover -func=cover.out`.

## Coverage
- Report: `cover.out` (Go coverprofile). `go tool cover -func` gives per-function and total %; parse it for per-file coverage of touched files.
- Go coverage is line-based; branch/function metrics aren't native — report line coverage and say so rather than inventing a branch number.

## E2E
- API/integration via `net/http/httptest` and table-driven tests. Web UI (if any) via Playwright/Selenium against the built binary.

## Conventions & gotchas
- Table-driven tests, `t.Run` subtests; keep tests in the same package or `_test` package.
- No unseeded randomness or real clocks — inject them.
- `-covermode=atomic` when tests run in parallel.
