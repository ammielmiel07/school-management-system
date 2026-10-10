const { httpError } = require('./errors');

const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const isInteger = (value, min = 1, max = 2147483647) =>
    (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) &&
    Number.isSafeInteger(Number(value)) && Number(value) >= min && Number(value) <= max;
const isNumber = (value, min = 0, max = 999999.99) =>
    (typeof value === 'number' || (typeof value === 'string' && /^\d+(\.\d{1,2})?$/.test(value))) &&
    Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max &&
    Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.000001;
const isYear = value => typeof value === 'string' && /^\d{4}-\d{4}$/.test(value) && Number(value.slice(5)) === Number(value.slice(0, 4)) + 1;
const isDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const check = (condition, message) => { if (!condition) throw httpError(400, message); };
const text = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;

function validateProfile(data, learner) {
    check(text(data.firstName, 100) && text(data.lastName, 100), 'First and last names are required (up to 100 characters each).');
    check(typeof data.email === 'string' && data.email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), 'Please enter a valid email address.');
    if (learner) {
        check(typeof data.lrn === 'string' && /^\d{12}$/.test(data.lrn), 'LRN must be exactly 12 digits.');
        check(isInteger(data.gradeLevel, 7, 12), 'Grade level must be between 7 and 12.');
        check(isYear(data.schoolYear), 'Select a valid school year.');
        check(!data.birthdate || (isDate(data.birthdate) && data.birthdate <= new Date().toISOString().slice(0, 10)), 'Enter a valid birthdate that is not in the future.');
        check(['Male', 'Female'].includes(data.gender), 'Select a valid gender.');
        check(typeof data.isStarEligible === 'boolean', 'Star eligibility must be true or false.');
        if (data.birthdate === '') data.birthdate = null;
    } else {
        check(typeof data.employeeNo === 'string' && /^\d{1,7}$/.test(data.employeeNo), 'Employee number must contain 1 to 7 digits.');
        check(isYear(data.startSchoolYear), 'Select a valid starting school year.');
    }
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
            const max = ['houseStreet', 'email'].includes(key) ? 255 : key === 'guardianName' ? 200 : key === 'contactNumber' ? 50 : 100;
            check(value.length <= max, `${key} is too long (maximum ${max} characters).`);
        }
    }
}

