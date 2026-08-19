/*
 * pr-detect — count pull requests opened in a session, from its transcript.
 *
 * Privacy-critical: the match is against the *executed command* only (Claude: a Bash
 * tool_use input; Codex: an exec_command's `cmd`), never against instructions or command
 * output. So the create-pr skill merely *mentioning* `gh pr create`, or a command that
 * reads the skill file, cannot inflate the count. Only an integer count is ever emitted —
 * no PR URL, repo, title, or body. See TELEMETRY.md.
 */

/** True if an executed shell command opens a PR on one of the hosts create-pr supports. */
export function isPrCreate(cmd) {
  return typeof cmd === 'string' && (
    /\bgh\s+pr\s+create\b/.test(cmd) ||                                          // github
    /\bglab\s+mr\s+create\b/.test(cmd) ||                                        // gitlab
    (/api\.bitbucket\.org/.test(cmd) && /pullrequests\b/.test(cmd) && /\bPOST\b/.test(cmd)) // bitbucket REST
  );
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
