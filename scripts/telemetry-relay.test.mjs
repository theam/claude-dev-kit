/*
 * Relay input checks. The handler is called with a fake request and response.
 * Each case loads a fresh module so the API key is read from the environment
 * of that case.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HANDLER = pathToFileURL(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'packages', 'telemetry-relay', 'api', 'ingest.js'),
).href;

const VALID_ID = 'b1c3f0a2-1234-4abc-8def-0123456789ab';
const HEADER_IP = '203.0.113.9';
const HEADER_AUTH = 'Bearer relay-header-secret';

let loadSeq = 0;

async function loadHandler() {
  const mod = await import(`${HANDLER}?case=${++loadSeq}`);
  return mod.default;
}

function fakeCall(handler, { method = 'POST', body, headers = {} } = {}) {
  const res = {
    statusCode: 200,
    payload: undefined,
    setHeader() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; },
  };
  const req = { method, body, headers };
  return Promise.resolve(handler(req, res)).then(() => res);
}

function baseBody(overrides = {}) {
  return {
    event_name: 'kit_session_completed',
    install_id: VALID_ID,
    properties: {
      schema_version: 1,
      os: 'linux',
      tokens_input: 1,
      tokens_output: 2,
      tokens_cache_read: 3,
      tokens_cache_creation: 4,
      tokens_total: 10,
    },
    ...overrides,
  };
}

describe('telemetry relay ingest', { concurrency: false }, () => {
  test('a UUID install id is accepted and forwarded as distinct_id', async () => {
    process.env.POSTHOG_API_KEY = 'ph_test_key';
    delete process.env.POSTHOG_HOST;
    let forwarded;
    globalThis.fetch = async (_url, init) => {
      forwarded = JSON.parse(init.body);
      return { ok: true };
    };
    const handler = await loadHandler();
    const res = await fakeCall(handler, {
      body: baseBody(),
      headers: { 'x-forwarded-for': HEADER_IP, authorization: HEADER_AUTH },
    });
    assert.equal(res.statusCode, 202);
    assert.equal(forwarded.distinct_id, VALID_ID);
    assert.equal(forwarded.event, 'kit_session_completed');
  });

  test('an email, a path, or 64 arbitrary characters are rejected', async () => {
    process.env.POSTHOG_API_KEY = 'ph_test_key';
    delete process.env.POSTHOG_HOST;
    const handler = await loadHandler();
    const rejected = [
      'dev@example.com',
      '/home/dev/.ssh/id_ed25519',
      'a'.repeat(64),
    ];
    for (const installId of rejected) {
      let called = false;
      globalThis.fetch = async () => { called = true; return { ok: true }; };
      const res = await fakeCall(handler, { body: baseBody({ install_id: installId }) });
      assert.equal(res.statusCode, 400, installId);
      assert.equal(called, false, installId);
    }
  });

  test('unknown properties and out-of-list enums are dropped', async () => {
    process.env.POSTHOG_API_KEY = 'ph_test_key';
    delete process.env.POSTHOG_HOST;
    let forwarded;
    globalThis.fetch = async (_url, init) => {
      forwarded = JSON.parse(init.body);
      return { ok: true };
    };
    const handler = await loadHandler();
    const res = await fakeCall(handler, {
      body: baseBody({
        properties: {
          schema_version: 1,
          os: 'solaris',
          agent: 'not-a-host',
          tracker_type: 'PROJ-123',
          email: 'hidden@example.com',
          repo: 'theam/facility',
          tokens_input: 1,
          tokens_output: 2,
          tokens_cache_read: 3,
          tokens_cache_creation: 4,
          tokens_total: 10,
        },
      }),
    });
    assert.equal(res.statusCode, 202);
    const props = forwarded.properties;
    assert.equal(props.os, undefined);
    assert.equal(props.agent, undefined);
    assert.equal(props.tracker_type, undefined);
    assert.equal(props.email, undefined);
    assert.equal(props.repo, undefined);
    assert.equal(props.tokens_input, 1);
  });

  test('negative and non-finite integers are dropped', async () => {
    process.env.POSTHOG_API_KEY = 'ph_test_key';
    delete process.env.POSTHOG_HOST;
    let forwarded;
    globalThis.fetch = async (_url, init) => {
      forwarded = JSON.parse(init.body);
      return { ok: true };
    };
    const handler = await loadHandler();
    const res = await fakeCall(handler, {
      body: baseBody({
        properties: {
          schema_version: 1,
          os: 'linux',
          tokens_input: -5,
          tokens_output: Number.POSITIVE_INFINITY,
          tokens_cache_read: Number.NaN,
          tokens_cache_creation: 4,
          tokens_total: 4,
        },
      }),
    });
    assert.equal(res.statusCode, 202);
    const props = forwarded.properties;
    assert.equal(props.tokens_input, undefined);
    assert.equal(props.tokens_output, undefined);
    assert.equal(props.tokens_cache_read, undefined);
    assert.equal(props.tokens_cache_creation, 4);
    assert.equal(props.tokens_total, 4);
  });

  test('a wrong event name is rejected', async () => {
    process.env.POSTHOG_API_KEY = 'ph_test_key';
    delete process.env.POSTHOG_HOST;
    let called = false;
    globalThis.fetch = async () => { called = true; return { ok: true }; };
    const handler = await loadHandler();
    const res = await fakeCall(handler, {
      body: baseBody({ event_name: 'kit_session_started' }),
    });
    assert.equal(res.statusCode, 400);
    assert.equal(called, false);
  });

  test('a missing API key is refused before anything is forwarded', async () => {
    delete process.env.POSTHOG_API_KEY;
    delete process.env.POSTHOG_HOST;
    let called = false;
    globalThis.fetch = async () => { called = true; return { ok: true }; };
    const handler = await loadHandler();
    const res = await fakeCall(handler, { body: baseBody() });
    assert.equal(res.statusCode, 503);
    assert.equal(called, false);
  });

  test('the forwarded payload has no IP and no request header value', async () => {
    process.env.POSTHOG_API_KEY = 'ph_test_key';
    delete process.env.POSTHOG_HOST;
    let forwarded;
    globalThis.fetch = async (_url, init) => {
      forwarded = JSON.parse(init.body);
      return { ok: true };
    };
    const handler = await loadHandler();
    const res = await fakeCall(handler, {
      body: baseBody({ ip: HEADER_IP, org: 'acme' }),
      headers: {
        'x-forwarded-for': HEADER_IP,
        'x-real-ip': '198.51.100.20',
        authorization: HEADER_AUTH,
        cookie: 'session=abc',
      },
    });
    assert.equal(res.statusCode, 202);
    const encoded = JSON.stringify(forwarded);
    assert.equal(encoded.includes(HEADER_IP), false);
    assert.equal(encoded.includes('198.51.100.20'), false);
    assert.equal(encoded.includes(HEADER_AUTH), false);
    assert.equal(encoded.includes('session=abc'), false);
    assert.equal(Object.hasOwn(forwarded, 'ip'), false);
    assert.equal(Object.hasOwn(forwarded.properties, 'ip'), false);
    assert.equal(forwarded.distinct_id, VALID_ID);
    assert.equal(forwarded.properties.org, 'acme');
  });
});
