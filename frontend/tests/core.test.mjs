import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentStats } from '../lib/grading.ts';
import { schoolDate } from '../lib/dates.ts';
import { apiFetch } from '../lib/api.ts';

test('gradebook uses percentage weights and includes missing items', () => {
  const result = componentStats([{ id: 1, max_score: '10' }, { id: 2, max_score: '10' }], { 1: '10' }, 30);
  assert.equal(result.ps, 50);
  assert.equal(result.ws, 15);
  assert.equal(componentStats([{ id: 1, max_score: '10' }], { 1: '10' }, 30).ws, 30);
  assert.equal(componentStats([], {}, 30).ws, 0);
});
test('school calendar dates preserve their calendar day', () => {
  for (const value of ['2026-10-10', '2026-10-10T00:00:00.000Z']) {
    const date = schoolDate(value);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 9);
    assert.equal(date.getDate(), 10);
  }
});
test('requests trap invalid responses, handle duplicate writes, and preserve Excel downloads', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const events = [];
  globalThis.window = { setTimeout, clearTimeout, dispatchEvent: event => events.push(event.detail) };
  try {
    globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502 });
    await assert.rejects(apiFetch('/api/settings'), /unexpected response/);
    assert.equal(events.at(-1).kind, 'error');
    globalThis.fetch = async () => new Response('{', { headers: { 'Content-Type': 'application/json' } });
    await assert.rejects(apiFetch('/api/settings'), /unreadable response/);
    globalThis.fetch = async () => new Response('xlsx', { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } });
    assert.equal(await (await apiFetch('/api/faculty/advisory-class/sf1')).text(), 'xlsx');
    let finish;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = apiFetch('/api/settings', { method: 'PUT' });
    await assert.rejects(apiFetch('/api/settings', { method: 'PUT' }), /still being processed/);
    finish(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    await pending;
  } finally { globalThis.fetch = originalFetch; globalThis.window = originalWindow; }
});
test('expired authenticated requests clear only session storage and redirect to login', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const originalStorage = globalThis.localStorage;
  const values = new Map([['token', 'expired'], ['role_id', '1'], ['reset_token', 'old'], ['preference', 'keep']]);
  let destination;
  globalThis.localStorage = { removeItem: key => values.delete(key) };
  globalThis.window = { setTimeout, clearTimeout, dispatchEvent() {}, location: { replace: value => { destination = value; } } };
  globalThis.fetch = async () => new Response('{"error":"Session expired"}', { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    assert.equal((await apiFetch('/api/settings', { headers: { Authorization: 'Bearer expired' } })).status, 401);
    assert.equal(destination, '/login?expired=1');
    assert.deepEqual([...values], [['preference', 'keep']]);
  } finally { globalThis.fetch = originalFetch; globalThis.window = originalWindow; globalThis.localStorage = originalStorage; }
});
