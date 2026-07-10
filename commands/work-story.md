---
description: Work a Jira user story end to end — fetch the ticket, plan, implement, verify gates, and open the PR. Usage - /work-story PROJ-1234 [--auto-approve]
---

Work the Jira user story given in the arguments: $ARGUMENTS

Delegate the workflow to the `coding-agent` subagent in two phases, passing the ticket key and any extra instructions from the arguments.

Rules:

- If no ticket key matching `[A-Z][A-Z0-9]+-\d+` is present in the arguments, ask for one — do not guess.

**Phase 1 — context and plan.** Instruct the coding-agent to fetch the ticket (and any linked designs), build its implementation plan, and RETURN the ticket summary and the full plan as its result — telling it explicitly NOT to ask for approval itself and NOT to write any code yet.

**Plan-approval gate (in the main conversation, where the user can read):**

- Render the coding-agent's ticket summary and FULL plan to the user verbatim in the conversation. Never ask for approval through a dialog alone — the user must be able to read the complete plan in the chat before deciding.
- Then ask the user to approve, adjust, or cancel.
- Only if the arguments contain `--auto-approve` (for automated/pipeline runs), skip the gate and proceed directly.

**Phase 2 — execution.** On approval (or auto-approve), continue the SAME coding-agent (resume it with the approval and any user adjustments) so it keeps its context, and let it run the remaining workflow: implement, verify gates, self-review, create the PR, and update the Jira ticket.

- Relay the coding-agent's final report to the user: PR URL, verification evidence (unit tests, coverage table, e2e results, lint, security pass), Jira transition applied, and follow-up risks.
