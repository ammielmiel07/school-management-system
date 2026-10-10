const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

process.env.JWT_SECRET = 'isolated-test-secret';
let user;
let passwordHash;
let handler;
let connectionError;
let emailFails;
let calls = [];
let released = 0;
const settings = { current_school_year: '2026-2027', active_trisemester: 1 };
async function query(sql, values, connection = 'pool') {
    calls.push({ sql, values, connection });
    if (sql.startsWith('SELECT id, role_id, password_hash, requires_password_change')) return { rows: user ? [user] : [] };
    if (sql === 'SELECT * FROM system_settings LIMIT 1') return { rows: [settings] };
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    return handler(sql, values);
}
require.cache[require.resolve('../db')] = { exports: {
    query,
    connect: async () => {
        if (connectionError) throw connectionError;
        return { query: (sql, values) => query(sql, values, 'client'), release: () => released++ };
    },
} };
const nodemailer = require('nodemailer');
nodemailer.createTransport = () => ({ sendMail: async () => { if (emailFails) throw new Error('SMTP unavailable'); return {}; } });
const app = require('../server');
const { passwordVersion } = require('../authMiddleware');
let server;
let base;
before(async () => {
    passwordHash = await bcrypt.hash('temporary-password', 4);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => server.close(resolve)));
beforeEach(() => {
    user = { id: 1, role_id: 1, password_hash: passwordHash, requires_password_change: false };
    handler = async sql => { throw new Error(`Unexpected query: ${sql}`); };
    connectionError = null;
    emailFails = false;
    calls = [];
    released = 0;
});
function token(extra = {}) {
    return jwt.sign({ id: 1, role_id: user?.role_id || 1, password_version: passwordVersion(passwordHash), ...extra }, process.env.JWT_SECRET, { expiresIn: '5m' });
}
async function request(path, body, method = 'POST', authorization = token()) {
    const response = await fetch(base + path, {
        method, headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) },
        ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    });
    return { status: response.status, body: await response.json() };
}
const faculty = { employeeNo: '1234567', firstName: 'Test', lastName: 'Teacher', email: 'test@example.com', startSchoolYear: '2026-2027' };

