const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const verifyToken = require('./authMiddleware');
const { passwordVersion } = verifyToken;
const { randomBytes } = require('crypto');
const { httpError, sendError } = require('./errors');
const { validateRequest, isInteger } = require('./validation');
const { recomputeGrades } = require('./grading');
const app = express();
app.disable('x-powered-by');
app.use(cors(process.env.FRONTEND_URL ? { origin: process.env.FRONTEND_URL } : {}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', validateRequest);
for (const parameter of ['id', 'loadId', 'sectionId', 'enrollmentId']) {
    app.param(parameter, (req, res, next, value) => {
        if (!isInteger(value)) return res.status(400).json({ error: 'Select a valid record.' });
        next();
    });
}

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');

// Set up the email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 10000,
    socketTimeout: 15000,
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS   
    }
});

// ==========================================
//        CONFIGURATION & UTILITIES
// ==========================================

// Expose 'uploads' directory publicly
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer Storage for Carousel Images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, 'uploads', 'carousel');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, 'carousel-' + randomBytes(16).toString('hex') + path.extname(file.originalname).toLowerCase());
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter(req, file, cb) {
        const types = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
        if (types[path.extname(file.originalname).toLowerCase()] !== file.mimetype) {
            return cb(httpError(400, 'Upload a PNG, JPG, or WebP image (maximum 5 MB).'));
        }
        cb(null, true);
    },
});

const ROLES = {
    ADMIN: 1,
    FACULTY: 2,
    LEARNER: 3,
    PARENT: 4
};

const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@poms.local';

const authenticationAttempts = new Map();
const authenticationWindow = 15 * 60 * 1000;
const authenticationCleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, attempt] of authenticationAttempts) {
        if (attempt.expires <= now) authenticationAttempts.delete(key);
    }
}, 60000);
authenticationCleanup.unref();

function limitAuthentication(req, res, next) {
    const now = Date.now();
    const key = `${req.path}:${req.ip}:${req.body.username.toLowerCase()}`;
    const limit = req.path.endsWith('/forgot-password') ? 3 : 20;
    let attempt = authenticationAttempts.get(key);
    if (!attempt || attempt.expires <= now) {
        attempt = { count: 0, expires: now + authenticationWindow };
        authenticationAttempts.set(key, attempt);
    }
    if (attempt.count >= limit) {
        res.set('Retry-After', String(Math.ceil((attempt.expires - now) / 1000)));
        return res.status(429).json({ error: 'Too many attempts for this account. Please try again in 15 minutes.' });
    }
    attempt.count++;
    next();
}

const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!allowedRoles.includes(req.user.role_id)) {
        return res.status(403).json({ error: "Access denied." });
    }
    next();
};

async function getSystemSettings() {
    const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
    if (!result.rows[0]) throw httpError(503, 'System settings are missing. Please contact the administrator.');
    return result.rows[0];
}

async function getAdvisoryLearnerIds(userId, schoolYear) {
    const result = await pool.query(`
        SELECT e.learner_id FROM enrollments e
        JOIN section_advisories sa ON sa.section_id = e.section_id AND sa.school_year = e.school_year
        JOIN faculty_profiles fp ON fp.id = sa.faculty_id
        WHERE fp.user_id = $1 AND e.school_year = $2
    `, [userId, schoolYear]);
    return new Set(result.rows.map(row => Number(row.learner_id)));
}

async function sendCredentialEmail(options) {
    try {
        await transporter.sendMail(options);
        return true;
    } catch (error) {
        console.error('Credential email could not be sent:', error.message);
        return false;
    }
}

async function getFacultyOwnedLoad(loadId, userId) {
    const result = await pool.query(`
        SELECT fl.id, fl.school_year, fl.section_id, s.ww_weight, s.pt_weight, s.ex_weight
        FROM faculty_loads fl
        JOIN faculty_profiles fp ON fl.faculty_id = fp.id
        JOIN subjects s ON fl.subject_id = s.id
        WHERE fl.id = $1 AND fp.user_id = $2
    `, [loadId, userId]);

    return result.rows[0] || null;
}

function ensureActiveTrimester(requestedTrimester, settings, res) {
    const activeTrimester = Number(settings?.active_trisemester);
    const trimester = Number(requestedTrimester ?? activeTrimester);

    if (!activeTrimester || trimester !== activeTrimester) {
        res.status(403).json({ error: "This trisemester is closed for grading." });
        return null;
    }

    return trimester;
}

// Utility: Convert Initial Grade to Transmuted Grade (DepEd Standard)
// Database connection test route
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, message: "Database connected!", time: result.rows[0].now });
    } catch (err) {
        res.status(500).json({ success: false, error: "Database connection failed." });
    }
});

// ==========================================
//             AUTHENTICATION
// ==========================================

