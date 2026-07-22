# .NET / C# — stack profile

> **Iteration zero.** A starting baseline, not yet verified end to end. If you work in this stack, please improve it — corrections and additions are very welcome via PR (see [README](./README.md)).

Baseline for .NET projects. The repo's `CLAUDE.md`, `*.sln`, and `*.csproj` settings win over this.

## Detect
`*.sln` or `*.csproj`. Test projects reference `xunit`, `nunit`, or `MSTest` plus `coverlet` (`coverlet.collector` / `coverlet.msbuild`).

## Commands
- Restore/build: `dotnet restore` && `dotnet build`.
- Format: `dotnet format --verify-no-changes` (+ any analyzers).
- Unit tests: `dotnet test`.
- Tests with coverage: `dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults`
  - MSBuild alt: `dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura`

## Coverage
- Report: `TestResults/**/coverage.cobertura.xml` (**Cobertura**) — parse per-file line/branch.
- Prefer the repo's coverlet settings / `runsettings` if defined in `CLAUDE.md` or the `.csproj`.
- Multiple test projects: aggregate the Cobertura files across the touched files.

## E2E
- Playwright for .NET or Selenium.WebDriver (usually a separate test project). Reuse existing page models and driver setup.

## Conventions & gotchas
- Test naming `Method_Scenario_ExpectedResult`; one behaviour per test.
- Responses return DTOs, not entities; validate at the request boundary.

## Docs
Coverlet: <https://github.com/coverlet-coverage/coverlet> · `dotnet test`: <https://learn.microsoft.com/dotnet/core/tools/dotnet-test>