test('invalid JSON returns a readable JSON error', async () => {
    const result = await request('/api/login', '{');
    assert.equal(result.status, 400);
    assert.match(result.body.error, /invalid JSON/);
});
test('missing credentials and invalid record identifiers return 400', async () => {
    assert.equal((await request('/api/login', {})).status, 400);
    assert.equal((await request('/api/admin/accounts/nope', undefined, 'DELETE')).status, 400);
});
test('grading weights must be whole percentages adding up to 100', async () => {
    for (const weights of [[20, 30, 40], [-1, 81, 20], [20.5, 59.5, 20]]) {
        const [ww_weight, pt_weight, ex_weight] = weights;
        assert.equal((await request('/api/admin/subjects', { subject_name: 'Math', ww_weight, pt_weight, ex_weight })).status, 400);
    }
});
test('invalid dates and school years are rejected', async () => {
    assert.equal((await request('/api/admin/calendar', { title: 'Event', event_date: '2026-02-30' })).status, 400);
    assert.equal((await request('/api/settings', { current_school_year: '2026-2029', active_trisemester: 1 }, 'PUT')).status, 400);
});
test('scores reject negatives, invalid values, duplicate pairs, and excess precision', async () => {
    user.role_id = 2;
    for (const score of [-1, 'not-a-number', 1.234]) {
        assert.equal((await request('/api/faculty/save-grades', { loadId: 1, trimester: 1, scores: [{ enrollment_id: 1, grade_item_id: 1, score }] })).status, 400);
    }
    const score = { enrollment_id: 1, grade_item_id: 1, score: 5 };
    assert.equal((await request('/api/faculty/save-grades', { loadId: 1, trimester: 1, scores: [score, score] })).status, 400);
});
test('missing and expired sessions return 401', async () => {
    assert.equal((await request('/api/settings', undefined, 'GET', null)).status, 401);
    const expired = jwt.sign({ id: 1, role_id: 1 }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    assert.equal((await request('/api/settings', undefined, 'GET', expired)).status, 401);
});
test('password setup tokens cannot access the portal', async () => {
    user.requires_password_change = true;
    assert.equal((await request('/api/settings', undefined, 'GET', token({ pending_reset: true }))).status, 403);
});
test('changed passwords invalidate existing tokens', async () => {
    const previous = token();
    user.password_hash = await bcrypt.hash('new-password', 4);
    assert.equal((await request('/api/settings', undefined, 'GET', previous)).status, 401);
});
test('deleted users cannot continue with an old token', async () => {
    const previous = token();
    user = null;
    assert.equal((await request('/api/settings', undefined, 'GET', previous)).status, 401);
});
test('normal sessions cannot use the password setup endpoint', async () => {
    assert.equal((await request('/api/auth/setup-password', { newPassword: 'password123' })).status, 403);
});
test('password setup tokens are single-use after a successful password change', async () => {
    user.requires_password_change = true;
    const temporary = token({ pending_reset: true });
    handler = async (sql, values) => {
        assert.match(sql, /UPDATE users SET password_hash/);
        user.password_hash = values[0];
        user.requires_password_change = false;
        return { rows: [] };
    };
    assert.equal((await request('/api/auth/setup-password', { newPassword: 'changed-password' }, 'POST', temporary)).status, 200);
    assert.equal((await request('/api/auth/setup-password', { newPassword: 'second-password' }, 'POST', temporary)).status, 401);
});
test('faculty cannot access admin routes or publish another advisory class', async () => {
    user.role_id = 2;
    assert.equal((await request('/api/admin/accounts', undefined, 'GET')).status, 403);
    handler = async () => ({ rows: [] });
    assert.equal((await request('/api/faculty/advisory-class/visibility/5', { isVisible: true }, 'PUT')).status, 403);
    assert.match(calls.at(-1).sql, /fp.user_id = \$3/);
});
test('faculty cannot write attendance for another learner', async () => {
    user.role_id = 2;
    handler = async () => ({ rows: [{ learner_id: 1 }] });
    const result = await request('/api/faculty/attendance', { schoolYear: '2026-2027', monthName: 'October', records: [{ student_id: 2, absent: 1, tardy: 0 }] });
    assert.equal(result.status, 403);
    assert.equal(released, 0);
});
test('attendance cannot exceed the configured school days', async () => {
    user.role_id = 2;
    handler = async sql => ({ rows: sql.includes('school_calendar') ? [{ total_days: 20 }] : [{ learner_id: 1 }] });
    const result = await request('/api/faculty/attendance', { schoolYear: '2026-2027', monthName: 'October', records: [{ student_id: 1, absent: 21, tardy: 0 }] });
    assert.equal(result.status, 400);
});
test('a score above its item maximum is rejected before writing', async () => {
    user.role_id = 2;
    handler = async sql => ({ rows: sql.includes('SELECT id, max_score') ? [{ id: 1, max_score: 10 }] : [{ id: 1, school_year: '2026-2027', section_id: 1 }] });
    const result = await request('/api/faculty/save-grades', { loadId: 1, trimester: 1, scores: [{ enrollment_id: 1, grade_item_id: 1, score: 11 }] });
    assert.equal(result.status, 400);
    assert.equal(calls.some(call => call.sql.includes('INSERT INTO student_scores')), false);
    assert.equal(released, 1);
});
test('scores and computed grades roll back together when computation fails', async () => {
    user.role_id = 2;
    handler = async sql => {
        if (sql.includes('SELECT id, max_score')) return { rows: [{ id: 1, max_score: 10 }] };
        if (sql.includes('COUNT(*)::int')) return { rows: [{ count: 1 }] };
        if (sql.includes('WITH totals')) throw new Error('Simulated calculation failure');
        return { rows: [{ id: 1, school_year: '2026-2027', section_id: 1 }] };
    };
    assert.equal((await request('/api/faculty/save-grades', { loadId: 1, trimester: 1, scores: [{ enrollment_id: 1, grade_item_id: 1, score: 5 }] })).status, 500);
    assert.ok(calls.some(call => call.sql.includes('INSERT INTO student_scores') && call.connection === 'client'));
    assert.ok(calls.some(call => call.sql === 'ROLLBACK' && call.connection === 'client'));
    assert.equal(calls.some(call => call.sql === 'COMMIT'), false);
    assert.equal(released, 1);
});
test('unsupported carousel file types return JSON without saving a file', async () => {
    const form = new FormData();
    form.append('image', new Blob(['<html></html>'], { type: 'text/html' }), 'page.html');
    const response = await fetch(base + '/api/admin/carousel', { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form });
    assert.equal(response.status, 400);
    assert.match((await response.json()).error, /PNG, JPG, or WebP/);
});
test('account creation rolls back on the same connection when the profile insert fails', async () => {
    handler = async sql => {
        if (sql.includes('INSERT INTO users')) return { rows: [{ id: 7 }] };
        throw Object.assign(new Error('duplicate employee number'), { code: '23505' });
    };
    assert.equal((await request('/api/admin/accounts/faculty', faculty)).status, 400);
    const transaction = calls.filter(call => !call.sql.startsWith('SELECT id, role_id'));
    assert.ok(transaction.every(call => call.connection === 'client'));
    assert.ok(transaction.some(call => call.sql === 'ROLLBACK'));
    assert.equal(transaction.some(call => call.sql === 'COMMIT'), false);
    assert.equal(released, 1);
});
test('a failed database connection returns JSON instead of leaking an exception', async () => {
    connectionError = Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' });
    assert.equal((await request('/api/admin/accounts/faculty', faculty)).status, 503);
});
test('email failures keep created credentials available and are not reported as sent', async () => {
    emailFails = true;
    handler = async sql => ({ rows: sql.includes('INSERT INTO users') ? [{ id: 7 }] : [] });
    const result = await request('/api/admin/accounts/faculty', faculty);
    assert.equal(result.status, 200);
    assert.equal(result.body.emailSent, false);
    assert.equal(result.body.credentials.emailSentTo, null);
    assert.ok(result.body.credentials.password);
    assert.ok(calls.some(call => /requires_password_change.*TRUE/.test(call.sql)));
});
test('failed reset emails leave the existing password unchanged', async () => {
    user.role_id = 2;
    emailFails = true;
    handler = async sql => ({ rows: sql.includes('faculty_profiles') ? [{ email: 'test@example.com' }] : [{ id: 1, role_id: 2, username: '1234567' }] });
    const result = await request('/api/auth/forgot-password', { username: '1234567' });
    assert.equal(result.status, 503);
    assert.equal(calls.some(call => call.sql.includes('UPDATE users')), false);
});
test('enrollment rejects a section from a different grade level', async () => {
    handler = async sql => ({ rows: sql.includes('system_settings') ? [{ current_school_year: '2026-2027' }] : [{ learner_grade: 7, section_grade: 8 }] });
    assert.equal((await request('/api/admin/enrollments', { learner_id: 1, section_id: 2 })).status, 400);
});
test('repeated login attempts are throttled with a readable error', async () => {
    handler = async () => ({ rows: [user] });
    for (let attempt = 0; attempt < 20; attempt++) {
        assert.equal((await request('/api/login', { username: 'rate-limit-user', password: 'wrong' })).status, 401);
    }
    const result = await request('/api/login', { username: 'rate-limit-user', password: 'wrong' });
    assert.equal(result.status, 429);
    assert.match(result.body.error, /Too many attempts/);
});