app.post('/api/register', limitAuthentication, async (req, res) => {
    let client;
    let transactionOpen = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transactionOpen = true;
        const { username, password, role_name } = req.body;

        if (role_name !== "Admin") {
            return res.status(403).json({ error: "Only the first Admin account can be registered here." });
        }

        await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
        const existingAdmin = await client.query('SELECT id FROM users WHERE role_id = $1 LIMIT 1', [ROLES.ADMIN]);
        if (existingAdmin.rows.length > 0) {
            return res.status(403).json({ error: "Admin registration is already locked. Please create users from the Admin portal." });
        }

        const roleResult = await client.query('SELECT id FROM roles WHERE role_name = $1', [role_name]);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid role specified." });
        }
        const roleId = roleResult.rows[0].id;

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const newUser = await client.query(
            'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id, username, role_id',
            [username, passwordHash, roleId]
        );

        await client.query('COMMIT');
        transactionOpen = false;
        res.json({ success: true, message: "User created successfully!", user: newUser.rows[0] });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Server error. Username might already be taken.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.post('/api/login', limitAuthentication, async (req, res) => {
    try {
        const { username, password } = req.body;

        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        
        const user = userResult.rows[0];

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        if (user.requires_password_change) {
            const resetToken = jwt.sign(
                { id: user.id, role_id: user.role_id, pending_reset: true, password_version: passwordVersion(user.password_hash) },
                process.env.JWT_SECRET, 
                { expiresIn: '15m' }
            );

            return res.json({ 
                success: true, 
                requires_reset: true, 
                token: resetToken,
                message: "Password reset required." 
            });
        }

        const token = jwt.sign(
            { id: user.id, role_id: user.role_id, password_version: passwordVersion(user.password_hash) },
            process.env.JWT_SECRET, 
            { expiresIn: '8h' } 
        );

        res.json({ 
            success: true, 
            message: "Logged in successfully!", 
            token: token,
            user: { id: user.id, username: user.username, role_id: user.role_id }
        });
    } catch (err) {
        sendError(res, err, "Server error during login.");
    }
});

app.post('/api/auth/forgot-password', limitAuthentication, async (req, res) => {
    try {
        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ error: "Username is required." });
        }

        // 1. Find the user
        const userResult = await pool.query('SELECT id, role_id, username FROM users WHERE username = $1', [username]);
        
        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: "Account not found." });
        }

        const user = userResult.rows[0];
        let userEmail = null;

        // 2. Find their email based on their role
        if (user.role_id === ROLES.ADMIN) {
            return res.status(403).json({ error: "Admin accounts cannot be reset online. Please contact IT support." });
        } 
        else if (user.role_id === ROLES.FACULTY) {
            const profile = await pool.query('SELECT email FROM faculty_profiles WHERE user_id = $1', [user.id]);
            if (profile.rows.length > 0) userEmail = profile.rows[0].email;
        } 
        else if (user.role_id === ROLES.LEARNER) {
            const profile = await pool.query('SELECT email FROM learner_profiles WHERE user_id = $1', [user.id]);
            if (profile.rows.length > 0) userEmail = profile.rows[0].email;
        } 
        else if (user.role_id === ROLES.PARENT) {
            // For parents, we send the reset to the email registered on the linked learner's profile
            const profile = await pool.query(`
                SELECT l.email 
                FROM parent_profiles p
                JOIN learner_profiles l ON p.linked_lrn = l.lrn
                WHERE p.user_id = $1
            `, [user.id]);
            if (profile.rows.length > 0) userEmail = profile.rows[0].email;
        }

        if (!userEmail) {
            return res.status(400).json({ error: "No email address is associated with this account. Please contact the registrar." });
        }

        // 3. Generate a secure temporary password
        const tempPassword = randomBytes(12).toString('base64url') + 'Ff4!';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        // 5. Send the email
        const mailOptions = {
            from: emailFrom, 
            to: userEmail, 
            subject: 'Password Reset Request | POMS',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background-color: #990000; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0; font-size: 20px;">Password Reset Request</h2>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="margin-top: 0;">Greetings!</p>
                    <p>We received a request to reset the password for your POMS account (Username: <strong>${user.username}</strong>).</p>
                    
                    <div style="background-color: #f9f9fb; border: 1px solid #dcdcdc; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
                        <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 15px;">Your Temporary Password</p>
                        <p style="margin: 5px 0; font-size: 18px; color: #990000; font-weight: bold;">${tempPassword}</p>
                    </div>

                    <p style="font-size: 14px;">Please log in using this temporary password. You will be immediately prompted to create a new, secure password.</p>
                    <p style="font-size: 14px;">If you did not request this reset, please contact the school administration immediately.</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 15px 0;" />
                    <p style="font-size: 11px; text-align: center; color: #888; margin: 0;">
                        This is an automated notification from POMS (PDFMNHS Online Management System).<br/>Please do not reply to this email.
                    </p>
                </div>
            </div>
            `
        };

        if (!await sendCredentialEmail(mailOptions)) {
            return res.status(503).json({ error: 'The reset email could not be sent. Your password has not changed. Please try again later.' });
        }
        await pool.query(
            'UPDATE users SET password_hash = $1, requires_password_change = TRUE WHERE id = $2',
            [hashedPassword, user.id]
        );

        res.json({ success: true, message: "A temporary password has been sent to your registered email address." });

    } catch (err) {
        sendError(res, err, "An error occurred while processing your request.");
    }
});

app.post('/api/auth/setup-password', verifyToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id; 

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query(
            'UPDATE users SET password_hash = $1, requires_password_change = FALSE WHERE id = $2',
            [hashedPassword, userId]
        );

        res.json({ success: true, message: "Password updated successfully! You can now log in." });
    } catch (err) {
        sendError(res, err, "Failed to update password.");
    }
});


// ==========================================
//             ADMIN ROUTES
// ==========================================

// --- System Settings & Dashboard ---
app.get('/api/settings', verifyToken, async (req, res) => {
    try {
        const settings = await getSystemSettings();
        res.json({ success: true, settings });
    } catch (err) {
        sendError(res, err, "Failed to fetch system settings.");
    }
});

app.put('/api/settings', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { current_school_year, active_trisemester } = req.body;
        const result = await pool.query(
            `INSERT INTO system_settings (id, current_school_year, active_trisemester) VALUES (1, $1, $2)
             ON CONFLICT (id) DO UPDATE SET current_school_year = EXCLUDED.current_school_year,
             active_trisemester = EXCLUDED.active_trisemester, updated_at = CURRENT_TIMESTAMP RETURNING *`,
            [current_school_year, active_trisemester]
        );
        res.json({ success: true, message: "Settings updated!", settings: result.rows[0] });
    } catch (err) {
        sendError(res, err, "Failed to update settings.");
    }
});

app.get('/api/admin/dashboard', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const settings = await getSystemSettings();
        const activeYear = settings?.current_school_year;

        const [totalLearners, totalFaculty, enrolledThisYear, activeSections] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM learner_profiles'),
            pool.query('SELECT COUNT(*) FROM faculty_profiles'),
            pool.query('SELECT COUNT(*) FROM enrollments WHERE school_year = $1', [activeYear]),
            pool.query('SELECT COUNT(DISTINCT section_id) FROM enrollments WHERE school_year = $1', [activeYear])
        ]);

        res.json({ 
            success: true, 
            active_school_year: activeYear,
            active_trisemester: settings?.active_trisemester,
            stats: {
                total_learners: parseInt(totalLearners.rows[0].count),
                total_faculty: parseInt(totalFaculty.rows[0].count),
                enrolled_this_year: parseInt(enrolledThisYear.rows[0].count),
                active_sections: parseInt(activeSections.rows[0].count)
            }
        });
    } catch (err) {
        sendError(res, err, "Failed to fetch dashboard analytics.");
    }
});

// --- Carousel & Calendar ---
app.get('/api/admin/carousel', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM carousel_images ORDER BY uploaded_at DESC');
        res.json({ success: true, images: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch carousel images.");
    }
});

app.post('/api/admin/carousel', verifyToken, requireRole(ROLES.ADMIN), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "No image file provided." });
        const bytes = await fs.promises.readFile(req.file.path);
        const ext = path.extname(req.file.filename);
        const valid = ext === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : ext === '.webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
            : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
        if (!valid) throw httpError(400, 'This file is not a valid PNG, JPG, or WebP image.');
        const imageUrl = `/uploads/carousel/${req.file.filename}`;
        const result = await pool.query(
            'INSERT INTO carousel_images (image_url) VALUES ($1) RETURNING *',
            [imageUrl]
        );
        res.json({ success: true, message: "Image uploaded successfully!", image: result.rows[0] });
    } catch (err) {
        if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
        sendError(res, err, "Failed to upload image.");
    }
});

app.delete('/api/admin/carousel/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        const imageCheck = await pool.query('SELECT image_url FROM carousel_images WHERE id = $1', [id]);
        if (imageCheck.rows.length === 0) return res.status(404).json({ error: "Image not found." });

        const filePath = path.resolve(__dirname, 'uploads', 'carousel', path.basename(imageCheck.rows[0].image_url));
        await pool.query('DELETE FROM carousel_images WHERE id = $1', [id]);

        await fs.promises.unlink(filePath).catch(error => {
            if (error.code !== 'ENOENT') console.error('Could not remove carousel file:', error.message);
        });
        res.json({ success: true, message: "Image deleted successfully." });
    } catch (err) {
        sendError(res, err, "Failed to delete image.");
    }
});

app.get('/api/admin/calendar', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM school_events ORDER BY event_date ASC');
        res.json({ success: true, events: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch events.");
    }
});

app.post('/api/admin/calendar', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { title, event_date, description } = req.body;
        const result = await pool.query(
            'INSERT INTO school_events (title, event_date, description) VALUES ($1, $2, $3) RETURNING *',
            [title, event_date, description]
        );
        res.json({ success: true, message: "Event added successfully!", event: result.rows[0] });
    } catch (err) {
        sendError(res, err, "Failed to add event.");
    }
});

app.delete('/api/admin/calendar/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await pool.query('DELETE FROM school_events WHERE id = $1 RETURNING id', [id]);
        if (!deleted.rows.length) return res.status(404).json({ error: 'Event not found.' });
        res.json({ success: true, message: "Event deleted successfully." });
    } catch (err) {
        sendError(res, err, "Failed to delete event.");
    }
});

// --- School Days (Admin Setup) ---
app.post('/api/admin/school-days', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { schoolYear, monthName, totalDays } = req.body;
    try {
        await pool.query(
            `INSERT INTO school_calendar (school_year, month_name, total_days) 
             VALUES ($1, $2, $3)
             ON CONFLICT (school_year, month_name) 
             DO UPDATE SET total_days = EXCLUDED.total_days`,
            [schoolYear, monthName, totalDays]
        );
        res.json({ success: true, message: "School calendar updated successfully." });
    } catch (err) {
        sendError(res, err, "Failed to update calendar.");
    }
});

app.get('/api/admin/school-days', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { schoolYear, monthName } = req.query;
        if (monthName) {
            const result = await pool.query(
                'SELECT total_days FROM school_calendar WHERE school_year = $1 AND month_name = $2',
                [schoolYear, monthName]
            );
            res.json({ success: true, totalDays: result.rows.length > 0 ? result.rows[0].total_days : "" });
        } else {
            const result = await pool.query(
                'SELECT month_name, total_days FROM school_calendar WHERE school_year = $1',
                [schoolYear]
            );
            res.json({ success: true, calendar: result.rows });
        }
    } catch (err) {
        sendError(res, err, "Failed to fetch school days.");
    }
});

// --- Subjects ---
app.get('/api/admin/subjects', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects ORDER BY id ASC');
        res.json({ success: true, subjects: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch subjects.");
    }
});

app.post('/api/admin/subjects', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { subject_name, ww_weight, pt_weight, ex_weight } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO subjects (subject_name, ww_weight, pt_weight, ex_weight) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [subject_name, ww_weight, pt_weight, ex_weight]
        );
        res.json({ success: true, subject: result.rows[0], message: "Subject added successfully!" });
    } catch (err) {
        sendError(res, err, "Failed to add subject.");
    }
});

app.put('/api/admin/subjects/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;
    const { subject_name, ww_weight, pt_weight, ex_weight } = req.body;
    try {
        const result = await pool.query(
            `UPDATE subjects SET subject_name = $1, ww_weight = $2, pt_weight = $3, ex_weight = $4 
             WHERE id = $5 RETURNING *`,
            [subject_name, ww_weight, pt_weight, ex_weight, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Subject not found." });
        res.json({ success: true, subject: result.rows[0], message: "Subject updated successfully!" });
    } catch (err) {
        sendError(res, err, "Failed to update subject.");
    }
});

app.delete('/api/admin/subjects/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Subject not found." });
        res.json({ success: true, message: "Subject deleted successfully!" });
    } catch (err) {
        if (err.code === '23503') return res.status(400).json({ error: "Cannot delete this subject because it is assigned to a class." });
        sendError(res, err, "Failed to delete subject.");
    }
});

// --- Sections & Advisers ---
app.get('/api/admin/sections', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sections ORDER BY grade_level ASC, section_name ASC');
        res.json({ success: true, sections: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch sections.");
    }
});

app.post('/api/admin/sections', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { section_name, grade_level, is_star_section } = req.body;
    try {
        // --- NEW TRAP: Check if a star section already exists for this grade ---
        if (is_star_section) {
            const existingStar = await pool.query(
                `SELECT section_name FROM sections WHERE grade_level = $1 AND is_star_section = TRUE`,
                [grade_level]
            );
            if (existingStar.rows.length > 0) {
                return res.status(400).json({ 
                    error: `Grade ${grade_level} already has a star section (${existingStar.rows[0].section_name}). Only one is allowed.` 
                });
            }
        }

        const result = await pool.query(
            `INSERT INTO sections (section_name, grade_level, is_star_section) VALUES ($1, $2, $3) RETURNING *`,
            [section_name, grade_level, is_star_section || false]
        );
        res.json({ success: true, section: result.rows[0], message: "Section added successfully!" });
    } catch (err) {
        if (err.code === '23505') return res.status(400).json({ error: "This section name already exists." });
        sendError(res, err, "Failed to add section.");
    }
});

app.put('/api/admin/sections/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;
    const { section_name, grade_level, is_star_section } = req.body;
    try {
        const enrolled = await pool.query(`
            SELECT 1 FROM sections s JOIN enrollments e ON e.section_id = s.id
            WHERE s.id = $1 AND s.grade_level <> $2 LIMIT 1
        `, [id, grade_level]);
        if (enrolled.rows.length) throw httpError(409, 'The grade level cannot be changed while learners are enrolled in this section.');
        // --- NEW TRAP: Check if another star section already exists for this grade ---
        if (is_star_section) {
            const existingStar = await pool.query(
                `SELECT section_name FROM sections WHERE grade_level = $1 AND is_star_section = TRUE AND id != $2`,
                [grade_level, id]
            );
            if (existingStar.rows.length > 0) {
                return res.status(400).json({ 
                    error: `Grade ${grade_level} already has a star section (${existingStar.rows[0].section_name}). Only one is allowed.` 
                });
            }
        }

        const result = await pool.query(
            `UPDATE sections SET section_name = $1, grade_level = $2, is_star_section = $3 WHERE id = $4 RETURNING *`,
            [section_name, grade_level, is_star_section || false, id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Section not found." });
        res.json({ success: true, section: result.rows[0], message: "Section updated successfully!" });
    } catch (err) {
        sendError(res, err, "Failed to update section.");
    }
});
app.delete('/api/admin/sections/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;
    try {
        const assigned = await pool.query('SELECT 1 FROM faculty_loads WHERE section_id = $1 LIMIT 1', [id]);
        if (assigned.rows.length) throw httpError(409, 'Remove the teaching assignments before deleting this section.');
        const result = await pool.query('DELETE FROM sections WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Section not found." });
        res.json({ success: true, message: "Section deleted successfully!" });
    } catch (err) {
        if (err.code === '23503') return res.status(400).json({ error: "Cannot delete this section because students or faculty are currently assigned to it." });
        sendError(res, err, "Failed to delete section.");
    }
});

app.get('/api/admin/sections/advisers', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        const result = await pool.query(`
            SELECT s.id, s.section_name, s.grade_level, f.first_name, f.last_name 
            FROM sections s
            LEFT JOIN section_advisories sa ON s.id = sa.section_id AND sa.school_year = $1
            LEFT JOIN faculty_profiles f ON sa.faculty_id = f.id
            ORDER BY s.grade_level ASC, s.section_name ASC
        `, [activeYear]);
        
        const faculty = await pool.query('SELECT id, first_name, last_name, employee_no FROM faculty_profiles ORDER BY last_name ASC');

        res.json({ 
            success: true, 
            sections: result.rows, 
            faculty: faculty.rows,
            active_school_year: activeYear 
        });
    } catch (err) {
        sendError(res, err, "Failed to fetch sections and advisers.");
    }
});

app.post('/api/admin/sections/advisers', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    let client;
    let transactionOpen = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transactionOpen = true;
        const { section_id, faculty_id } = req.body;
        const settings = await getSystemSettings();
        const school_year = settings?.current_school_year;

        if (!school_year) return res.status(400).json({ error: "Current school year is not set." });

        await client.query('SELECT id FROM faculty_profiles WHERE id = $1 FOR UPDATE', [faculty_id]);
        // --- NEW TRAP: Faculty can't have 2 or more advisory sections ---
        const facultyAdvisoryCheck = await client.query(
            `SELECT s.section_name FROM section_advisories sa
             JOIN sections s ON sa.section_id = s.id
             WHERE sa.faculty_id = $1 AND sa.school_year = $2 AND sa.section_id != $3`,
            [faculty_id, school_year, section_id]
        );

        if (facultyAdvisoryCheck.rows.length > 0) {
            return res.status(400).json({ 
                error: `This faculty is already assigned as the adviser for section ${facultyAdvisoryCheck.rows[0].section_name}. A faculty can only handle one advisory class.` 
            });
        }

        await client.query(`
            INSERT INTO section_advisories (section_id, faculty_id, school_year) 
            VALUES ($1, $2, $3)
            ON CONFLICT (section_id, school_year) 
            DO UPDATE SET faculty_id = EXCLUDED.faculty_id
        `, [section_id, faculty_id, school_year]);

        await client.query('COMMIT');
        transactionOpen = false;
        res.json({ success: true, message: "Adviser assigned successfully!" });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Failed to assign adviser.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.delete('/api/admin/sections/advisers/:sectionId', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { sectionId } = req.params;
        const settings = await getSystemSettings();
        const school_year = settings?.current_school_year;

        if (!school_year) return res.status(400).json({ error: "Current school year is not set." });

        const result = await pool.query(
            `DELETE FROM section_advisories 
             WHERE section_id = $1 AND school_year = $2 
             RETURNING *`,
            [sectionId, school_year]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "No adviser is currently assigned to this section." });
        }

        res.json({ success: true, message: "Adviser removed successfully!" });
    } catch (err) {
        sendError(res, err, "Failed to remove adviser.");
    }
});

// --- Accounts Management (Users) ---
app.get('/api/admin/accounts', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const faculty = await pool.query(`
            SELECT u.id as user_id, u.username, 'faculty' as role, f.*, f.employee_no as identifier 
            FROM users u JOIN faculty_profiles f ON u.id = f.user_id
        `);
        
        const learners = await pool.query(`
            SELECT u.id as user_id, u.username, 'learner' as role, l.*, l.lrn as identifier 
            FROM users u JOIN learner_profiles l ON u.id = l.user_id
        `);

        res.json({ success: true, accounts: [...faculty.rows, ...learners.rows] });
    } catch (err) {
        sendError(res, err, "Failed to fetch accounts.");
    }
});

app.post('/api/admin/accounts/learner', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    let client;
    let transactionOpen = false;
    try {
        client = await pool.connect();
        const data = req.body;
        
        // Generate UNIQUE passwords for Learner and Parent to match your design
        const learnerPassword = randomBytes(12).toString('base64url') + "Aa1!";
        const parentPassword = randomBytes(12).toString('base64url') + "Bb2@";
        
        const hashedLearnerPassword = await bcrypt.hash(learnerPassword, 10);
        const hashedParentPassword = await bcrypt.hash(parentPassword, 10);
        
        const learnerUsername = data.lrn;
        const parentUsername = `P-${data.lrn}`;

        await client.query('BEGIN');
        transactionOpen = true;

        // Create Learner Login
        const learnerUserResult = await client.query(
            `INSERT INTO users (username, password_hash, role_id, requires_password_change) VALUES ($1, $2, $3, TRUE) RETURNING id`,
            [learnerUsername, hashedLearnerPassword, 3]
        );
        const learnerUserId = learnerUserResult.rows[0].id;

        // Insert SF1 Profile Details 
        const learnerProfileResult = await client.query(
            `INSERT INTO learner_profiles (
                user_id, lrn, birthdate, gender, first_name, middle_name, last_name, email,
                school_year, grade_level, is_star_eligible, mother_tongue, ethnic_group, religion,
                house_street, barangay, city, province, father_first, father_middle, father_last,
                mother_first, mother_middle, mother_last, guardian_name, guardian_relationship, contact_number
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
                $19, $20, $21, $22, $23, $24, $25, $26, $27
            ) RETURNING id`,
            [
                learnerUserId, data.lrn, data.birthdate, data.gender, data.firstName, data.middleName, data.lastName, data.email,
                data.schoolYear, data.gradeLevel, data.isStarEligible, data.motherTongue, data.ip, data.religion,
                data.houseStreet, data.barangay, data.city, data.province, data.fatherFirst, data.fatherMiddle, data.fatherLast,
                data.motherFirst, data.motherMiddle, data.motherLast, data.guardianName, data.guardianRelation, data.contactNumber
            ]
        );
        const learnerProfileId = learnerProfileResult.rows[0].id;

        // Auto-assign Star Section (if applicable)
        if (data.isStarEligible) {
            const starSectionResult = await client.query(
                `SELECT id FROM sections WHERE grade_level = $1 AND is_star_section = TRUE`,
                [data.gradeLevel]
            );

            if (starSectionResult.rows.length > 0) {
                const starSectionId = starSectionResult.rows[0].id;
                await client.query(
                    `INSERT INTO enrollments (learner_id, section_id, school_year) VALUES ($1, $2, $3)`,
                    [learnerProfileId, starSectionId, data.schoolYear]
                );
            }
        }

        // Create Parent Login
        const parentUserResult = await client.query(
            `INSERT INTO users (username, password_hash, role_id, requires_password_change) VALUES ($1, $2, $3, TRUE) RETURNING id`,
            [parentUsername, hashedParentPassword, 4]
        );
        const parentUserId = parentUserResult.rows[0].id;

        // Link Parent Profile
        await client.query(
            `INSERT INTO parent_profiles (user_id, linked_lrn) VALUES ($1, $2)`,
            [parentUserId, data.lrn]
        );

        await client.query('COMMIT');
        transactionOpen = false;

        // --- NEW LOGIC: SEND HTML EMAIL ---
        const mailOptions = {
            from: emailFrom,
            to: data.email, // Sent to the learner's email from the frontend form
            subject: 'Temporary Credentials for Learner & Parent | POMS',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background-color: #990000; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0; font-size: 20px;">Learner & Parent Credentials</h2>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="margin-top: 0;">Greetings!</p>
                    <p>Your learner & parent accounts have been created. Below are the temporary credentials for both accounts:</p>
                    
                    <div style="background-color: #f9f9fb; border: 1px solid #dcdcdc; border-radius: 6px; padding: 15px; margin-bottom: 15px;">
                        <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 15px;">Learner Account</p>
                        <p style="margin: 5px 0;"><strong>Username:</strong> ${learnerUsername}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${learnerPassword}</p>
                    </div>

                    <div style="background-color: #f9f9fb; border: 1px solid #dcdcdc; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
                        <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 15px;">Parent Account</p>
                        <p style="margin: 5px 0;"><strong>Username:</strong> ${parentUsername}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${parentPassword}</p>
                    </div>

                    <p style="font-size: 14px;">Please log in to your accounts and change the passwords immediately for security.<br/>Thank you for your cooperation!</p>
                    <p style="font-size: 14px; font-style: italic; color: #555;">JLT Dev Team</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 15px 0;" />
                    <p style="font-size: 11px; text-align: center; color: #888; margin: 0;">
                        This is an automated notification from POMS (PDFMNHS Online Management System).<br/>Please do not reply to this email.
                    </p>
                </div>
            </div>
            `
        };

        // Send the email asynchronously 
        const emailSent = await sendCredentialEmail(mailOptions);

        res.json({ 
            success: true, 
            message: emailSent ? "Learner and Parent accounts created! Credentials have been emailed." : "Accounts created, but email delivery failed. Please save the credentials shown below.",
            emailSent,
            credentials: {
                emailSentTo: emailSent ? data.email : null,
                emailSent,
                learnerUsername,
                learnerPassword,
                parentUsername,
                parentPassword
            }
        });

    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        if (err.code === '23505') return res.status(400).json({ error: "LRN already exists in the system." });
        sendError(res, err, "Failed to create accounts.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.post('/api/admin/accounts/faculty', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    let client;
    let transactionOpen = false;
    try {
        client = await pool.connect();
        const data = req.body;
        // Generating a secure password to match the format used for learners
        const generatedPassword = randomBytes(12).toString('base64url') + "Cc3!";
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        const facultyUsername = data.employeeNo;

        await client.query('BEGIN');
        transactionOpen = true;

        const userResult = await client.query(
            `INSERT INTO users (username, password_hash, role_id, requires_password_change) VALUES ($1, $2, $3, TRUE) RETURNING id`,
            [facultyUsername, hashedPassword, 2]
        );
        const userId = userResult.rows[0].id;

        await client.query(
            `INSERT INTO faculty_profiles (
                user_id, employee_no, first_name, middle_name, last_name, 
                email, start_school_year, contact_number
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [userId, data.employeeNo, data.firstName, data.middleName, data.lastName, data.email, data.startSchoolYear, data.contactNumber]
        );

        await client.query('COMMIT');
        transactionOpen = false;

        // --- NEW LOGIC: SEND HTML EMAIL FOR FACULTY ---
        const mailOptions = {
            from: emailFrom, 
            to: data.email, 
            subject: 'Temporary Credentials for Faculty | POMS',
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <div style="background-color: #990000; padding: 20px; border-radius: 8px 8px 0 0;">
                    <h2 style="color: white; margin: 0; font-size: 20px;">Faculty Credentials</h2>
                </div>
                
                <div style="background-color: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                    <p style="margin-top: 0;">Greetings!</p>
                    <p>Your faculty account has been created. Below are your temporary credentials:</p>
                    
                    <div style="background-color: #f9f9fb; border: 1px solid #dcdcdc; border-radius: 6px; padding: 15px; margin-bottom: 25px;">
                        <p style="margin: 0 0 10px 0; font-weight: bold; font-size: 15px;">Faculty Account</p>
                        <p style="margin: 5px 0;"><strong>Username:</strong> ${facultyUsername}</p>
                        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${generatedPassword}</p>
                    </div>

                    <p style="font-size: 14px;">Please log in to your account and change the password immediately for security.<br/>Thank you for your cooperation!</p>
                    <p style="font-size: 14px; font-style: italic; color: #555;">JLT Dev Team</p>
                    
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 15px 0;" />
                    <p style="font-size: 11px; text-align: center; color: #888; margin: 0;">
                        This is an automated notification from POMS (PDFMNHS Online Management System).<br/>Please do not reply to this email.
                    </p>
                </div>
            </div>
            `
        };

        // Send the email asynchronously 
        const emailSent = await sendCredentialEmail(mailOptions);

        res.json({ 
            success: true, 
            message: emailSent ? "Faculty account created! Credentials have been emailed." : "Account created, but email delivery failed. Please save the credentials shown below.",
            emailSent,
            credentials: {
                emailSentTo: emailSent ? data.email : null,
                emailSent,
                facultyUsername,
                learnerUsername: facultyUsername,
                password: generatedPassword
            }
        });

    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        if (err.code === '23505') return res.status(400).json({ error: "Employee Number already exists." });
        sendError(res, err, "Failed to create faculty account.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.put('/api/admin/accounts/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    let client;
    let transactionOpen = false;
    const { id } = req.params; 
    const data = req.body;

    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transactionOpen = true;

        if (data.lrn !== undefined) {
            const protectedEnrollment = await client.query(`
                SELECT 1 FROM enrollments e JOIN sections s ON s.id = e.section_id
                WHERE e.learner_id = (SELECT id FROM learner_profiles WHERE user_id = $1)
                AND e.school_year = $2 AND (
                    s.grade_level <> $3 OR (s.is_star_section AND NOT $4::boolean) OR
                    (NOT s.is_star_section AND $4::boolean AND EXISTS (SELECT 1 FROM sections WHERE grade_level = $3 AND is_star_section))
                ) AND (s.grade_level <> $3
                    OR EXISTS (SELECT 1 FROM grades WHERE enrollment_id = e.id)
                    OR EXISTS (SELECT 1 FROM student_scores WHERE enrollment_id = e.id)) LIMIT 1
            `, [id, data.schoolYear, data.gradeLevel, data.isStarEligible]);
            if (protectedEnrollment.rows.length) throw httpError(409, 'This change would move or remove an existing enrollment. Review the section assignment before changing grade level or star eligibility.');
            const previousLearner = await client.query('SELECT lrn FROM learner_profiles WHERE user_id = $1', [id]);
            if (previousLearner.rows.length === 0) {
                await client.query('ROLLBACK');
                transactionOpen = false;
                return res.status(404).json({ error: "Learner profile not found." });
            }

            const oldLrn = previousLearner.rows[0].lrn;
            const parentProfile = await client.query('SELECT user_id FROM parent_profiles WHERE linked_lrn = $1 LIMIT 1', [oldLrn]);
            const parentUserId = parentProfile.rows[0]?.user_id;

            await client.query('UPDATE users SET username = $1 WHERE id = $2', [data.lrn, id]);
            
            // 1. Update Profile and capture the profile ID (Added RETURNING id)
            const profileUpdate = await client.query(
                `UPDATE learner_profiles 
                 SET lrn = $1, first_name = $2, middle_name = $3, last_name = $4, email = $5,
                     birthdate = $6, gender = $7, school_year = $8, grade_level = $9, is_star_eligible = $10,
                     mother_tongue = $11, ethnic_group = $12, religion = $13, house_street = $14,
                     barangay = $15, city = $16, province = $17, father_first = $18, father_middle = $19,
                     father_last = $20, mother_first = $21, mother_middle = $22, mother_last = $23,
                     guardian_name = $24, guardian_relationship = $25, contact_number = $26
                 WHERE user_id = $27
                 RETURNING id`,
                [
                    data.lrn, data.firstName, data.middleName, data.lastName, data.email,
                    data.birthdate, data.gender, data.schoolYear, data.gradeLevel, data.isStarEligible,
                    data.motherTongue, data.ip, data.religion, data.houseStreet, data.barangay,
                    data.city, data.province, data.fatherFirst, data.fatherMiddle, data.fatherLast,
                    data.motherFirst, data.motherMiddle, data.motherLast, data.guardianName, 
                    data.guardianRelation, data.contactNumber, id
                ]
            );
            
            const learnerProfileId = profileUpdate.rows[0].id;

            // --- NEW LOGIC: DYNAMIC STAR SECTION HANDLING ---
            const starSectionResult = await client.query(
                `SELECT id FROM sections WHERE grade_level = $1 AND is_star_section = TRUE`,
                [data.gradeLevel]
            );

            if (starSectionResult.rows.length > 0) {
                const starSectionId = starSectionResult.rows[0].id;

                if (data.isStarEligible) {
                    // Check if they are already enrolled somewhere for this school year
                    const currentEnrollment = await client.query(
                        `SELECT id, section_id FROM enrollments WHERE learner_id = $1 AND school_year = $2`,
                        [learnerProfileId, data.schoolYear]
                    );

                    if (currentEnrollment.rows.length > 0) {
                        // If enrolled in a DIFFERENT section, move them to the Star Section
                        if (currentEnrollment.rows[0].section_id !== starSectionId) {
                            await client.query(
                                `UPDATE enrollments SET section_id = $1 WHERE id = $2`,
                                [starSectionId, currentEnrollment.rows[0].id]
                            );
                        }
                    } else {
                        // Not enrolled yet, so create a new enrollment in the Star Section
                        await client.query(
                            `INSERT INTO enrollments (learner_id, section_id, school_year) VALUES ($1, $2, $3)`,
                            [learnerProfileId, starSectionId, data.schoolYear]
                        );
                    }
                } else {
                    // If they are NO LONGER star eligible, check if they are currently sitting in the Star Section
                    // If they are, remove them so the admin can reassign them manually.
                    await client.query(
                        `DELETE FROM enrollments WHERE learner_id = $1 AND section_id = $2 AND school_year = $3`,
                        [learnerProfileId, starSectionId, data.schoolYear]
                    );
                }
            }

            // Update Parent Login and Profile Links
            const newParentUsername = `P-${data.lrn}`;
            if (parentUserId) {
                await client.query('UPDATE users SET username = $1 WHERE id = $2', [newParentUsername, parentUserId]);
                await client.query('UPDATE parent_profiles SET linked_lrn = $1 WHERE user_id = $2', [data.lrn, parentUserId]);
            }
            
        } else if (data.employeeNo !== undefined) {
            const faculty = await client.query('SELECT id FROM faculty_profiles WHERE user_id = $1', [id]);
            if (!faculty.rows.length) throw httpError(404, 'Faculty profile not found.');
            await client.query('UPDATE users SET username = $1 WHERE id = $2', [data.employeeNo, id]);
            await client.query(
                `UPDATE faculty_profiles 
                 SET employee_no = $1, first_name = $2, middle_name = $3, last_name = $4, email = $5,
                     start_school_year = $6, contact_number = $7
                 WHERE user_id = $8`,
                [data.employeeNo, data.firstName, data.middleName, data.lastName, data.email, data.startSchoolYear, data.contactNumber, id]
            );
        }

        await client.query('COMMIT');
        transactionOpen = false;
        res.json({ success: true, message: "Account updated successfully!" });
    } catch (error) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        if (error.code === '23505') return res.status(400).json({ error: "That LRN or Employee Number is already in use by another account." });
        sendError(res, error, "Failed to update account in the database.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.delete('/api/admin/accounts/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    let client;
    let transactionOpen = false;
    const { id } = req.params;

    try {
        client = await pool.connect();
        const userCheck = await client.query(`
            SELECT u.role_id, l.lrn 
            FROM users u
            LEFT JOIN learner_profiles l ON u.id = l.user_id
            WHERE u.id = $1
        `, [id]);

        if (userCheck.rows.length === 0) return res.status(404).json({ error: "Account not found." });

        const { role_id, lrn } = userCheck.rows[0];
        if (![ROLES.LEARNER, ROLES.FACULTY].includes(role_id)) throw httpError(403, 'Only learner and faculty accounts can be deleted here.');
        const recorded = role_id === ROLES.LEARNER
            ? await client.query(`
                SELECT 1 FROM enrollments e JOIN learner_profiles lp ON lp.id = e.learner_id
                WHERE lp.user_id = $1 AND (
                    EXISTS (SELECT 1 FROM grades WHERE enrollment_id = e.id)
                    OR EXISTS (SELECT 1 FROM student_scores WHERE enrollment_id = e.id)
                ) LIMIT 1
            `, [id])
            : await client.query(`
                SELECT 1 FROM faculty_loads fl JOIN faculty_profiles fp ON fp.id = fl.faculty_id
                WHERE fp.user_id = $1 AND (
                    EXISTS (SELECT 1 FROM grades WHERE faculty_load_id = fl.id)
                    OR EXISTS (SELECT 1 FROM student_scores ss JOIN grade_items gi ON gi.id = ss.grade_item_id WHERE gi.faculty_load_id = fl.id)
                ) LIMIT 1
            `, [id]);
        if (recorded.rows.length) throw httpError(409, 'This account has recorded grades. Deleting it would remove academic records.');

        await client.query('BEGIN');
        transactionOpen = true;

        if (role_id === 3 && lrn) {
            const parentUsername = `P-${lrn}`;
            await client.query('DELETE FROM parent_profiles WHERE linked_lrn = $1', [lrn]);
            await client.query('DELETE FROM users WHERE username = $1 AND role_id = 4', [parentUsername]);
        }

        await client.query('DELETE FROM faculty_profiles WHERE user_id = $1', [id]);
        await client.query('DELETE FROM learner_profiles WHERE user_id = $1', [id]);
        await client.query('DELETE FROM users WHERE id = $1', [id]);
        
        await client.query('COMMIT');
        transactionOpen = false;

        res.json({ success: true, message: "Account (and any linked profiles) deleted successfully!" });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Failed to delete account. They may have dependent records (like grades).");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

// --- Faculty Loads (Admin Setup) ---
app.get('/api/admin/faculty-loads/form-data', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const faculty = await pool.query('SELECT id, first_name, last_name, employee_no FROM faculty_profiles ORDER BY last_name ASC');
        const subjects = await pool.query('SELECT id, subject_name FROM subjects ORDER BY subject_name ASC');
        const sections = await pool.query('SELECT id, section_name, grade_level FROM sections ORDER BY grade_level ASC, section_name ASC');
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');

        res.json({ 
            success: true, 
            faculty: faculty.rows,
            subjects: subjects.rows,
            sections: sections.rows,
            active_school_year: settings.rows[0]?.current_school_year || "Not Set"
        });
    } catch (err) {
        sendError(res, err, "Failed to fetch form data.");
    }
});

app.post('/api/admin/faculty-loads', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    let client;
    let transactionOpen = false;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        transactionOpen = true;
        const { faculty_id, subject_id, section_id } = req.body;
        const settings = await getSystemSettings();
        const school_year = settings?.current_school_year;

        if (!school_year) return res.status(400).json({ error: "Current school year is not set." });

        await client.query('SELECT id FROM faculty_profiles WHERE id = $1 FOR UPDATE', [faculty_id]);
        await client.query('SELECT id FROM sections WHERE id = $1 FOR UPDATE', [section_id]);
        const assignment = await client.query('SELECT id FROM faculty_loads WHERE section_id = $1 AND subject_id = $2 AND school_year = $3', [section_id, subject_id, school_year]);
        if (assignment.rows.length) throw httpError(409, 'This section already has a teacher assigned for this subject.');
        // --- NEW TRAP: Max 7 loads per faculty ---
        const loadCheck = await client.query(
            `SELECT COUNT(*) FROM faculty_loads WHERE faculty_id = $1 AND school_year = $2`,
            [faculty_id, school_year]
        );
        
        if (parseInt(loadCheck.rows[0].count) >= 7) {
            return res.status(400).json({ 
                error: "This faculty member has already reached the maximum limit of 7 loads for this school year." 
            });
        }

        await client.query(
            `INSERT INTO faculty_loads (faculty_id, subject_id, section_id, school_year) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [faculty_id, subject_id, section_id, school_year]
        );

        await client.query('COMMIT');
        transactionOpen = false;
        res.json({ success: true, message: "Faculty load assigned successfully!" });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        if (err.code === '23505') return res.status(400).json({ error: "This exact faculty load already exists for this school year." });
        sendError(res, err, "Failed to assign faculty load.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.get('/api/admin/faculty-loads', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        const result = await pool.query(`
            SELECT fl.id, f.first_name, f.last_name, s.subject_name, sec.section_name, sec.grade_level
            FROM faculty_loads fl
            JOIN faculty_profiles f ON fl.faculty_id = f.id
            JOIN subjects s ON fl.subject_id = s.id
            JOIN sections sec ON fl.section_id = sec.id
            WHERE fl.school_year = $1
            ORDER BY sec.grade_level ASC, sec.section_name ASC, s.subject_name ASC
        `, [activeYear]);
        
        res.json({ success: true, loads: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch faculty loads.");
    }
});

app.delete('/api/admin/faculty-loads/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        const recorded = await pool.query(`
            SELECT 1 FROM grades WHERE faculty_load_id = $1
            UNION ALL SELECT 1 FROM student_scores ss JOIN grade_items gi ON gi.id = ss.grade_item_id WHERE gi.faculty_load_id = $1 LIMIT 1
        `, [id]);
        if (recorded.rows.length) throw httpError(409, 'This teaching assignment has recorded grades and cannot be removed.');
        const result = await pool.query('DELETE FROM faculty_loads WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: "Load not found." });
        res.json({ success: true, message: "Faculty load removed successfully!" });
    } catch (err) {
        sendError(res, err, "Failed to remove load. Dependent grades might already exist.");
    }
});

// --- Grading Setup ---
app.get('/api/admin/grading', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, subject_name, ww_weight, pt_weight, ex_weight FROM subjects ORDER BY subject_name ASC');
        res.json({ success: true, subjects: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch grading setup.");
    }
});

// --- Enrollments & Sectioning ---
app.get('/api/admin/enrollments/unassigned', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { grade_level } = req.query;
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        const result = await pool.query(`
            SELECT id, lrn, first_name, last_name, gender 
            FROM learner_profiles 
            WHERE grade_level = $1 
            AND id NOT IN (
                SELECT learner_id FROM enrollments WHERE school_year = $2
            )
            ORDER BY last_name ASC, first_name ASC
        `, [grade_level, activeYear]);
        
        res.json({ success: true, learners: result.rows, activeYear });
    } catch (err) {
        sendError(res, err, "Failed to fetch unassigned learners.");
    }
});

app.get('/api/admin/enrollments/section/:sectionId', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { sectionId } = req.params;
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        const result = await pool.query(`
            SELECT e.id as enrollment_id, l.id as learner_id, l.lrn, l.first_name, l.last_name, l.gender 
            FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            WHERE e.section_id = $1 AND e.school_year = $2
            ORDER BY l.gender DESC, l.last_name ASC
        `, [sectionId, activeYear]);
        
        res.json({ success: true, enrolled: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch enrolled learners.");
    }
});

app.post('/api/admin/enrollments', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { learner_id, section_id } = req.body;
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;
        if (!activeYear) throw httpError(400, 'Current school year is not set.');
        const selection = await pool.query(`
            SELECT l.grade_level AS learner_grade, s.grade_level AS section_grade,
                l.is_star_eligible, s.is_star_section
            FROM learner_profiles l CROSS JOIN sections s WHERE l.id = $1 AND s.id = $2
        `, [learner_id, section_id]);
        if (!selection.rows.length) throw httpError(404, 'Learner or section not found.');
        const selected = selection.rows[0];
        if (selected.learner_grade !== selected.section_grade) throw httpError(400, 'Learner and section must have the same grade level.');
        if (selected.is_star_section && !selected.is_star_eligible) throw httpError(400, 'This learner is not eligible for the star section.');

        await pool.query(`
            INSERT INTO enrollments (learner_id, section_id, school_year) 
            VALUES ($1, $2, $3)
        `, [learner_id, section_id, activeYear]);

        res.json({ success: true, message: "Learner officially enrolled!" });
    } catch (err) {
        sendError(res, err, "Failed to enroll learner.");
    }
});

app.delete('/api/admin/enrollments/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            DELETE FROM enrollments e WHERE e.id = $1
            AND NOT EXISTS (SELECT 1 FROM grades g WHERE g.enrollment_id = e.id)
            AND NOT EXISTS (SELECT 1 FROM student_scores ss WHERE ss.enrollment_id = e.id)
            RETURNING id
        `, [id]);
        if (!result.rows.length) throw httpError(409, 'Enrollment could not be removed. It may have recorded grades or may already have been removed.');
        res.json({ success: true, message: "Learner removed from section." });
    } catch (err) {
        if (err.code === '23503') return res.status(400).json({ error: "Cannot remove: This student already has grades recorded in this section." });
        sendError(res, err, "Failed to remove learner.");
    }
});


