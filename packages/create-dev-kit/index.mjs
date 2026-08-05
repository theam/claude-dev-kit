#!/usr/bin/env node
/*
 * create-dev-kit — interactive setup for the claude-dev-kit plugin.
 *
 * Zero dependencies (only Node built-ins) so it is trivial to audit before you
 * run it via `npm create @theagilemonkeys/dev-kit`. It writes two files:
 *   - <repo>/.claude/dev-kit.json           (tracker choice, figma flag, org label)
 *   - ~/.claude/dev-kit-telemetry/config.json  (your telemetry consent — per user)
 * and can run the plugin install commands for you. It never sends anything itself.
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout, exit } from 'node:process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const rl = createInterface({ input: stdin, output: stdout });
const b = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

async function ask(q, def) {
  const a = (await rl.question(`${q}${def ? dim(` (${def})`) : ''} `)).trim();
  return a || def || '';
}
async function yn(q, def = true) {
  const a = (await ask(`${q} ${def ? '[Y/n]' : '[y/N]'}`)).toLowerCase();
  if (!a) return def;
  return a.startsWith('y');
}
function mergeJson(path, patch) {
  let cur = {};
  if (existsSync(path)) { try { cur = JSON.parse(readFileSync(path, 'utf8')); } catch { cur = {}; } }
  const next = { ...cur, ...patch };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n');
  return next;
}

const KIT_REPO = 'https://github.com/theam/claude-dev-kit';
const KIT_HOME = join(homedir(), '.dev-kit'); // stable, version-independent anchor for Codex

function have(cmd, args = ['--version']) {
  try { const r = spawnSync(cmd, args, { stdio: 'ignore' }); return !r.error && (r.status === 0 || r.status === null); }
  catch { return false; }
}

// Codex integration (experimental). Codex doesn't load Claude Code plugins, so we
// anchor a stable checkout at ~/.dev-kit and point Codex's hooks + skills at it.
async function maybeSetupCodex(consent) {
  const codexPresent = have('codex') || existsSync(join(homedir(), '.codex'));
  if (!codexPresent) return;
  console.log(`\n${b('6. Codex (also detected)')} ${dim('(experimental — validated on Claude, verify on your Codex version)')}`);
  if (!await yn('   Set the kit up for Codex too (CLI + VS Code)?', true)) return;
  if (!have('git')) { console.log(dim('   git not found — skipping Codex setup. Install git and re-run.')); return; }

  // 1. Stable kit checkout (Codex hooks/skills point here; survives version bumps)
  if (existsSync(join(KIT_HOME, '.git'))) {
    console.log(dim(`   $ git -C ${KIT_HOME} pull --ff-only`));
    spawnSync('git', ['-C', KIT_HOME, 'pull', '--ff-only'], { stdio: 'inherit' });
  } else {
    console.log(dim(`   $ git clone --depth 1 ${KIT_REPO} ${KIT_HOME}`));
    const r = spawnSync('git', ['clone', '--depth', '1', KIT_REPO, KIT_HOME], { stdio: 'inherit' });
    if (r.error || r.status !== 0) { console.log(dim('   clone failed — skipping Codex setup.')); return; }
  }

  // 2. Telemetry hooks → ~/.codex/hooks.json (merge; never clobber existing hooks)
  const codexHooksPath = join(homedir(), '.codex', 'hooks.json');
  try {
    const rendered = JSON.parse(
      readFileSync(join(KIT_HOME, 'codex', 'hooks.json'), 'utf8').replaceAll('{{DEVKIT_ROOT}}', KIT_HOME));
    let cur = {};
    if (existsSync(codexHooksPath)) { try { cur = JSON.parse(readFileSync(codexHooksPath, 'utf8')); } catch { cur = {}; } }
    cur.hooks = cur.hooks || {};
    for (const [ev, arr] of Object.entries(rendered.hooks || {})) {
      const kept = (cur.hooks[ev] || []).filter((h) => !JSON.stringify(h).includes('telemetry.mjs')); // drop our old entry on re-run
      cur.hooks[ev] = [...kept, ...arr];
    }
    mkdirSync(dirname(codexHooksPath), { recursive: true });
    writeFileSync(codexHooksPath, JSON.stringify(cur, null, 2) + '\n');
    console.log(`   • ${codexHooksPath} ${dim('(telemetry hooks — need a one-time /hooks trust)')}`);
  } catch (e) { console.log(dim('   could not write Codex hooks: ' + (e?.message || e))); }

  // 3. Skills → ~/.agents/skills/<name>/ (same SKILL.md files as the Claude side)
  try {
    const src = join(KIT_HOME, 'skills');
    const dst = join(homedir(), '.agents', 'skills');
    mkdirSync(dst, { recursive: true });
    let n = 0;
    for (const name of readdirSync(src)) {
      if (!existsSync(join(src, name, 'SKILL.md'))) continue;
      cpSync(join(src, name), join(dst, name), { recursive: true });
      n++;
    }
    console.log(`   • ${dst} ${dim(`(${n} skills)`)}`);
  } catch (e) { console.log(dim('   could not copy skills: ' + (e?.message || e))); }

  console.log(dim(
    '\n   One manual step Codex requires (it won\'t run untrusted hooks):\n' +
    '     • open a Codex session and run  /hooks  → review & trust the dev-kit telemetry hook\n' +
    '   Then Codex sessions report the same anonymous, opt-in telemetry (tagged agent: codex).'));
  if (!consent) console.log(dim('   (telemetry is OFF right now — the hook stays inert until you opt in)'));
}

async function main() {
  console.log(`\n${b('claude-dev-kit setup')}\n${dim('Issue-to-PR workflow for Claude Code & Codex — by The Agile Monkeys')}\n`);

  // 1. Issue tracker
  console.log(b('1. Issue tracker'));
  const trackers = { 1: 'jira', 2: 'linear', 3: 'github', 4: 'azure', 5: null };
  console.log('   1) Jira');
  console.log('   2) Linear');
  console.log('   3) GitHub Issues');
  console.log('   4) Azure DevOps');
  console.log('   5) None');
  let tChoice = await ask('   Which tracker does this repo use?', '1');
  const tracker = trackers[tChoice] ?? 'jira';

  const TRACKER_HINT = {
    jira: 'To connect Jira, authorize the Atlassian MCP after installing:\n     • in a Claude Code session: /mcp → authorize "atlassian"\n     • or from the terminal: claude mcp login atlassian\n     • already connected in Claude Desktop? claude mcp add-from-claude-desktop',
    linear: 'To connect Linear, authorize the Linear MCP after installing:\n     • /mcp → authorize "linear"   (or: claude mcp login linear)',
    github: 'To connect GitHub Issues, just authenticate the GitHub CLI:\n     • gh auth login   (no MCP needed)',
    azure: 'To connect Azure DevOps, authenticate the Azure CLI:\n     • az login   (no MCP needed)',
  };
  if (TRACKER_HINT[tracker]) console.log(dim('   → ' + TRACKER_HINT[tracker]));

  // 2. Pull request host
  console.log(`\n${b('2. Pull request host')}`);
  const hosts = { 1: 'github', 2: 'bitbucket', 3: 'gitlab', 4: null };
  console.log('   1) GitHub');
  console.log('   2) Bitbucket');
  console.log('   3) GitLab');
  console.log('   4) Other / none');
  const hChoice = await ask('   Where do pull requests live?', '1');
  const prHost = hosts[hChoice] ?? 'github';
  const HOST_HINT = {
    github: 'Authenticate the GitHub CLI: gh auth login',
    bitbucket: 'Bitbucket: create an app password / access token and export it (e.g. BITBUCKET_TOKEN).\n     The kit pushes with git and opens the PR via the Bitbucket REST API.',
    gitlab: 'Authenticate the GitLab CLI: glab auth login',
  };
  if (HOST_HINT[prHost]) console.log(dim('   → ' + HOST_HINT[prHost]));

  // 3. Figma
  console.log(`\n${b('3. Design')}`);
  const figma = await yn('   Will you link Figma designs in tickets?', false);

  // 4. Telemetry — informed consent
  console.log(`\n${b('4. Anonymous usage telemetry')} ${dim('(optional)')}`);
  console.log(dim(
    '   If you opt in, at the end of sessions where the kit runs it sends, to\n' +
    '   The Agile Monkeys via a relay:\n' +
    '     • token counts, a coarse session-duration bucket\n' +
    '     • kit version, Claude Code version, OS, tracker category\n' +
    '     • a random install id (no account, email, or machine data)\n' +
    "   It NEVER sends prompts, code, file names, repo names, ticket content,\n" +
    '   emails, org-instance data, or your IP (stripped at the relay).\n' +
    '   Off unless you say yes. Details: TELEMETRY.md. Turn off later: DEVKIT_TELEMETRY=0.'
  ));
  const consent = await yn('   Share anonymous usage telemetry?', false);

  // 5. Organisation label (only meaningful if telemetry is on)
  let org = '';
  if (consent) {
    console.log(`\n${b('5. Organisation')} ${dim('(optional — attributes your usage to your company, not a person)')}`);
    org = await ask('   Organisation label to tag your usage (leave empty to stay unattributed):', '');
  }

  // --- Write repo config ---------------------------------------------------
  const repoCfgPath = join(process.cwd(), '.claude', 'dev-kit.json');
  const repoPatch = { figma };
  if (tracker) repoPatch.tracker = { type: tracker };
  if (prHost) repoPatch.prHost = prHost;
  if (org.trim()) repoPatch.telemetry = { org: org.trim().slice(0, 64) };
  mergeJson(repoCfgPath, repoPatch);

  // --- Write per-user telemetry consent ------------------------------------
  const consentPath = join(homedir(), '.claude', 'dev-kit-telemetry', 'config.json');
  let installId = randomUUID();
  if (existsSync(consentPath)) {
    try { installId = JSON.parse(readFileSync(consentPath, 'utf8')).install_id || installId; } catch { /* ignore */ }
  }
  mergeJson(consentPath, {
    schema_version: 1,
    consent: consent ? 'granted' : 'denied',
    install_id: installId,
    // Also store org at the user level so attribution works in every repo/worktree,
    // not only where a committed .claude/dev-kit.json carries telemetry.org.
    ...(org.trim() ? { org: org.trim().slice(0, 64) } : {}),
  });

  // --- Report + offer to install ------------------------------------------
  console.log(`\n${b('Done.')}`);
  console.log(`  • ${repoCfgPath} ${dim('(commit this — shared by your team)')}`);
  console.log(`  • ${consentPath} ${dim('(per-user, private — telemetry ' + (consent ? 'ON' : 'OFF') + ')')}`);

  if (await yn('\nInstall the plugin now with the Claude CLI?', true)) {
    for (const args of [
      ['plugin', 'marketplace', 'add', 'theam/claude-dev-kit'],
      ['plugin', 'install', 'fullstack-dev-kit@claude-dev-kit'],
    ]) {
      console.log(dim(`  $ claude ${args.join(' ')}`));
      const r = spawnSync('claude', args, { stdio: 'inherit' });
      if (r.error) {
        console.log(`  ${dim('claude CLI not found — run these two commands yourself:')}`);
        console.log('    claude plugin marketplace add theam/claude-dev-kit');
        console.log('    claude plugin install fullstack-dev-kit@claude-dev-kit');
        break;
      }
    }
  } else {
    console.log(dim('\n  Install later with:'));
    console.log('    claude plugin marketplace add theam/claude-dev-kit');
    console.log('    claude plugin install fullstack-dev-kit@claude-dev-kit');
  }

  await maybeSetupCodex(consent);

  console.log(`\n${dim('Restart your Claude session, then run')} ${b('/fullstack-dev-kit:work-story <TICKET>')}\n`);
}

main().catch((e) => { console.error(e?.message || e); exit(1); }).finally(() => rl.close());
