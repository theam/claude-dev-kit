/*
 * pr-cost — price a session's token usage and render the PR "Cost" section.
 *
 * Pure functions over a usage record (see session-usage.mjs) and the price table
 * (model-prices.json). A model the table does not list, or a token class it has no rate
 * for, is shown as tokens only — the estimate never guesses a price.
 *
 * The rendered section goes into a PR body, which is public in a public repo: it carries
 * model ids and counts only, never paths, branch names, or anything from the transcript.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addTokens, emptyTokens, totalTokens } from './session-usage.mjs';

export const MODES = ['full', 'tokens', 'off'];
export const DEFAULT_MODE = 'full';

export function loadPriceTable(path = join(dirname(fileURLToPath(import.meta.url)), 'model-prices.json')) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/*
 * A dated snapshot (`-20251101`, `@20251101`) or a bracketed variant (`[1m]`) names the
 * same model. Nothing looser: `claude-fable-5` must not price `claude-fable-5-1`.
 */
const SUFFIX = /(?:-\d{8}|@\d{8}|\[[0-9a-z]{1,8}\])$/;

/** The table entry for a model id, or undefined when the table does not list it. */
export function priceFor(model, table) {
  const models = table?.models || {};
  let id = String(model || '');
  for (let i = 0; i < 3 && id; i++) {
    if (Object.hasOwn(models, id)) return models[id];
    if (!SUFFIX.test(id)) break;
    id = id.replace(SUFFIX, '');
  }
  return undefined;
}

/**
 * Which variant of a model's rates applies to one message, for the parsers' `variantOf`.
 * Fast mode first (it applies across the whole context), then a long-prompt tier.
 */
export function variantOfFor(table) {
  return (model, { promptTokens = 0, speed } = {}) => {
    if (speed === 'fast') return 'fast'; // priced only if the table lists a fast rate
    const lp = priceFor(model, table)?.long_prompt;
    if (lp && promptTokens > lp.above) return 'long_prompt';
    return undefined;
  };
}

const RATE = { input: 'input', output: 'output', cacheRead: 'cache_read', cacheWrite: 'cache_write', cacheWrite1h: 'cache_write_1h' };

/** USD for a token count at a rate card, or null when a non-zero class has no rate. */
export function costAt(tokens, rates) {
  if (!rates) return totalTokens(tokens) === 0 ? 0 : null;
  let usd = 0;
  for (const [field, key] of Object.entries(RATE)) {
    const n = tokens[field] || 0;
    if (!n) continue;
    if (typeof rates[key] !== 'number') return null;
    usd += (n * rates[key]) / 1e6;
  }
  return usd;
}

/**
 * Estimated cost of a usage record. A model is either fully priced or listed in
 * `unpriced` — never part-priced.
 * @returns {{ total: number, perModel: Record<string, number>, unpriced: string[] }}
 */
export function estimate(usage, table) {
  const perModel = {};
  const unpriced = [];
  let total = 0;
  for (const [model, m] of Object.entries(usage.models)) {
    const entry = priceFor(model, table);
    let usd = entry ? 0 : null;
    const base = addTokens(emptyTokens(), m);
    for (const [variant, t] of Object.entries(m.variants || {})) {
      if (usd === null) break;
      const c = costAt(t, entry[variant]);
      usd = c === null ? null : usd + c;
      for (const k of Object.keys(base)) base[k] -= t[k] || 0;
    }
    if (usd !== null) {
      const c = costAt(base, entry);
      usd = c === null ? null : usd + c;
    }
    if (usd === null) { unpriced.push(model); continue; }
    perModel[model] = usd;
    total += usd;
  }
  return { total, perModel, unpriced };
}

/**
 * Whether the counted sessions cover the whole story. Partial when another local session
 * worked the branch, or the branch has commits authored before this session started.
 * @param {{ sessionStart?: number, commitTimes?: number[], otherSessions?: number }} p
 *        sessionStart in ms; commitTimes are author times in seconds (git %at)
 */
