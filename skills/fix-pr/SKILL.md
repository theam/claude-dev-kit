---
name: fix-pr
description: Resolve the findings on an existing pull request - review comments, CI failures, and self-review findings - driving each to a decision (fix / defer to a tracked issue / discard), re-verifying the gates, replying to each reviewer, and watching for late feedback. The counterpart to pr-review that closes the loop.
---

# Fix PR

Drive a PR's feedback to done: run a review, triage **every** item to a decision, fix what deserves fixing, file what deserves doing later, discard what deserves nothing, answer every reviewer, and re-check after pushing in case late feedback (bots, CI) arrives. The bar for correctness is high; the bar for new machinery is low — fix the defect, don't redesign around it.

## 1. Establish the PR intent (the scope ruler)
Write one or two sentences: **what this PR is for, and what it deliberately does not change** — derived from the title, body, linked issue, and the diff. Every scope call below is measured against it. If the intent is genuinely ambiguous, ask the author before triaging.

## 2. Gather the findings
Collect from every surface, deduplicated. Commands below are for `github` (`prHost` in `.claude/dev-kit.json`); for **bitbucket** use the REST API (`/pullrequests/{id}` comments, `/statuses`), for **gitlab** `glab mr view/checks`.

1. **CI failures**: `gh pr checks <pr>` — read the failing job logs, not just the status.
2. **Review feedback**: unresolved inline threads, review summary bodies, and PR conversation comments — bots included (`gh pr view <pr> --comments`, `gh api` for threads). Keep outdated threads: the code moved, the concern may not have.
3. **Self-review findings** handed over by the caller (the `pr-review` pass).

## 3. Build the ledger
One row per **distinct claim**, merging duplicates across sources (if the review pass and a human flagged the same defect, that's one row citing both — and the human's thread still gets a reply):

| id | source | file:line | claim | category | verdict |

Assign exactly one verdict per row — nothing stays undecided:
- **`FIX_NOW`** — fix it in this PR.
- **`DEFER_TO_ISSUE`** — real value, wrong moment → a tracked issue.
- **`DISCARD`** — not worth anyone's time; no fix, no issue.

**Never `DISCARD`** (from `instructions/secure-coding.md` + `instructions/testing-standards.md`): security/data-exposure, serious performance regressions, duplication this PR introduces, and missing test coverage for behavior it changes (when the project has tests). Only defer one of these when the fix is genuinely a separate project — and say so, treating the PR as blocked on the author's call, not quietly filing an issue.

Show the classified ledger before touching code — the cheapest moment to correct a bad call.

## 4. Ask about scope conflicts
Batch every fix that would push past the PR's intent into **one** round of questions (AskUserQuestion) with your recommendation. Don't widen scope silently.

## 5. Fix
Smallest correct change per `FIX_NOW`, following the repo's conventions and the kit instructions. Add/update the tests that prove each fix (a test that fails without it); keep touched files at the project's coverage bar (adaptive — see `testing-standards.md`). One commit per coherent group; push to the PR branch. No opportunistic refactors, no force-push/amend/rebase of remote commits.

## 6. Answer every reviewer (consent-first)
Reply to each human/bot comment with the decision taken, then resolve the thread. **Show the exact replies and get confirmation before posting to GitHub** (in `--auto-approve` pipeline runs, post them and flag prominently in the report). Never resolve someone else's thread without a reply. A finding you believe is wrong gets a reasoned reply, not silence.

## 7. File deferred work
For each `DEFER_TO_ISSUE`, confirm the batch with the user, then create a tracked issue **via the configured tracker** (the `issue-*` adapters / `.claude/dev-kit.json`) — or the PR host's issues — and link it from the reply.

## 8. Re-verify the gates
Same as `create-pr`, adaptive to the project: unit tests for touched files pass; `coverage-check` holds the project's bar with no regression; related e2e pass if user-facing and the project does e2e; lint clean; no suppressions to dodge a gate.

## 9. Watch for late feedback, then loop
Bots and CI often post minutes after a push. Right after pushing, run the bundled watcher in the background. It ships with the kit at `scripts/watch-pr-feedback.sh`; resolve its path from the kit install — `$CLAUDE_PLUGIN_ROOT` on Claude Code, the kit checkout path on Codex:
```bash
BASELINE=<ledger github ids> "$CLAUDE_PLUGIN_ROOT"/scripts/watch-pr-feedback.sh <pr>   # Claude Code
# Codex: run the same script from the kit's install path (no $CLAUDE_PLUGIN_ROOT there)
```
Read its exit code: **10** = new feedback (printed) → back to step 3 with the new items; **20** = a bot signalled all-clear (👍 on the PR / approving review); **0** = ten quiet minutes; **30** = inconclusive → re-run it. Only close out on **0** or **20** from a window covering the last push. (GitHub only; for other hosts, do a single post-push re-check instead.)

## 10. Report
Account for **every** ledger row (fixed / deferred+issue link / discarded+why / answered), the verification evidence, how the feedback window closed, and the PR URL. Never report the PR clean while blocking threads remain open.
