---
name: e2e-generate
description: Create or update end-to-end tests (Playwright and/or Selenium) for a user-facing flow that changed. Use after implementing a user story that alters UI behavior, routing, forms, or API-driven views.
---

# E2E Test Generation

For every user story that changes user-facing behavior, an existing e2e test must be updated or a new one created **before the story can be considered done**.

## Process

1. **Identify the affected flow(s)** from the story's acceptance criteria and the diff: which pages, routes, forms, and roles are involved.
2. **Discover the project's e2e conventions first** — framework(s), folder layout, page objects, helpers, and how the app/API is stubbed or seeded. Follow them exactly; do not introduce a new pattern when one exists.
   - Playwright: look for `playwright.config.*` and the `e2e/` tree; reuse existing Page Objects and helpers.
   - Selenium: look for the Selenium test project (commonly a .NET test project using `Selenium.WebDriver`); reuse existing page models and driver setup.
3. **Prefer updating an existing test** for the flow over creating a parallel one.
4. **Write the scenarios.** Every generated suite must cover realistic edge cases, not just the happy path:
   - Empty states
   - API failures and timeouts
   - Validation errors
   - Role/permission differences where applicable
   - Navigation and back-flow behavior where applicable
5. **Run the tests** with the project's e2e command (check the consuming repo's CLAUDE.md; e.g. `npx playwright test <file>` or `dotnet test` for the Selenium project). Related e2e tests must pass before PR creation.

## Quality rules

- Page Object Model: new pages get a page object; interactions go through it, not raw selectors in the test body.
- Stable selectors: prefer test ids / accessible roles over CSS chains.
- No sleeps: use the framework's waiting primitives.
- Keep test names descriptive of the user behavior, not the implementation.
- Preserve existing test names when updating a file.

## Output

Report which flows are covered, which test files were added/updated, the run result, and any flow you could not cover (with the reason) — never silently skip a flow.