// ==========================================
//             FACULTY ROUTES
// ==========================================

app.get('/api/faculty/profile', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.username, f.*
            FROM users u
            JOIN faculty_profiles f ON u.id = f.user_id
            WHERE u.id = $1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Faculty profile not found." });
        }

        res.json({ success: true, faculty: result.rows[0] });
    } catch (err) {
        sendError(res, err, "Failed to fetch faculty profile.");
    }
});

app.get('/api/faculty/my-classes', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id; 

        const result = await pool.query(`
            SELECT fl.id, s.subject_name, sec.section_name, sec.grade_level
            FROM faculty_loads fl
            JOIN subjects s ON fl.subject_id = s.id
            JOIN sections sec ON fl.section_id = sec.id
            JOIN faculty_profiles fp ON fl.faculty_id = fp.id
            WHERE fp.user_id = $1 AND fl.school_year = (SELECT current_school_year FROM system_settings WHERE id = 1)
            ORDER BY sec.grade_level ASC, sec.section_name ASC
        `, [userId]);

        res.json({ success: true, loads: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch teaching loads.");
    }
});

app.get('/api/faculty/school-days', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { schoolYear, monthName } = req.query;
        const result = await pool.query(
            'SELECT total_days FROM school_calendar WHERE school_year = $1 AND month_name = $2',
            [schoolYear, monthName]
        );
        if (result.rows.length > 0) {
            res.json({ success: true, totalDays: result.rows[0].total_days });
        } else {
            res.json({ success: true, totalDays: "" }); 
        }
    } catch (err) {
        sendError(res, err, "Failed to fetch school days.");
    }
});

