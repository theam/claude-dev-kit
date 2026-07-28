# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Report privately, either:

- **GitHub → Security → "Report a vulnerability"** (private vulnerability reporting), or
- email **ataman@theagilemonkeys.com**

Include: what you found, how to reproduce it, affected version(s), and the impact you expect. We aim to acknowledge within a few business days and will keep you updated on the fix and disclosure timeline.

## Scope — what matters most here

This kit is a set of Markdown prompts (agents/skills/commands) plus a small, zero-dependency npm setup wizard and an optional telemetry relay. The highest-value areas to look at:

- **Supply chain of `@theagilemonkeys/create-dev-kit`** — anything that could let a malicious version run on users' machines (`npm create` executes it). The package ships only `index.mjs` + `README.md`, has no dependencies, and no install/lifecycle scripts.
- **Telemetry** — it must remain anonymous and opt-in, and must never transmit prompts, code, paths, ticket content, emails, org-instance data, or the caller IP. See [TELEMETRY.md](./TELEMETRY.md); the relay strips IP and re-enforces [`telemetry/contract.v1.json`](./telemetry/contract.v1.json).
- **The relay** — it holds the PostHog key only in its own environment; it must never accept payloads that break the contract.

## What is not a vulnerability

- The plugin runs with the user's own permissions inside Claude Code (like any plugin) — that's expected. Report anything that exceeds or abuses that (e.g. exfiltration, hidden network calls).
- Prompt content or model behavior that is a quality issue rather than a security one — open a normal issue instead.

## Supported versions

The latest released version on `main` is supported. Please reproduce on the latest before reporting.
