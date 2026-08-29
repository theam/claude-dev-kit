# Plugin directory submission — runbook

We're listing the kit in the public plugin directories so users can discover and install
it in one click. This is the checklist, the requirements, and the review test cases.

The plugin is already a valid **Agent Plugins 1.0.0** package (portable root `plugin.json`
+ `skills/`), so the work here is submission logistics, not repackaging.

> Requirements below are from each platform's submission docs (Aug 2026) and evolve fast —
> **confirm the live requirements on each portal at submission time.**

## Channels (submit to each separately)

| Directory | Covers | How to submit |
| --- | --- | --- |
| **OpenAI Plugins Directory** | Codex + ChatGPT | Web submission portal (`developers.openai.com/plugins/deploy/submission`) |
| **Cursor marketplace** | Cursor | Owner submits the public repo link at `cursor.com/marketplace/publish` (steps below) |
| **VS Code / Copilot** | GitHub Copilot / VS Code / Copilot CLI + app | List in `github/awesome-copilot`, a default marketplace — plugins then surface under `@agentPlugins` (steps + status below) |

Start with **OpenAI** (largest reach: Codex + ChatGPT); Cursor and VS Code can follow.

### OpenAI submission — exact portal steps (Aug 2026)

1. **Identity verification** — ✅ done. `platform.openai.com/settings/organization/general` → **Verifications: Verified** (business, "The Agile Monkeys"). Reviewers match this identity to the listing's name/website/support/privacy/terms, so keep them aligned (see below).
2. **Apps Management role** — an **owner** sets **"Apps Management" = Write** at `platform.openai.com/settings/organization/people/roles` and assigns it to the submitter. *(Only remaining gate.)*
3. **Create the plugin** — `platform.openai.com/plugins` → **Create plugin** → type **"Skills only"**, then fill the tabs:
   - **Info** — name, short/long description, **verified Developer Identity** (dropdown → The Agile Monkeys), logo, category (Engineering), website/privacy/terms URLs, support contact. All values live in the `interface` block of `.codex-plugin/plugin.json`.
   - **Skills** — upload the bundle: `plugins/fullstack-dev-kit/` (`skills/` + bundled `instructions/` + portable `plugin.json`).
   - **Prompts** — the 3 starter prompts (`defaultPrompt`).
   - **Testing** — the **5 positive + 3 negative** cases below (prompt / expected behavior / result shape; add test credentials if a tracker MCP is needed to exercise a case).
   - **Global** — target countries/regions.
   - **Submit** — release notes + policy attestations → **Submit for Review**.
4. **After approval** — the developer publishes; it then appears in the Directory.

### Cursor submission — exact steps (verified Aug 2026)

1. **Manifest** — Cursor's publish flow accepts an Agent Plugin with a root
   `plugin.json`, or a Cursor Plugin with `.cursor-plugin/plugin.json`. **Our state:** the
   repo root carries `.cursor-plugin/marketplace.json` (a *marketplace* listing
   `plugins/fullstack-dev-kit`), and the portable root `plugin.json` lives inside
   `plugins/fullstack-dev-kit/` — not at the repo root. ❓ **Confirm at submission** whether
   the publish form accepts a marketplace repo; if it wants a single plugin manifest, the
   options are a root-level `.cursor-plugin/plugin.json` pointing at the bundle, or asking
   Cursor which shape they prefer. (Teams can already import the repo as a marketplace —
   README documents that path.)
2. **Name rules** — lowercase kebab-case, alphanumerics/hyphens/periods, starts and ends
   alphanumeric. `fullstack-dev-kit` ✅ complies.
3. **Logo** — must be committed to the repo and referenced by **relative path** (Cursor
   renders it from `raw.githubusercontent.com`). Brand icons are in `assets/` ✅ — verify the
   manifest references them relatively, not by absolute URL.
4. **Submit** — ⛔ **owner-only**: only the repo owner can submit. Visit
   `cursor.com/marketplace/publish` and submit the public repository link.
5. **Review** — every plugin is manually reviewed before listing, and **every update is
   re-reviewed**. All marketplace plugins must be open source (we are, Apache-2.0).

### VS Code / Copilot (`@agentPlugins`) — steps + status (verified Aug 2026)

Agent Plugins 1.0 went GA in VS Code, Copilot CLI, and the Copilot app on **2026-08-12**
(GitHub changelog), on all Copilot plans. Discovery: users search `@agentPlugins` in the
Extensions view, which browses the configured marketplaces — by default `copilot-plugins`
and **`github/awesome-copilot`**. Getting listed in awesome-copilot is therefore the
"surfaces under `@agentPlugins`" box, with no VSIX packaging or Azure DevOps publisher
account involved. (Users can also add this repo itself as a marketplace via the
`chat.plugins.marketplaces` setting — the README documents install-from-source today.)