app.get('/api/faculty/attendance', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { schoolYear, monthName } = req.query;
        if (!schoolYear || !monthName) return res.status(400).json({ error: "School year and month are required." });

        const result = await pool.query(
            `SELECT ma.learner_id as student_id, ma.days_absent as absent, ma.days_tardy as tardy
             FROM monthly_attendance ma
             JOIN enrollments e ON e.learner_id = ma.learner_id AND e.school_year = ma.school_year
             JOIN section_advisories sa ON sa.section_id = e.section_id AND sa.school_year = e.school_year
             JOIN faculty_profiles fp ON fp.id = sa.faculty_id
             WHERE ma.school_year = $1 AND ma.month_name = $2 AND fp.user_id = $3`,
            [schoolYear, monthName, req.user.id]
        );

        res.json({ success: true, attendance: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch attendance records.");
    }
});

app.post('/api/faculty/attendance', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    let client;
    let transactionOpen = false;
    
    try {
        const { schoolYear, monthName, records } = req.body;
        if (!records || records.length === 0) return res.status(400).json({ error: "No attendance records provided." });
        const settings = await getSystemSettings();
        if (schoolYear !== settings.current_school_year) throw httpError(403, 'Attendance can only be changed for the current school year.');
        const ownedIds = await getAdvisoryLearnerIds(req.user.id, schoolYear);
        if (records.some(record => !ownedIds.has(Number(record.student_id)))) throw httpError(403, 'You can only record attendance for your advisory learners.');
        const days = await pool.query('SELECT total_days FROM school_calendar WHERE school_year = $1 AND month_name = $2', [schoolYear, monthName]);
        if (!days.rows.length) throw httpError(400, 'The administrator must configure school days for this month first.');
        if (records.some(record => Number(record.absent) > days.rows[0].total_days || Number(record.tardy) > days.rows[0].total_days)) throw httpError(400, 'Absences and tardiness cannot exceed the school days for this month.');
        client = await pool.connect();

        await client.query('BEGIN');
        transactionOpen = true;

        for (const record of records) {
            await client.query(
                `INSERT INTO monthly_attendance (learner_id, school_year, month_name, days_absent, days_tardy) 
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (learner_id, school_year, month_name) 
                 DO UPDATE SET 
                    days_absent = EXCLUDED.days_absent, 
                    days_tardy = EXCLUDED.days_tardy`,
                [record.student_id, schoolYear, monthName, record.absent, record.tardy]
            );
        }

        await client.query('COMMIT');
        transactionOpen = false;
        res.json({ success: true, message: "Attendance saved successfully!" });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Failed to save attendance records.");
    } finally {
        client?.release();
    }
});

