/*
 * pr-detect — count pull requests opened in a session, from its transcript.
 *
 * Privacy-critical: the match is against the *executed command* only (Claude: a Bash
 * tool_use input; Codex: an exec_command's `cmd`), never against instructions or command
 * output. So the create-pr skill merely *mentioning* `gh pr create`, or a command that
 * reads the skill file, cannot inflate the count. Only an integer count is ever emitted —
 * no PR URL, repo, title, or body. See TELEMETRY.md.
 */

// A create invocation must sit at a COMMAND POSITION — the start of the command, or
// right after a shell separator (`;` `&&` `||` `|` `&`), optionally behind `sudo` or
// env-var assignments — so the phrase quoted inside grep/echo/commit messages, in a
// comment, or in a file being read does NOT count. `-h`/`--help` invocations are excluded.
// This is a best-effort COUNT (a loose upper bound): a retried or failed attempt can
// over-count. Only the integer is ever emitted — never the command. See TELEMETRY.md.
const CREATE_CLI = /(?:^|[;&|]\s*)(?:sudo\s+)?(?:[A-Za-z_][A-Za-z0-9_]*=\S*\s+)*(?:gh\s+pr\s+create|glab\s+mr\s+create)\b(?![^\n]*\s(?:-h|--help)\b)/;

/** True if an executed shell command opens a PR on one of the hosts create-pr supports. */
export function isPrCreate(cmd) {
  if (typeof cmd !== 'string') return false;
  if (CREATE_CLI.test(cmd)) return true;                                          // github / gitlab CLI
  return /api\.bitbucket\.org/.test(cmd) && /pullrequests\b/.test(cmd) && /\bPOST\b/.test(cmd); // bitbucket REST
}

/**
 * Count PR-create commands executed in a session transcript.
 * @param {string[]} lines  JSONL lines of the transcript/rollout.
 * @param {'claude-code'|'codex'} agent  which host produced the transcript.
 */
export function countPrCreated(lines, agent) {
  let n = 0;
  for (const line of lines) {
    let o; try { o = JSON.parse(line); } catch { continue; }
    if (agent === 'codex') {
      const p = o?.payload;
      if (p?.type === 'function_call' && p?.name === 'exec_command') {
        let a; try { a = JSON.parse(p.arguments || '{}'); } catch { a = {}; }
        if (isPrCreate(a?.cmd)) n++;
      }
    } else {
      const content = o?.message?.content;
      if (Array.isArray(content)) {
        for (const b of content) {
          if (b?.type === 'tool_use' && b?.name === 'Bash' && isPrCreate(b?.input?.command)) n++;
        }
      }
    }
  }
  return n;
}