function validateRequest(req, res, next) {
    try {
        const { path, method } = req;
        if (['POST', 'PUT', 'PATCH'].includes(method) && path !== '/admin/carousel') {
            check(req.body && typeof req.body === 'object' && !Array.isArray(req.body), 'A JSON object is required.');
            for (const [key, value] of Object.entries(req.body)) {
                if (typeof value === 'string' && !['password', 'newPassword'].includes(key)) req.body[key] = value.trim();
            }
        }
        for (const [key, value] of Object.entries(req.query)) {
            if (['trimester'].includes(key)) check(isInteger(value, 1, 3), 'Trimester must be 1, 2, or 3.');
            if (['grade_level'].includes(key)) check(isInteger(value, 7, 12), 'Grade level must be between 7 and 12.');
            if (key === 'learnerId') check(isInteger(value), 'Select a valid learner.');
            if (key === 'schoolYear') check(isYear(value), 'Select a valid school year.');
            if (key === 'monthName' || key === 'month') check(months.includes(value), 'Select a valid month.');
        }
        if (!['POST', 'PUT', 'PATCH'].includes(method)) return next();
        const data = req.body || {};
        if (path === '/login' || path === '/register' || path === '/auth/forgot-password') {
            check(text(data.username, 50), 'Username is required (maximum 50 characters).');
            if (path !== '/auth/forgot-password') check(typeof data.password === 'string' && data.password.length > 0 && Buffer.byteLength(data.password) <= 72, 'Password is required and must be at most 72 bytes.');
            if (path === '/register') check(data.password.length >= 6, 'Password must be at least 6 characters.');
        }
        if (path === '/auth/setup-password') check(typeof data.newPassword === 'string' && data.newPassword.length >= 6 && Buffer.byteLength(data.newPassword) <= 72, 'Password must be at least 6 characters and at most 72 bytes.');
        if (path === '/settings') {
            check(isYear(data.current_school_year), 'Select a valid school year.');
            check(isInteger(data.active_trisemester, 1, 3), 'Trimester must be 1, 2, or 3.');
        }
        if (/^\/admin\/subjects(?:\/\d+)?$/.test(path)) {
            check(text(data.subject_name, 100), 'Subject name is required (maximum 100 characters).');
            const weights = [data.ww_weight, data.pt_weight, data.ex_weight];
            check(weights.every(value => isInteger(value, 0, 100)) && weights.reduce((sum, value) => sum + Number(value), 0) === 100, 'Grading weights must be whole percentages that total 100.');
        }
        if (/^\/admin\/sections(?:\/\d+)?$/.test(path)) {
            check(text(data.section_name, 100), 'Section name is required (maximum 100 characters).');
            check(isInteger(data.grade_level, 7, 12), 'Grade level must be between 7 and 12.');
            check(data.is_star_section === undefined || typeof data.is_star_section === 'boolean', 'Star section must be true or false.');
        }
        if (path === '/admin/calendar') {
            check(text(data.title, 200), 'Event title is required (maximum 200 characters).');
            check(isDate(data.event_date), 'Enter a valid event date.');
            check(data.description == null || typeof data.description === 'string', 'Event description must be text.');
        }
        if (path === '/admin/school-days') {
            check(isYear(data.schoolYear) && months.includes(data.monthName), 'Select a valid school year and month.');
            check(isInteger(data.totalDays, 0, 31), 'School days must be a whole number between 0 and 31.');
        }
        if (/^\/admin\/accounts\/(learner|faculty|\d+)$/.test(path)) {
            check(data.lrn !== undefined || data.employeeNo !== undefined, 'Provide an LRN or employee number.');
            check(!(data.lrn !== undefined && data.employeeNo !== undefined), 'Choose either a learner or faculty profile.');
            validateProfile(data, path.endsWith('/learner') || data.lrn !== undefined);
        }
        const requiredIds = {
            '/admin/sections/advisers': ['section_id', 'faculty_id'],
            '/admin/faculty-loads': ['faculty_id', 'subject_id', 'section_id'],
            '/admin/enrollments': ['learner_id', 'section_id'],
            '/faculty/grade-items': ['loadId'],
            '/faculty/save-grades': ['loadId'],
            '/faculty/core-values': ['learnerId'],
        };
        for (const key of requiredIds[path] || []) check(isInteger(data[key]), `Select a valid ${key.replace(/_id|Id/g, '').replace(/_/g, ' ')}.`);
        if (['/faculty/grade-items', '/faculty/save-grades', '/faculty/core-values'].includes(path)) check(isInteger(data.trimester, 1, 3), 'Trimester must be 1, 2, or 3.');
        if (path === '/faculty/grade-items') {
            check(['WW', 'PT', 'EX'].includes(data.component), 'Select a valid grading component.');
            check(text(data.name, 100), 'Item name is required (maximum 100 characters).');
            check(isNumber(data.max, 0.01), 'Maximum score must be greater than zero, with at most two decimal places.');
        }
        if (path === '/faculty/save-grades') {
            check(Array.isArray(data.scores) && data.scores.length > 0 && data.scores.length <= 10000, 'Provide between 1 and 10,000 scores.');
            const pairs = new Set();
            for (const score of data.scores) {
                check(score && isInteger(score.enrollment_id) && isInteger(score.grade_item_id) && (score.score === null || isNumber(score.score)), 'Scores must be nonnegative numbers with at most two decimal places.');
                const pair = `${score.enrollment_id}:${score.grade_item_id}`;
                check(!pairs.has(pair), 'The same score was submitted more than once.');
                pairs.add(pair);
            }
        }
        if (path === '/faculty/attendance') {
            check(isYear(data.schoolYear) && months.includes(data.monthName), 'Select a valid school year and month.');
            check(Array.isArray(data.records) && data.records.length > 0 && data.records.length <= 1000, 'Provide between 1 and 1,000 attendance records.');
            const ids = new Set();
            for (const record of data.records) {
                check(record && isInteger(record.student_id) && isInteger(record.absent, 0, 31) && isInteger(record.tardy, 0, 31), 'Absences and tardiness must be whole numbers between 0 and 31.');
                check(!ids.has(Number(record.student_id)), 'The same attendance record was submitted more than once.');
                ids.add(Number(record.student_id));
            }
        }
        if (path === '/faculty/core-values') {
            check(isYear(data.schoolYear), 'Select a valid school year.');
            for (const key of ['md_1', 'md_2', 'mt_1', 'mt_2', 'mk_1', 'mb_1', 'mb_2']) check(['', 'AO', 'SO', 'RO', 'NO'].includes(data[key]), 'Select a valid observation for each core value.');
        }
        if (/^\/faculty\/advisory-class\/visibility\//.test(path)) check(typeof data.isVisible === 'boolean', 'Visibility must be true or false.');
        next();
    } catch (error) { next(error); }
}

module.exports = { validateRequest, isInteger, months };
