const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { getTransmutedGrade, recomputeGrades } = require('../grading');

test('transmutation preserves zero scores and grade boundaries', () => {
    for (const [initial, expected] of [[0, 60], [4.67, 60], [4.68, 61], [69.99, 74], [70, 75], [99.49, 99], [99.5, 100], [100, 100]]) assert.equal(getTransmutedGrade(initial), expected);
});

const enabled = process.env.RUN_DB_TESTS === '1';
const pool = enabled ? require('../db') : null;
after(async () => { if (pool) await pool.end(); });
test('PostgreSQL computes complete denominators, zero scores, and item changes consistently', { skip: !enabled }, async () => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Temporary tables shadow real tables on this connection only; rollback removes all fixtures.
        await client.query(`
            CREATE TEMP TABLE subjects (id INT, ww_weight INT, pt_weight INT, ex_weight INT) ON COMMIT DROP;
            CREATE TEMP TABLE faculty_loads (id INT, subject_id INT, section_id INT, school_year TEXT) ON COMMIT DROP;
            CREATE TEMP TABLE enrollments (id INT, section_id INT, school_year TEXT) ON COMMIT DROP;
            CREATE TEMP TABLE grade_items (id INT, faculty_load_id INT, trimester INT, component TEXT, max_score NUMERIC) ON COMMIT DROP;
            CREATE TEMP TABLE student_scores (id INT, enrollment_id INT, grade_item_id INT, score NUMERIC) ON COMMIT DROP;
            CREATE TEMP TABLE grades (enrollment_id INT, faculty_load_id INT, trimester INT, initial_grade NUMERIC, transmuted_grade INT) ON COMMIT DROP;
            INSERT INTO subjects VALUES (1, 30, 50, 20);
            INSERT INTO faculty_loads VALUES (1, 1, 1, '2026-2027');
            INSERT INTO enrollments VALUES (1, 1, '2026-2027'), (2, 1, '2026-2027'), (3, 1, '2026-2027');
            INSERT INTO grade_items VALUES (1, 1, 1, 'WW', 10), (2, 1, 1, 'WW', 10), (3, 1, 1, 'PT', 20), (4, 1, 1, 'EX', 10);
            INSERT INTO student_scores VALUES (1, 1, 1, 10), (2, 1, 3, 20), (3, 1, 4, 10), (4, 2, 1, 0);
        `);
        await recomputeGrades(client, 1, 1);
        let result = await client.query('SELECT * FROM grades ORDER BY enrollment_id');
        assert.equal(result.rows.length, 2, 'unscored learners should not receive a published grade');
        assert.equal(Number(result.rows[0].initial_grade), 85, 'the missing second written work still contributes to the maximum');
        assert.equal(result.rows[1].transmuted_grade, 60, 'a recorded zero is a grade, not a missing score');
        await client.query('DELETE FROM grade_items WHERE id = 2');
        await recomputeGrades(client, 1, 1);
        result = await client.query('SELECT * FROM grades WHERE enrollment_id = 1');
        assert.equal(Number(result.rows[0].initial_grade), 100);
        assert.equal(result.rows[0].transmuted_grade, 100);
        await client.query('DELETE FROM student_scores WHERE enrollment_id = 2');
        await recomputeGrades(client, 1, 1);
        assert.equal((await client.query('SELECT * FROM grades WHERE enrollment_id = 2')).rows.length, 0, 'clearing scores removes the stale grade');
    } finally {
        await client.query('ROLLBACK');
        client.release();
    }
});
