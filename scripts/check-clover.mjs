#!/usr/bin/env node
/*
 * check-clover — enforce the kit's per-file coverage bar on a Clover report.
 *
 * Zero-dep, so the stack matrix (.github/workflows/stacks.yml) can enforce the
 * coverage gate on any sample that emits Clover XML (PHP today; stacks with
 * other formats get their own small checker when their row lands).
 *
 *   node scripts/check-clover.mjs <coverage.xml> [bar]
 *
 * Per file: line coverage = coveredstatements/statements from the file-level
 * <metrics> (the LAST metrics element in the file block — the first is the
 * class-level one). Branch coverage comes from conditionals when the driver
 * reports them; PHPUnit under PCOV always writes conditionals="0" (branch
 * data needs Xdebug path coverage), and "the driver reported none" is n/a,
 * not a failure — stated plainly, never fabricated. Attribute parsing is
 * order-independent: Clover writers do not agree on attribute order.
 */
import { readFileSync } from 'node:fs';

export function parseClover(xml) {
  const files = [];
  const re = /<file name="([^"]+)"[^>]*>([\s\S]*?)<\/file>/g;
  for (const [, name, body] of xml.matchAll(re)) {
    const metrics = [...body.matchAll(/<metrics([^>]*?)\/?>/g)];
    if (metrics.length === 0) continue;
    const attrs = metrics[metrics.length - 1][1];
    const attr = (key) => {
      const found = attrs.match(new RegExp(`\\b${key}="(\\d+)"`));
      return found ? Number(found[1]) : null;
    };
    const statements = attr('statements');
    const covered = attr('coveredstatements');
    if (statements === null || covered === null) continue;
    const conditionals = attr('conditionals') ?? 0;
    const coveredConditionals = attr('coveredconditionals') ?? 0;
    files.push({
      name,
      lines: statements === 0 ? 100 : (covered / statements) * 100,
      // null = the driver reported no branch data (e.g. PCOV) — n/a, not 0%.
      branches: conditionals === 0 ? null : (coveredConditionals / conditionals) * 100,
    });
  }
  return files;
}

export function verdicts(files, bar) {
  return files.map((file) => ({
    ...file,
    pass: file.lines >= bar && (file.branches === null || file.branches >= bar),
  }));
}

const invokedDirectly =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (invokedDirectly) {
  const [reportPath, barArg] = process.argv.slice(2);
  if (!reportPath) {
    console.error('usage: check-clover.mjs <coverage.xml> [bar]');
    process.exit(1);
  }
  const bar = Number(barArg ?? 95);
  const rows = verdicts(parseClover(readFileSync(reportPath, 'utf8')), bar);
  if (rows.length === 0) {
    console.error(`no per-file metrics found in ${reportPath} — is it Clover XML?`);
    process.exit(1);
  }
  for (const row of rows) {
    const branches = row.branches === null ? 'n/a (driver reports none)' : `${row.branches.toFixed(1)}%`;
    console.log(
      `${row.pass ? 'PASS' : 'FAIL'}  lines ${row.lines.toFixed(1)}%  branches ${branches}  ${row.name}`,
    );
  }
  const failed = rows.filter((row) => !row.pass);
  if (failed.length > 0) {
    console.error(`\n${failed.length} file(s) below the ${bar}% bar.`);
    process.exit(1);
  }
  console.log(`\nAll ${rows.length} file(s) meet the ${bar}% bar.`);
}
