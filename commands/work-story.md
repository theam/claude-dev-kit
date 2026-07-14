---
description: Work a Jira user story end to end — fetch the ticket, plan, implement, verify gates, and open the PR. Usage - /work-story PROJ-1234 [--auto-approve]
---

Work the Jira user story given in the arguments: $ARGUMENTS

Delegate the workflow to the `coding-agent` subagent in two phases, passing the ticket key and any extra instructions from the arguments.

Rules:

- If no ticket key matching `[A-Z][A-Z0-9]+-\d+` is present in the arguments, ask for one — do not guess.

The story is worked **in the current directory** — no worktree is created here. To run several stories in parallel, use `/launch-story` first: it prepares a dedicated worktree and opens a new window, and this command runs inside it.

**Phase 1 — context and plan.** Instruct the coding-agent to fetch the ticket (and any linked designs), build its implementation plan, and RETURN the ticket summary and the full plan as its result — telling it explicitly NOT to ask for approval itself and NOT to write any code yet.

**Plan-approval gate — two separate steps, in this exact order:**

1. **FIRST, print the plan**: write a normal assistant message to the conversation containing the ticket summary and the coding-agent's FULL plan, verbatim. This message is a hard requirement — a selection dialog is NOT a substitute for it, and putting the plan only inside a dialog's option text does not count: the user must be able to read the complete plan in the chat before any question appears.
2. **THEN, and only after that message is visible**, ask the user to approve, adjust, or cancel (plain question or dialog — either is fine at this point).

Never collapse these two steps into one dialog. Only if the arguments contain `--auto-approve` (for automated/pipeline runs), skip the gate and proceed directly.

**Phase 2 — execution.** On approval (or auto-approve), continue the SAME coding-agent (resume it with the approval and any user adjustments) so it keeps its context, and let it run the remaining workflow: implement, verify gates, self-review, create the PR, and update the Jira ticket.

- Relay the coding-agent's final report to the user: PR URL, verification evidence (unit tests, coverage table, e2e results, lint, security pass), Jira transition applied, and follow-up risks.
- If the current directory is a `/launch-story` worktree, remind the user to remove it (`git worktree remove <path>`) once the PR merges.
