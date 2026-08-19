/*
 * The telemetry contract exists in two places — telemetry/contract.v1.json (what the
 * client reads for the relay URL / documents) and packages/telemetry-relay/contract.v1.json
 * (what the relay bundles and enforces). They MUST stay byte-identical: if they drift, the
 * client can send a property the relay silently drops (or vice-versa). This guards that.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('the two telemetry contract copies are byte-identical', () => {
  const client = readFileSync(join(ROOT, 'telemetry', 'contract.v1.json'));
  const relay = readFileSync(join(ROOT, 'packages', 'telemetry-relay', 'contract.v1.json'));
  assert.ok(
    client.equals(relay),
    'telemetry/contract.v1.json and packages/telemetry-relay/contract.v1.json differ — keep them in sync (a property in one but not the other is sent-but-dropped)',
  );
});