app.get('/api/faculty/core-values', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { learnerId, schoolYear, trimester } = req.query;
        if (!learnerId || !schoolYear || !trimester) {
            return res.status(400).json({ error: "Missing required parameters." });
        }
        const ownedIds = await getAdvisoryLearnerIds(req.user.id, schoolYear);
        if (!ownedIds.has(Number(learnerId))) throw httpError(403, 'You can only view core values for your advisory learners.');

        const result = await pool.query(
            `SELECT md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2 
             FROM core_values_grades 
             WHERE learner_id = $1 AND school_year = $2 AND trimester = $3`,
            [learnerId, schoolYear, parseInt(trimester)]
        );

        res.json({ success: true, data: result.rows[0] || null });
    } catch (err) {
        sendError(res, err, "Failed to fetch observed values.");
    }
});

app.post('/api/faculty/core-values', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { learnerId, schoolYear, trimester, md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2 } = req.body;
    try {
        const settings = await getSystemSettings();
        if (schoolYear !== settings.current_school_year || Number(trimester) !== settings.active_trisemester) throw httpError(403, 'Core values can only be changed for the active school year and trimester.');
        const ownedIds = await getAdvisoryLearnerIds(req.user.id, schoolYear);
        if (!ownedIds.has(Number(learnerId))) throw httpError(403, 'You can only record core values for your advisory learners.');
        await pool.query(
            `INSERT INTO core_values_grades 
             (learner_id, school_year, trimester, md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (learner_id, school_year, trimester) 
             DO UPDATE SET 
                md_1 = EXCLUDED.md_1, md_2 = EXCLUDED.md_2, 
                mt_1 = EXCLUDED.mt_1, mt_2 = EXCLUDED.mt_2, 
                mk_1 = EXCLUDED.mk_1, mb_1 = EXCLUDED.mb_1, mb_2 = EXCLUDED.mb_2`,
            [learnerId, schoolYear, parseInt(trimester), md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2]
        );
        res.json({ success: true, message: "Observed values saved successfully." });
    } catch (err) {
        sendError(res, err, "Failed to save observed values.");
    }
});

