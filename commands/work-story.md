---
description: Work a Jira user story end to end — fetch the ticket, plan, implement, verify gates, and open the PR. Usage - /work-story PROJ-1234 [--auto-approve]
---

Work the Jira user story given in the arguments: $ARGUMENTS

Delegate the full workflow to the `coding-agent` subagent, passing the ticket key and any extra instructions from the arguments.

Rules:

- If no ticket key matching `[A-Z][A-Z0-9]+-\d+` is present in the arguments, ask for one — do not guess.
- By default the plan-approval gate applies: the coding-agent must present its plan and wait for the user's explicit approval before writing code.
- Only if the arguments contain `--auto-approve` (for automated/pipeline runs), tell the coding-agent the plan is pre-approved and it may proceed without waiting.
- Relay the coding-agent's final report to the user: PR URL, verification evidence (unit tests, coverage table, e2e results, lint), and follow-up risks.
