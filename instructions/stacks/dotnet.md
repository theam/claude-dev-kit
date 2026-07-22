# .NET / C# — stack profile

Baseline for .NET projects. The repo's `CLAUDE.md`, `*.sln`, and `*.csproj` settings win over this.

## Detect
`*.sln` or `*.csproj`. Test projects usually reference `xunit`, `nunit`, or `MSTest` plus `coverlet`.

## Commands
- Restore/build: `dotnet restore` && `dotnet build`.
- Lint/format: `dotnet format --verify-no-changes` (plus any analyzers configured).
- Unit tests: `dotnet test`.
- Tests with coverage: `dotnet test --collect:"XPlat Code Coverage" --results-directory ./TestResults`
  - Or coverlet MSBuild: `dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura`.

## Coverage
- Report: `TestResults/**/coverage.cobertura.xml` (Cobertura). Parse per-file line/branch metrics from it.
- If the repo defines coverlet settings or a coverage command in `CLAUDE.md`/`.csproj`, prefer those.

## E2E
- Playwright for .NET or Selenium.WebDriver (commonly a separate test project). Reuse existing page models and driver setup.

## Conventions & gotchas
- Test naming: `Method_Scenario_ExpectedResult`; one behaviour per test.
- Responses return DTOs, not entities; validate at the request boundary.
- Multiple test projects: aggregate the Cobertura files for per-file coverage across the touched files.
