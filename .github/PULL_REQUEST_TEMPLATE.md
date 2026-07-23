<!-- Thanks for contributing! Keep PRs small and single-concern. -->

## What & why
Briefly, what this changes and the problem it solves.

## Type
- [ ] Bug fix
- [ ] New/improved stack profile (`instructions/stacks/…`)
- [ ] New/improved adapter (tracker / PR host)
- [ ] Docs
- [ ] Other:

## Checklist
- [ ] Keeps the kit **stack-agnostic** (nothing client/company/project-specific; stack detail stays in profiles/consuming repo).
- [ ] Doesn't weaken the quality gates or the telemetry privacy guarantees.
- [ ] Docs updated in the same PR (README "What's inside" / affected flow) if behavior changed.
- [ ] If this touches `packages/` or `telemetry/`, I've flagged it for extra review (supply-chain / privacy sensitive).
- [ ] Version bumped in `.claude-plugin/plugin.json` if users should receive this (merging without a bump updates nobody).