app.get('/api/faculty/gradebook/:loadId', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { loadId } = req.params;
        const settings = await getSystemSettings();
        const trimester = req.query.trimester ? parseInt(req.query.trimester) : settings.active_trisemester;

        const weights = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!weights) return res.status(403).json({ error: "Access denied. You do not teach this class." });
        if (weights.school_year !== settings?.current_school_year) return res.status(403).json({ error: "This class is not part of the current school year." });

        const result = await pool.query(`
            SELECT 
                e.id as enrollment_id, l.first_name, l.last_name, l.lrn,
                g.initial_grade, g.transmuted_grade
            FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            JOIN faculty_loads fl ON e.section_id = fl.section_id AND e.school_year = fl.school_year
            LEFT JOIN grades g ON e.id = g.enrollment_id AND g.faculty_load_id = fl.id AND g.trimester = $2
            WHERE fl.id = $1
            ORDER BY l.last_name ASC, l.first_name ASC
        `, [loadId, trimester]);

        const scoresResult = await pool.query(`
            SELECT ss.enrollment_id, ss.grade_item_id, ss.score
            FROM student_scores ss
            JOIN grade_items gi ON ss.grade_item_id = gi.id
            WHERE gi.faculty_load_id = $1 AND gi.trimester = $2
        `, [loadId, trimester]);

        res.json({ 
            success: true, 
            students: result.rows,
            itemScores: scoresResult.rows,
            weights: { ww: weights.ww_weight, pt: weights.pt_weight, ex: weights.ex_weight }
        });
    } catch (err) {
        sendError(res, err, "Failed to fetch gradebook data.");
    }
});

app.get('/api/faculty/grade-items/:loadId', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { loadId } = req.params;
        const settings = await getSystemSettings();
        const trimester = req.query.trimester ? parseInt(req.query.trimester) : settings.active_trisemester;

        const ownedLoad = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!ownedLoad) return res.status(403).json({ error: "Access denied. You do not teach this class." });
        if (ownedLoad.school_year !== settings.current_school_year) throw httpError(403, 'This class is not part of the current school year.');
        
        const result = await pool.query(`
            SELECT id, component, item_name, max_score 
            FROM grade_items 
            WHERE faculty_load_id = $1 AND trimester = $2
            ORDER BY component DESC, id ASC
        `, [loadId, trimester]);

        res.json({ items: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch grade items.");
    }
});