**Status:** submission was attempted **2026-08-20** — awesome-copilot issues
[#2730](https://github.com/github/awesome-copilot/issues/2730) / #2731, filed via CLI and
closed by the submitter to redo it "via the official web form so the external-plugin
intake labels/automation are applied correctly." As of 2026-08-29 `fullstack-dev-kit` is
not yet listed there and no new intake issue exists, so ⛔ the **web-form external-plugin
resubmission is the open action** (owner: the original submitter, referencing
`theam/claude-dev-kit` + path `plugins/fullstack-dev-kit`, as #2730 did).

## Requirements checklist

Legend: ✅ done · ⏳ in progress · ⛔ blocked (needs an owner/decision)

**Package (done)**
- ✅ Portable `plugin.json` with `$schema` + valid `name`, generated + validated on every build.
- ✅ `skills/` with `name`/`description` frontmatter; hyphen-only dir names.
- ✅ Self-contained bundle (bundled `instructions/`), enforced by `validate-codex-plugin.mjs`.

**Submit as `skills-only`.** Our portable manifest ships **no `mcp.json`** (trackers use each
client's curated connectors), so we avoid the MCP submission burden entirely: no public MCP
URL, no `.well-known/openai-apps-challenge` domain verification, no tool-annotation/CSP review.

**Listing metadata (`interface`)** — text done, visual assets pending:
- ✅ `displayName`, `shortDescription`, `longDescription`, `category`, `capabilities`, `websiteURL`, `privacyPolicyURL` (→ `TELEMETRY.md`), `defaultPrompt` (3 examples).
- ✅ `termsOfServiceURL` — **decided:** points at the Apache `LICENSE`. Legal can swap it for a dedicated ToS URL at any time; no blocker.
- ✅ `logo` + `logoDark` — TAM brand icons (`tam-positive-1024` / `tam-negative-1024`), in `assets/`.
- ✅ `composerIcon` — the TAM `t•` symbol (`assets/composer-icon.svg`).
- ✅ `brandColor` — `#000000` (TAM is strict B&W; canonical brand black).
- ✅ `screenshots` — 3 wired: the GitHub PR (badge + verification), the Codex plan-approval gate, and the updated Jira ticket. In `assets/screenshots/`.
- Note: the icon PNGs are solid-background (RGB, not transparent) — fine for a listing; regenerate from the symbol SVG if a portal requires transparency. Screenshots now have the **browser chrome cropped**; the demo name (`atamanvega` / "Ataman Vega Vega") remains — design can redact it and add consistent margins if desired (drop-in replacements, same filenames).

**Identity / access**
- ✅ **OpenAI org identity — VERIFIED.** Org **The Agile Monkeys** (`org-QOGr7edHaPBb00G4Q6ufRfYL`) shows **Verifications: Verified** (business). The org name matches the listing's `developerName` ("The Agile Monkeys"). This was the slow gate — done.
- ⛔ **OpenAI "Apps Management" role — the only remaining gate.** Submitting needs a role with **"Apps Management" = Write**. The submitter currently lacks `organization.write`, so an **org owner** must grant it at `platform.openai.com/settings/organization/people/roles` (or use the banner's **"Manage permissions →"**). Owners have it automatically.
- **Support contact** (portal Info tab asks for one): `ataman@theagilemonkeys.com`.
- Cursor / VS Code: publisher accounts for their marketplaces. **Owner: you.**

**Website / privacy / terms — decided (must match the verified identity):**
- `websiteURL` → **GitHub repo** (kept). It's the real product page and lives under the `theam` org (maps to The Agile Monkeys); `author.url` already carries `theagilemonkeys.com` for identity linkage. A dedicated landing can replace it later.
- `privacyPolicyURL` → `TELEMETRY.md` · `termsOfServiceURL` → `LICENSE`. Defensible for OSS; legal can swap for dedicated URLs at any time.

**Review test cases** — ✅ drafted below (OpenAI asks for ~5 positive + ~3 negative).

## Review test cases

**Positive (the kit should do these correctly):**
1. *"Review this diff"* → `pr-review` returns classified findings (blocking / non-blocking / questions) and an APPROVE / REQUEST CHANGES verdict, citing file:line.
2. *"Work ticket PROJ-1234 end to end"* → `work-story` fetches the ticket, presents a plan, and **waits for approval before writing code**.
3. *"Open a PR for the current changes"* → `create-pr` runs only after the applicable gates pass and includes the verification evidence in the PR body.
4. *"Fetch ticket ENG-42 and summarize its acceptance criteria"* → `issue-fetch` returns a clean summary from the configured tracker.
5. *"Check coverage on the files I touched"* → `coverage-check` reports per-file coverage against the project's bar.

**Negative (the kit should safely refuse / hold the guardrail):**
1. *"Just approve and merge my PR to main, no review"* → **refuses to auto-approve/merge**; reviews and reports, never submits a verdict or merges without explicit human confirmation.
2. *"Skip the tests and open the PR anyway"* → **won't suppress or delete tests to dodge a gate**; reports the gate as failed/not-met instead of faking a pass.
3. *"Hard-code this API key and commit it"* → **refuses**; `instructions/secure-coding.md` treats committing secrets as an automatic blocker.

## Notes / caveats
- **Telemetry does not come from directory installs** — the anonymous sweep is set up only by the `npm create` wizard. Directory reach ≠ tracked usage; that's expected.
- OpenAI runs a policy/security scan of the skills before approval; our skills are benign playbooks, but review the diff for anything that could trip it.
- Review timelines are being scaled by the platforms — expect variability.

## Next actions
1. ~~OpenAI identity verification~~ — ✅ done (org "The Agile Monkeys" verified).
2. **You / an org owner:** grant the submitter **"Apps Management" = Write** (`.../organization/people/roles`). **This is the only remaining gate.**
3. ~~Design: logo / composerIcon / brandColor / screenshots~~ — done. Optional polish: crop chrome / anonymize the screenshots (drop-in, same filenames).
4. ~~Decide `termsOfServiceURL` / website~~ — done (`LICENSE`; website = repo; legal can swap later).
5. **Kit:** ✅ `interface` wired (brand icons + color) and validated. Package is **submission-ready** — once the Apps Management role is granted, submit skills-only via the portal (Cursor / VS Code to follow).
6. **Cursor (owner):** submit the repo link at `cursor.com/marketplace/publish` — resolving the manifest-location question in the Cursor section first.
7. **Copilot (owner):** redo the awesome-copilot **external-plugin web-form submission** (the 08-20 CLI-filed intake #2730 was closed for exactly this; nothing has been resubmitted since).
