async function recomputeGrades(client, loadId, trimester) {
    // Every item contributes to the denominator, including items with no score yet.
    const computed = await client.query(`
        WITH totals AS (
            SELECT e.id AS enrollment_id, gi.component,
                SUM(COALESCE(ss.score, 0)) AS total_score, SUM(gi.max_score) AS total_max,
                COUNT(ss.id) AS recorded_scores
            FROM enrollments e
            JOIN faculty_loads fl ON fl.section_id = e.section_id AND fl.school_year = e.school_year
            JOIN grade_items gi ON gi.faculty_load_id = fl.id AND gi.trimester = $2
            LEFT JOIN student_scores ss ON ss.enrollment_id = e.id AND ss.grade_item_id = gi.id
            WHERE fl.id = $1
            GROUP BY e.id, gi.component
        )
        SELECT t.enrollment_id,
            SUM(t.total_score / NULLIF(t.total_max, 0) *
                CASE t.component WHEN 'WW' THEN s.ww_weight WHEN 'PT' THEN s.pt_weight ELSE s.ex_weight END) AS initial_grade
        FROM totals t JOIN faculty_loads fl ON fl.id = $1 JOIN subjects s ON s.id = fl.subject_id
        GROUP BY t.enrollment_id HAVING SUM(t.recorded_scores) > 0
    `, [loadId, trimester]);
    await client.query('DELETE FROM grades WHERE faculty_load_id = $1 AND trimester = $2', [loadId, trimester]);
    for (const student of computed.rows) {
        const initial = Number(student.initial_grade);
        await client.query(`
            INSERT INTO grades (enrollment_id, faculty_load_id, trimester, initial_grade, transmuted_grade)
            VALUES ($1, $2, $3, $4, $5)
        `, [student.enrollment_id, loadId, trimester, initial, getTransmutedGrade(initial)]);
    }
}

function getTransmutedGrade(initial) {
    if (initial >= 99.50) return 100;
    if (initial >= 98.32) return 99;
    if (initial >= 97.14) return 98;
    if (initial >= 95.96) return 97;
    if (initial >= 94.78) return 96;
    if (initial >= 93.60) return 95;
    if (initial >= 92.42) return 94;
    if (initial >= 91.24) return 93;
    if (initial >= 90.06) return 92;
    if (initial >= 88.88) return 91;
    if (initial >= 87.70) return 90;
    if (initial >= 86.52) return 89;
    if (initial >= 85.34) return 88;
    if (initial >= 84.16) return 87;
    if (initial >= 82.98) return 86;
    if (initial >= 81.80) return 85;
    if (initial >= 80.62) return 84;
    if (initial >= 79.44) return 83;
    if (initial >= 78.26) return 82;
    if (initial >= 77.08) return 81;
    if (initial >= 75.90) return 80;
    if (initial >= 74.72) return 79;
    if (initial >= 73.54) return 78;
    if (initial >= 72.36) return 77;
    if (initial >= 71.18) return 76;
    if (initial >= 70.00) return 75;
    if (initial >= 65.34) return 74;
    if (initial >= 60.67) return 73;
    if (initial >= 56.01) return 72;
    if (initial >= 51.34) return 71;
    if (initial >= 46.67) return 70;
    if (initial >= 42.01) return 69;
    if (initial >= 37.34) return 68;
    if (initial >= 32.68) return 67;
    if (initial >= 28.01) return 66;
    if (initial >= 23.35) return 65;
    if (initial >= 18.68) return 64;
    if (initial >= 14.01) return 63;
    if (initial >= 9.35) return 62;
    if (initial >= 4.68) return 61;
    return 60; // For 0.00 - 4.67
}

module.exports = { recomputeGrades, getTransmutedGrade };