app.post('/api/faculty/grade-items', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { loadId, trimester, component, name, max } = req.body;
    let client;
    let transactionOpen = false;
    try {
        const settings = await getSystemSettings();
        const activeTrimester = ensureActiveTrimester(trimester, settings, res);
        if (!activeTrimester) return;

        const ownedLoad = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!ownedLoad || ownedLoad.school_year !== settings?.current_school_year) {
            return res.status(403).json({ error: "Access denied. You do not teach this class." });
        }

        client = await pool.connect();
        await client.query('BEGIN');
        transactionOpen = true;
        await client.query('SELECT id FROM faculty_loads WHERE id = $1 FOR UPDATE', [loadId]);
        const result = await client.query(
            'INSERT INTO grade_items (faculty_load_id, trimester, component, item_name, max_score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [loadId, activeTrimester, component, name, max]
        );
        await recomputeGrades(client, loadId, activeTrimester);
        await client.query('COMMIT');
        transactionOpen = false;
        res.json({ success: true, newItem: result.rows[0] });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Failed to add item.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.delete('/api/faculty/grade-items/:id', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    let client;
    let transactionOpen = false;
    try {
        const { id } = req.params;
        const itemCheck = await pool.query(`
            SELECT gi.id, gi.trimester, fl.id as load_id, fl.school_year
            FROM grade_items gi
            JOIN faculty_loads fl ON gi.faculty_load_id = fl.id
            JOIN faculty_profiles fp ON fl.faculty_id = fp.id
            WHERE gi.id = $1 AND fp.user_id = $2
        `, [id, req.user.id]);

        if (itemCheck.rows.length === 0) return res.status(403).json({ error: "Access denied. You do not own this grade item." });

        const settings = await getSystemSettings();
        if (itemCheck.rows[0].school_year !== settings.current_school_year) throw httpError(403, 'This class is not part of the current school year.');
        const activeTrimester = ensureActiveTrimester(itemCheck.rows[0].trimester, settings, res);
        if (!activeTrimester) return;

        client = await pool.connect();
        await client.query('BEGIN');
        transactionOpen = true;
        await client.query('SELECT id FROM faculty_loads WHERE id = $1 FOR UPDATE', [itemCheck.rows[0].load_id]);
        await client.query('DELETE FROM grade_items WHERE id = $1', [id]);
        await recomputeGrades(client, itemCheck.rows[0].load_id, activeTrimester);
        await client.query('COMMIT');
        transactionOpen = false;
        
        res.json({ success: true, message: "Grade item deleted successfully." });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Failed to delete grade item.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

app.post('/api/faculty/save-grades', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { loadId, trimester, scores } = req.body;

    let client;
    let transactionOpen = false;
    try {
        const settings = await getSystemSettings();
        const activeTrimester = ensureActiveTrimester(trimester, settings, res);
        if (!activeTrimester) return;

        const ownedLoad = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!ownedLoad || ownedLoad.school_year !== settings?.current_school_year) {
            return res.status(403).json({ error: "Access denied." });
        }

        const safeScores = Array.isArray(scores) ? scores : [];
        const gradeItemIds = [...new Set(safeScores.map(s => Number(s.grade_item_id)).filter(Boolean))];
        const enrollmentIds = [...new Set(safeScores.map(s => Number(s.enrollment_id)).filter(Boolean))];

        client = await pool.connect();
        if (gradeItemIds.length > 0) {
            const itemCheck = await client.query(
                'SELECT id, max_score FROM grade_items WHERE id = ANY($1::int[]) AND faculty_load_id = $2 AND trimester = $3',
                [gradeItemIds, loadId, activeTrimester]
            );
            if (itemCheck.rows.length !== gradeItemIds.length) return res.status(403).json({ error: "Invalid grade items." });
            const maximums = new Map(itemCheck.rows.map(item => [Number(item.id), Number(item.max_score)]));
            if (safeScores.some(score => score.score !== null && Number(score.score) > maximums.get(Number(score.grade_item_id)))) throw httpError(400, "A score cannot exceed the maximum score for its item.");
        }

        if (enrollmentIds.length > 0) {
            const enrollmentCheck = await client.query(`
                SELECT COUNT(*)::int as count
                FROM enrollments e
                JOIN faculty_loads fl ON e.section_id = fl.section_id AND e.school_year = fl.school_year
                WHERE e.id = ANY($1::int[]) AND fl.id = $2
            `, [enrollmentIds, loadId]);
            if (enrollmentCheck.rows[0].count !== enrollmentIds.length) return res.status(403).json({ error: "Invalid learners." });
        }

        await client.query('BEGIN');
        transactionOpen = true;
        // Serialize grade changes for a class so concurrent saves cannot overwrite computed results.
        await client.query('SELECT id FROM faculty_loads WHERE id = $1 FOR UPDATE', [loadId]);
        for (const s of safeScores) {
            if (s.score === null) {
                await client.query('DELETE FROM student_scores WHERE enrollment_id = $1 AND grade_item_id = $2', [s.enrollment_id, s.grade_item_id]);
                continue;
            }
            await client.query(`
                INSERT INTO student_scores (enrollment_id, grade_item_id, score) 
                VALUES ($1, $2, $3) 
                ON CONFLICT (grade_item_id, enrollment_id) 
                DO UPDATE SET score = EXCLUDED.score
            `, [s.enrollment_id, s.grade_item_id, s.score]);
        }

        await recomputeGrades(client, loadId, activeTrimester);
        await client.query('COMMIT');
        transactionOpen = false;

        res.json({ success: true, message: "Grades successfully saved and computed!" });
    } catch (err) {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        transactionOpen = false;
        sendError(res, err, "Failed to save and compute grades.");
    } finally {
        if (client && transactionOpen) await client.query('ROLLBACK').catch(() => {});
        client?.release();
    }
});

// --- Homeroom Advisory & SF Forms ---
app.get('/api/faculty/advisory-students', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const facultyId = req.user.id;
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        const result = await pool.query(
            `SELECT l.id, l.lrn, l.first_name || ' ' || l.last_name AS name, l.gender 
             FROM section_advisories sa
             JOIN enrollments e ON sa.section_id = e.section_id AND sa.school_year = e.school_year
             JOIN learner_profiles l ON e.learner_id = l.id
             JOIN faculty_profiles fp ON sa.faculty_id = fp.id
             WHERE fp.user_id = $1 AND sa.school_year = $2
             ORDER BY l.gender DESC, l.last_name ASC`, 
            [facultyId, activeYear]
        );

        res.json({ success: true, students: result.rows });
    } catch (err) {
        sendError(res, err, "Failed to fetch advisory students.");
    }
});

app.get('/api/faculty/advisory-class', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        const adviserCheck = await pool.query(`
            SELECT sa.section_id, s.section_name, s.grade_level
            FROM section_advisories sa
            JOIN sections s ON sa.section_id = s.id
            JOIN faculty_profiles fp ON sa.faculty_id = fp.id
            WHERE fp.user_id = $1 AND sa.school_year = $2
        `, [userId, activeYear]);

        if (adviserCheck.rows.length === 0) return res.json({ success: true, isAdviser: false, message: "You are not assigned as a homeroom adviser." });

        const { section_id, section_name, grade_level } = adviserCheck.rows[0];

        const students = await pool.query(`
            SELECT e.id as enrollment_id, l.id as learner_id, e.grades_visible, l.lrn, l.first_name, l.middle_name, l.last_name, l.gender
            FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            WHERE e.section_id = $1 AND e.school_year = $2
            ORDER BY l.gender DESC, l.last_name ASC, l.first_name ASC
        `, [section_id, activeYear]);

        const grades = await pool.query(`
            SELECT 
                g.enrollment_id, g.trimester, g.transmuted_grade, sub.subject_name
            FROM grades g
            JOIN faculty_loads fl ON g.faculty_load_id = fl.id
            JOIN subjects sub ON fl.subject_id = sub.id
            WHERE fl.section_id = $1 AND fl.school_year = $2
        `, [section_id, activeYear]);

        res.json({
            success: true, isAdviser: true,
            section: { id: section_id, name: section_name, grade_level },
            school_year: activeYear, students: students.rows, grades: grades.rows
        });

    } catch (err) {
        sendError(res, err, "Failed to fetch advisory class data.");
    }
});

app.put('/api/faculty/advisory-class/visibility/:enrollmentId', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const { isVisible } = req.body;
        const result = await pool.query(`
            UPDATE enrollments e SET grades_visible = $1
            FROM section_advisories sa JOIN faculty_profiles fp ON fp.id = sa.faculty_id
            WHERE e.id = $2 AND sa.section_id = e.section_id AND sa.school_year = e.school_year
            AND fp.user_id = $3 AND e.school_year = (SELECT current_school_year FROM system_settings WHERE id = 1)
            RETURNING e.id
        `, [isVisible, enrollmentId, req.user.id]);
        if (!result.rows.length) throw httpError(403, 'You can only change visibility for your current advisory class.');
        res.json({ success: true, message: "Visibility updated." });
    } catch (err) {
        sendError(res, err, "Failed to update visibility.");
    }
});

