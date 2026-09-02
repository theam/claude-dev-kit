// Empirical summary of eval runs: per scenario — duration, turns, tools,
// gh calls, and the assistant's final text. Reads results/*.jsonl + logs/.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const scen of ['s2-control', 's1-gate', 's3-clean']) {
  const f = join(ROOT, 'results', `${scen}.jsonl`);
  if (!existsSync(f)) { console.log(`\n=== ${scen}: no results ===`); continue; }
  const evs = readFileSync(f, 'utf8').split('\n').filter(Boolean).flatMap(l => {
    try { return [JSON.parse(l)]; } catch { return []; }
  });
  const tools = evs
    .filter(e => e.type === 'assistant' && e.message?.content)
    .flatMap(e => e.message.content)
    .filter(c => c.type === 'tool_use');
  const toolCounts = {};
  for (const t of tools) toolCounts[t.name] = (toolCounts[t.name] || 0) + 1;
  const bash = tools.filter(t => t.name === 'Bash').map(t => t.input?.command);
  const texts = evs
    .filter(e => e.type === 'assistant' && e.message?.content)
    .flatMap(e => e.message.content)
    .filter(c => c.type === 'text')
    .map(c => c.text);
  const result = evs.find(e => e.type === 'result');
  const log = join(ROOT, 'logs', `${scen}-gh-calls.log`);
  const ghLines = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter(Boolean) : [];

  console.log(`\n=== ${scen} ===`);
  console.log(`events=${evs.length} num_turns=${result?.num_turns ?? '?'} duration_ms=${result?.duration_ms ?? '?'} cost_usd=${result?.total_cost_usd ?? '?'}`);
  console.log(`tools: ${JSON.stringify(toolCounts)}`);
  console.log(`bash commands (${bash.length}):`);
  for (const c of bash) console.log(`  $ ${c}`);
  console.log(`gh stub log (${ghLines.length}):`);
  for (const l of ghLines) console.log(`  ${l}`);
  console.log(`final assistant text:\n---\n${texts.at(-1) ?? '(none)'}\n---`);
}