export function partiality({ sessionStart, commitTimes = [], otherSessions = 0 }) {
  const earlierCommits = sessionStart !== undefined && commitTimes.some((s) => s * 1000 < sessionStart);
  return { partial: earlierCommits || otherSessions > 0, earlierCommits, otherSessions };
}

export function formatCount(n) {
  if (n < 1000) return String(n);
  if (n < 1e6) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  if (n < 1e9) return `${(n / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  return `${(n / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
}

export const formatUsd = (usd) => (usd > 0 && usd < 0.01 ? '< $0.01' : `$${usd.toFixed(2)}`);

/*
 * Model ids come from a transcript, and a host lets people set any string (a local path,
 * a cloud ARN, a private deployment name, an @-mention). Only an id the price table knows
 * is printed; every other model is shown under a generic label, with its token counts.
 */
export const OTHER_MODELS = 'other models (not in the kit\'s price table)';
export const displayModel = (id, table) => (priceFor(id, table) ? String(id) : OTHER_MODELS);

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function tokenLine(t) {
  const parts = [`${formatCount(t.input)} input`, `${formatCount(t.output)} output`];
  if (t.cacheRead) parts.push(`${formatCount(t.cacheRead)} cache read`);
  const writes = (t.cacheWrite || 0) + (t.cacheWrite1h || 0);
  if (writes) parts.push(`${formatCount(writes)} cache write`);
  return parts.join(' · ');
}

/**
 * The PR body's "### Cost" section, or '' when the mode is `off`.
 * @param {{ usage: object, mode?: string, table?: object, subagents?: number,
 *           partial?: { partial: boolean, earlierCommits: boolean, otherSessions: number } }} p
 */
export function formatCostSection({ usage, mode = DEFAULT_MODE, table, subagents = 0, partial }) {
  if (mode === 'off') return '';
  const lines = ['### Cost', ''];
  // Unknown ids are folded into one generic row before anything is printed.
  const rows = new Map();
  for (const [id, m] of Object.entries(usage.models)) {
    const name = displayModel(id, table);
    addTokens((rows.get(name) || rows.set(name, emptyTokens()).get(name)), m);
  }
  const models = [...rows.entries()].sort((a, b) => totalTokens(b[1]) - totalTokens(a[1]));
  if (!models.length) {
    lines.push('Not available: the session transcript has no token usage.');
    return `${lines.join('\n')}\n`;
  }
  const est = mode === 'full' ? estimate(usage, table) : null;
  if (est) {
    const date = table?.as_of || 'unknown date';
    const priced = Object.keys(est.perModel).length;
    if (!priced) {
      lines.push(`No cost estimate: the kit's price table (as of ${date}) has no list price for the models used.`);
    } else {
      const only = est.unpriced.length ? ' for the priced models only' : '';
      lines.push(`≈ ${formatUsd(est.total)} estimated API-equivalent cost${only}, at list prices as of ${date}. An estimate: subscription plans are billed differently.`);
    }
    lines.push('');
  }
  for (const [name, m] of models) {
    // A listed model can still be unpriced (a token class or variant with no rate).
    const unpriced = est && (name === OTHER_MODELS || est.unpriced.includes(name));
    lines.push(`- ${name}: ${tokenLine(m)}${unpriced ? ' — tokens only, no estimate' : ''}`);
  }
  const scope = subagents ? `this session and ${plural(subagents, 'subagent')}` : 'this session';
  lines.push(`- Scope: ${scope}, measured when the PR was opened. Computed locally from the session transcript; nothing was sent anywhere.`);
  if (partial?.partial) {
    const why = [];
    if (partial.otherSessions) why.push(`${plural(partial.otherSessions, 'other local session')} also worked this branch`);
    if (partial.earlierCommits) why.push('the branch has commits from before this session');
    lines.push(`- Partial: ${why.join(', and ')}. Those tokens are not included.`);
  }
  return `${lines.join('\n')}\n`;
}
