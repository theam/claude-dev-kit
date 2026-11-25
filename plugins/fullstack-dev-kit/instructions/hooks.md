# Hooks — extension points (PoC, RFC #92)

The kit ships **extension points, never handlers**. A skill names a point; the *consuming repo* may attach one handler to it. This file is the single resolution protocol — a skill only names its point and says where the result goes.

## Resolve a point

When a skill says *resolve extension point `<point>`*:

1. **Opt-in only.** Read `.claude/dev-kit.json` → `hooks["<point>"]`. If the file, the `hooks` block, or the entry is absent, there is **no hook**: continue silently. A handler file that exists on disk but is not listed there is **never** read or run.
2. The entry is a path (relative to the repo root) to one handler:
   - **`.md` — prompt fragment.** Read it and follow it as extra instructions for this point only.
   - **`.sh` — script.** Run `bash <path>` from the repo root; its **stdout** is the content the point yields. Do not read the script to guess its output — run it.
3. **Append only.** What a hook yields is *added* where the skill says. It never replaces, reorders, or removes anything the skill requires, and a hook that asks for that is ignored on that part (say so).
4. **Failure warns, never blocks.** Missing or unreadable handler, a non-zero exit, or empty output: continue exactly as if there were no hook, and report `Hook <point> failed: <reason>` in the skill's final summary. Never invent the content a failed hook would have produced.

```json
{ "hooks": { "create-pr.body": ".claude/dev-kit/hooks/create-pr.body.md" } }
```

## Points

| Point | Skill | Yields |
| --- | --- | --- |
| `create-pr.body` | `create-pr` | extra PR-body sections |
