# Stack profiles

Each file here is a **baseline profile** for one tech stack — the commands and
conventions the kit falls back to when the consuming repo doesn't spell them out.

They exist so the kit has a usable **"iteration zero"** for the common stacks out
of the box. They are intentionally generic: teams refine them for their stack via
PR, and adding a new stack is just a new markdown file.

## Precedence (most specific wins)

1. The consuming repo's `CLAUDE.md` / `.claude/dev-kit.json` — always wins.
2. The matching stack profile in this folder — the baseline used when the repo is silent.
3. The language-agnostic rules in `../secure-coding.md` and `../testing-standards.md`.

A profile never overrides what the consuming repo declares; it only fills gaps.

## How it's selected

`dev-kit-setup` detects the stack(s) from the project's files and records them in
`.claude/dev-kit.json` as `"stacks": ["php"]` (or several for a monorepo). Skills
that need stack-specific commands (`coverage-check`, `e2e-generate`) and the
`coding-agent` load the matching profile(s) here.

## Profile format

Keep each profile short and factual, following this shape:

```markdown
# <Stack> — stack profile

## Detect
Files that signal this stack.

## Commands
Install / build / lint / unit test / **test with coverage** (command → report path + format).

## Coverage
Report format and where per-file metrics live, so `coverage-check` can parse it.

## E2E
Framework(s) commonly used and the run command.

## Conventions & gotchas
Layout, test naming, mocking style, prerequisites (e.g. a coverage driver), and pitfalls.
```

## Contributing a stack (or improving one)

Add or edit one file here — nothing else is required for the kit to pick it up.
Prefer the mainstream toolchain for the stack, note prerequisites (e.g. PHP needs
Xdebug/PCOV for coverage), and keep it to what the kit actually needs: how to run
tests, get coverage, run e2e, and the conventions a reviewer would expect. See the
main [CONTRIBUTING.md](../../CONTRIBUTING.md).

Current profiles: `dotnet`, `go`, `java`, `node`, `php`, `python`, `ruby`, `rust`.
Everything here is iteration zero — corrections from people who work in the stack daily are the most valuable contribution.
