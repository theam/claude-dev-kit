# Secure Coding — Always-On Rules

Language-agnostic guardrails applied to every change. Stack-specific detail belongs in the consuming repo's `CLAUDE.md`.

## Authorization

- Every new endpoint or route declares its authorization requirement explicitly; "forgot the attribute/guard" is a blocking finding.
- Authorization checks live server-side; the frontend may hide UI but never *is* the check.
- Role or permission changes are called out in the PR description, never slipped in silently.

## Secrets & configuration

- No secrets in code, config files, tests, fixtures, or PR descriptions. Auth lives in per-developer OAuth grants or environment secrets.
- New configuration keys get safe defaults; a missing secret must fail loudly, not silently degrade.

## Input handling

- Validate at the boundary (request DTOs / forms), enforce in the domain. Client-side validation is UX, not defense.
- Parameterized queries only; string-built SQL is a blocking finding.
- File uploads: validate type, size, and name server-side; never trust the client-provided filename or content type.

## Data exposure

- Responses return DTOs, never raw entities — prevents accidental field leakage when the model grows.
- Error responses and logs must not leak internals: no stack traces, connection strings, tokens, or PII.
- Data export and reporting endpoints get the same authorization scrutiny as mutation endpoints.

## Webhooks & external calls

- Incoming webhooks verify signatures before processing.
- Outgoing calls have timeouts; failures degrade explicitly (no infinite hangs, no swallowed exceptions).

## What reviewers block on

Missing authorization, secrets in the diff, unparameterized queries, unvalidated boundary input, entity leakage, unverified webhooks. Everything else is severity-judged, these six are automatic.
