const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const enabled = process.env.RUN_DB_TESTS === '1';
const pool = enabled ? require('../db') : null;
after(async () => { if (pool) await pool.end(); });

test('API queries are compatible with the configured database schema', { skip: !enabled }, async () => {
    const statements = new Set();
    for (const file of ['server.js', 'authMiddleware.js', 'grading.js']) {
        const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        const query = /\.query\(\s*(?:'((?:\\.|[^'\\])*)'|"((?:\\.|[^"\\])*)"|`([^`]*)`)/g;
        for (const match of source.matchAll(query)) {
            const sql = (match[1] || match[2] || match[3]).replace(/\\(['"\\])/g, '$1');
            if (/^(SELECT|INSERT|UPDATE|DELETE|WITH)\b/.test(sql.trim()) && !sql.includes('${')) statements.add(sql);
        }
    }
    assert.ok(statements.size >= 100, 'The schema check should cover the API queries.');
    for (const sql of statements) {
        const parameters = [...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
        // EXPLAIN plans writes without executing them; no existing records are read or changed.
        try { await pool.query('EXPLAIN ' + sql, Array(Math.max(0, ...parameters)).fill(null)); }
        catch (error) { assert.fail(`${error.code}: ${error.message}\n${sql.trim().slice(0, 120)}`); }
    }
});
