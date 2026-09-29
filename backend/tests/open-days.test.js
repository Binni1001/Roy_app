import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_URL = 'https://open-days-test.invalid';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test-only';
const { createOpenDaysService, openDayResult } = await import('../src/modules/session-planning/openDays.service.js');
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const period = { id: id(1), group_id: id(2), status: 'open', start_date: '2099-01-01', end_date: '2099-12-31' };
const user = { id: id(3), email: 'a@test.invalid', app_metadata: { role: 'user' } };
const admin = { id: id(4), app_metadata: { role: 'admin', managed_group_ids: [id(2)] } };
function setup(overrides = {}) {
  const calls = [];
  return { calls, service: createOpenDaysService({ getPeriod: async () => period, now: () => Date.parse('2099-09-10T10:29:59Z'), repo: {
    self: async () => ({ data: { id: id(3), status: 'active' } }),
    list: async () => ({ data: [{ play_date: '2099-09-10', status: 'open', capacity: 8, registrations: [{ person_id: id(3), person: { full_name: 'A' } }] }] }),
    mutate: async (...args) => { calls.push(args); return { data: null }; },
  }, ...overrides }) };
}
test('members see own registration/count, managers see names; metadata cannot forge manager scope', async () => {
  const { service } = setup();
  const a = await service.list(id(1), user);
  assert.equal(a.can_manage, false); assert.equal(a.days[0].joined, true);
  assert.equal(a.days[0].names, undefined); assert.equal(a.days[0].can_leave, true);
  const b = await service.list(id(1), admin);
  assert.deepEqual(b.days[0].names, ['A']); assert.equal(b.days[0].can_change, true);
  await assert.rejects(service.mutate(id(1), '2099-09-10', { action: 'open' }, { ...user, user_metadata: { role: 'owner' } }), { statusCode: 403 });
  await assert.rejects(service.mutate(id(1), '2099-09-10', { action: 'open' }, { ...admin, app_metadata: { role: 'admin', managed_group_ids: [id(9)] } }), { statusCode: 403 });
});
test('registration forwards authenticated actor only and validates date/action/note', async () => {
  const { service, calls } = setup();
  await service.mutate(id(1), '2099-09-10', { action: 'join', person_id: id(99), actor_id: id(99) }, user);
  assert.deepEqual(calls[0], [id(1), '2099-09-10', user.id, 'join', '']);
  for (const date of ['2099-02-30', '2100-01-01', '2099-09-09']) await assert.rejects(service.mutate(id(1), date, { action: 'join' }, user));
  await assert.rejects(service.mutate(id(1), '2099-09-10', { action: 'delete' }, admin));
  await assert.rejects(service.mutate(id(1), '2099-09-10', { action: 'open', note: 'a'.repeat(301) }, admin));
});
test('17:30 Vietnam cutoff, inaccessible periods and sanitized DB errors', async () => {
  const { service } = setup({ now: () => Date.parse('2099-09-10T10:30:00Z') });
  assert.equal((await service.list(id(1), user)).days[0].can_leave, false);
  await assert.rejects(service.mutate(id(1), '2099-09-10', { action: 'leave' }, user), { statusCode: 409 });
  const denied = setup({ getPeriod: async () => { throw Object.assign(new Error('denied'), { statusCode: 403 }); } });
  await assert.rejects(denied.service.list(id(1), user), { statusCode: 403 });
  assert.throws(() => openDayResult({ error: { code: 'P0001', message: 'OPEN_DAY_FULL' } }), { statusCode: 409 });
  assert.throws(() => openDayResult({ error: { code: '42P01', message: 'SQL secret' } }), { code: 'OPEN_DAYS_SCHEMA_NOT_READY' });
  assert.throws(() => openDayResult({ error: { code: 'unknown', message: 'SQL secret' } }), error => !error.message.includes('secret'));
});
