---
name: e2e-generate
description: Create or update end-to-end tests for a user-facing flow that changed, using whatever e2e framework the repo already uses. Use after implementing a user story that alters UI behavior, routing, forms, or API-driven views.
---

# E2E Test Generation

For every user story that changes user-facing behavior, an existing e2e test must be updated or a new one created **before the story can be considered done**. This skill is framework-agnostic — it uses whatever e2e stack the consuming repo already has, and never introduces a new one.

## Process

1. **Identify the affected flow(s)** from the story's acceptance criteria and the diff: which pages, routes, forms, and roles are involved.
2. **Discover the project's e2e framework and conventions first** — before writing anything. If `.claude/dev-kit.json` names a stack, `instructions/stacks/<id>.md` lists the frameworks common for it as a starting hint. Then look for the config and test tree of whatever the repo actually uses (e.g. `playwright.config.*` + `e2e/`, `cypress.config.*` + `cypress/`, a Selenium/WebDriver test project, `*.feature` files for Cucumber, etc.) and reuse its existing page objects, fixtures, helpers, and app/API seeding or stubbing. Follow them exactly; do not introduce a new pattern or framework when one exists. If the repo has no e2e setup at all, say so and propose one that fits the stack instead of scaffolding silently.
3. **Prefer updating an existing test** for the flow over creating a parallel one.
4. **Write the scenarios.** Every generated suite must cover realistic edge cases, not just the happy path:
   - Empty states
   - API failures and timeouts
   - Validation errors
   - Role/permission differences where applicable
   - Navigation and back-flow behavior where applicable
5. **Run the tests** with the project's e2e command (check the consuming repo's CLAUDE.md; e.g. `npx playwright test <file>`, `npx cypress run`, or the repo's WebDriver test command). Related e2e tests must pass before PR creation.

## Quality rules

- Page Object Model: new pages get a page object; interactions go through it, not raw selectors in the test body.
- Stable selectors: prefer test ids / accessible roles over CSS chains.
- No sleeps: use the framework's waiting primitives.
- Keep test names descriptive of the user behavior, not the implementation.
- Preserve existing test names when updating a file.

## Output

Report which flows are covered, which test files were added/updated, the run result, and any flow you could not cover (with the reason) — never silently skip a flow.