app.get('/api/faculty/advisory-class/sf1', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await getSystemSettings();
        const activeYear = settings?.current_school_year;

        const sectionCheck = await pool.query(`
            SELECT s.section_name, s.grade_level
            FROM section_advisories sa
            JOIN sections s ON sa.section_id = s.id
            JOIN faculty_profiles fp ON sa.faculty_id = fp.id
            WHERE fp.user_id = $1 AND sa.school_year = $2
        `, [userId, activeYear]);

        if (sectionCheck.rows.length === 0) return res.status(403).json({ error: "Not an adviser." });

        const students = await pool.query(`
            SELECT l.* FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            WHERE e.section_id = (SELECT section_id FROM section_advisories sa JOIN faculty_profiles fp ON sa.faculty_id = fp.id WHERE fp.user_id = $1 AND sa.school_year = $2)
            ORDER BY l.gender DESC, l.last_name ASC
        `, [userId, activeYear]);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(__dirname, 'templates', 'SF1template.xlsx'));
        const worksheet = workbook.getWorksheet(1);

        worksheet.getCell('AB4').value = sectionCheck.rows[0].grade_level; 
        worksheet.getCell('AN4').value = sectionCheck.rows[0].section_name; 
        worksheet.getCell('T4').value = activeYear; 

        const males = students.rows.filter(s => s.gender === 'Male').sort((a, b) => a.last_name.localeCompare(b.last_name));
        const females = students.rows.filter(s => s.gender === 'Female').sort((a, b) => a.last_name.localeCompare(b.last_name));

        const populateRow = (student, currentRow) => {
            worksheet.getCell(`A${currentRow}`).value = student.lrn;
            worksheet.getCell(`C${currentRow}`).value = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`;
            worksheet.getCell(`G${currentRow}`).value = student.gender === 'Male' ? 'M' : 'F';
            worksheet.getCell(`H${currentRow}`).value = student.birthdate ? new Date(student.birthdate).toLocaleDateString() : ''; 
            worksheet.getCell(`M${currentRow}`).value = student.mother_tongue;
            worksheet.getCell(`N${currentRow}`).value = student.ethnic_group;
            worksheet.getCell(`O${currentRow}`).value = student.religion;
            worksheet.getCell(`Q${currentRow}`).value = student.house_street;
            worksheet.getCell(`T${currentRow}`).value = student.barangay;
            worksheet.getCell(`V${currentRow}`).value = student.city;
            worksheet.getCell(`AA${currentRow}`).value = student.province;
            worksheet.getCell(`AE${currentRow}`).value = student.father_last ? `${student.father_last}, ${student.father_first}, ${student.father_middle || ''}` : '';
            worksheet.getCell(`AJ${currentRow}`).value = student.mother_last ? `${student.mother_last}, ${student.mother_first}, ${student.mother_middle || ''}` : '';
            worksheet.getCell(`AN${currentRow}`).value = student.guardian_name;
            worksheet.getCell(`AO${currentRow}`).value = student.guardian_relationship;
            worksheet.getCell(`AQ${currentRow}`).value = student.contact_number;
        };

        let maleRow = 7;
        males.forEach(student => { if (maleRow < 32) { populateRow(student, maleRow); maleRow++; }});
        worksheet.getCell('A32').value = males.length; 

        let femaleRow = 33;
        females.forEach(student => { if (femaleRow < 55) { populateRow(student, femaleRow); femaleRow++; }});
        worksheet.getCell('A55').value = females.length; 
        worksheet.getCell('A56').value = males.length + females.length; 

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + `SF1_${sectionCheck.rows[0].section_name}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        sendError(res, err, "Failed to generate SF1.");
    }
});

app.get('/api/faculty/advisory-class/sf2', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await getSystemSettings();
        const activeYear = settings?.current_school_year;

        const sectionCheck = await pool.query(`
            SELECT s.section_name, s.grade_level
            FROM section_advisories sa
            JOIN sections s ON sa.section_id = s.id
            JOIN faculty_profiles fp ON sa.faculty_id = fp.id
            WHERE fp.user_id = $1 AND sa.school_year = $2
        `, [userId, activeYear]);

        if (sectionCheck.rows.length === 0) return res.status(403).json({ error: "Not an adviser." });

        const students = await pool.query(`
            SELECT l.first_name, l.middle_name, l.last_name, l.gender 
            FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            WHERE e.section_id = (SELECT section_id FROM section_advisories sa JOIN faculty_profiles fp ON sa.faculty_id = fp.id WHERE fp.user_id = $1 AND sa.school_year = $2)
        `, [userId, activeYear]);

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(__dirname, 'templates', 'SF2template.xlsx'));
        const worksheet = workbook.getWorksheet(1);

        worksheet.getCell('C8').value = 'Prudencia D. Fule Memorial National High School';
        worksheet.getCell('Y8').value = sectionCheck.rows[0].grade_level;
        worksheet.getCell('AH8').value = sectionCheck.rows[0].section_name;
        worksheet.getCell('L6').value = activeYear;

        const males = students.rows.filter(s => s.gender === 'Male').sort((a, b) => a.last_name.localeCompare(b.last_name));
        const females = students.rows.filter(s => s.gender === 'Female').sort((a, b) => a.last_name.localeCompare(b.last_name));

        let maleRow = 14, maleIndex = 1;
        males.forEach(student => {
            worksheet.getCell(`A${maleRow}`).value = maleIndex; 
            worksheet.getCell(`B${maleRow}`).value = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`;
            maleRow++; maleIndex++;
        });

        let femaleRow = 36, femaleIndex = 1;
        females.forEach(student => {
            worksheet.getCell(`A${femaleRow}`).value = femaleIndex; 
            worksheet.getCell(`B${femaleRow}`).value = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`;
            femaleRow++; femaleIndex++;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + `SF2_${sectionCheck.rows[0].section_name}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        sendError(res, err, "Failed to generate SF2.");
    }
});


// ==========================================
//        LEARNER & PARENT PORTALS
// ==========================================

async function getGradesForLearnerUser(userId, requestedTrimester = null) {
    const settings = await getSystemSettings();
    const activeYear = settings?.current_school_year;
    const targetTrimester = requestedTrimester || Number(settings?.active_trisemester);

    const learnerResult = await pool.query(`
        SELECT id, lrn, first_name, middle_name, last_name, grade_level
        FROM learner_profiles
        WHERE user_id = $1
    `, [userId]);

    if (learnerResult.rows.length === 0) return { settings, learner: null, enrollment: null, grades: [] };

    const learner = learnerResult.rows[0];
    
    const enrollmentResult = await pool.query(`
        SELECT e.id as enrollment_id, s.section_name, s.grade_level, e.grades_visible 
        FROM enrollments e
        JOIN sections s ON e.section_id = s.id
        WHERE e.learner_id = $1 AND e.school_year = $2
        ORDER BY e.id DESC LIMIT 1
    `, [learner.id, activeYear]);

    let enrollment = null, grades = [];

    if (enrollmentResult.rows.length > 0) {
        enrollment = enrollmentResult.rows[0];
        if (enrollment.grades_visible) {
            const gradesResult = await pool.query(`
                SELECT 
                    sub.subject_name, g.initial_grade, g.transmuted_grade, 
                    f.first_name as faculty_first_name, f.last_name as faculty_last_name
                FROM grades g
                JOIN faculty_loads fl ON g.faculty_load_id = fl.id
                JOIN subjects sub ON fl.subject_id = sub.id
                JOIN faculty_profiles f ON fl.faculty_id = f.id
                WHERE g.enrollment_id = $1 AND g.trimester = $2
            `, [enrollment.enrollment_id, targetTrimester]); 
            
            grades = gradesResult.rows;
        }
    }

    return { settings, learner, enrollment, grades };
}

app.get('/api/learner/grades', verifyToken, requireRole(ROLES.LEARNER), async (req, res) => {
    try {
        const requestedTri = req.query.trimester ? parseInt(req.query.trimester) : null;
        const data = await getGradesForLearnerUser(req.user.id, requestedTri);

        res.json({
            success: true,
            school_year: data.settings?.current_school_year,
            active_trisemester: data.settings?.active_trisemester,
            learner: data.learner,
            enrollment: data.enrollment,
            grades: data.grades
        });
    } catch (err) {
        sendError(res, err, "Failed to fetch learner grades.");
    }
});

app.get('/api/parent/profile', verifyToken, requireRole(ROLES.PARENT), async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                u.username,
                p.linked_lrn,
                COALESCE(NULLIF(l.guardian_name, ''), 'Parent') AS first_name,
                '' AS last_name,
                l.first_name AS learner_first_name,
                l.last_name AS learner_last_name
            FROM users u
            JOIN parent_profiles p ON u.id = p.user_id
            LEFT JOIN learner_profiles l ON p.linked_lrn = l.lrn
            WHERE u.id = $1
            LIMIT 1
        `, [req.user.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Parent profile not found." });
        }

        res.json({ success: true, parent: result.rows[0] });
    } catch (err) {
        sendError(res, err, "Failed to fetch parent profile.");
    }
});

app.get('/api/parent/children-grades', verifyToken, requireRole(ROLES.PARENT), async (req, res) => {
    try {
        const settings = await getSystemSettings();
        const requestedTri = req.query.trimester ? parseInt(req.query.trimester) : null;

        const parentResult = await pool.query(
            'SELECT linked_lrn FROM parent_profiles WHERE user_id = $1',
            [req.user.id]
        );

        if (parentResult.rows.length === 0) {
            return res.json({ success: true, school_year: settings?.current_school_year, active_trisemester: settings?.active_trisemester, children: [] });
        }

        const children = [];
        for (const parentProfile of parentResult.rows) {
            const learnerUser = await pool.query(
                'SELECT user_id FROM learner_profiles WHERE lrn = $1',
                [parentProfile.linked_lrn]
            );

            if (learnerUser.rows.length > 0) {
                const childGrades = await getGradesForLearnerUser(learnerUser.rows[0].user_id, requestedTri);
                children.push({ learner: childGrades.learner, enrollment: childGrades.enrollment, grades: childGrades.grades });
            }
        }

        res.json({
            success: true,
            school_year: settings?.current_school_year,
            active_trisemester: settings?.active_trisemester,
            children
        });
    } catch (err) {
        sendError(res, err, "Failed to fetch child grades.");
    }
});

const PORT = process.env.PORT || 5000;
app.use('/api', (req, res) => res.status(404).json({ error: 'This endpoint was not found.' }));
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request contains invalid JSON.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'This request is too large.' });
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Images must be 5 MB or smaller.' : 'Upload one image using the image field.' });
    }
    sendError(res, err);
});

if (require.main === module) {
    if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET must be configured before starting the server.');
    app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
}
module.exports = app;
