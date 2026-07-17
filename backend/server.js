const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Added bcrypt for security
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

const verifyToken = require('./authMiddleware'); // Add this import near the top of server.js
const app = express();
app.use(cors());
app.use(express.json());

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

// Expose the 'uploads' directory publicly so the frontend can display the images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer Storage for Carousel Images
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = './uploads/carousel';
        // Create the directory if it doesn't exist
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Give the file a unique name using the current timestamp
        cb(null, 'carousel-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

const ROLES = {
    ADMIN: 1,
    FACULTY: 2,
    LEARNER: 3,
    PARENT: 4
};

const requireRole = (...allowedRoles) => (req, res, next) => {
    if (!allowedRoles.includes(req.user.role_id)) {
        return res.status(403).json({ error: "Access denied." });
    }
    next();
};

async function getSystemSettings() {
    const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
    return result.rows[0] || null;
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
    const trimester = Number(requestedTrimester || activeTrimester);

    if (!activeTrimester || trimester !== activeTrimester) {
        res.status(403).json({ error: "This trisemester is closed for grading." });
        return null;
    }

    return trimester;
}

// Database connection test route
app.get('/api/test-db', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ success: true, message: "Database connected!", time: result.rows[0].now });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Database connection failed." });
    }
});

// NEW: Register a User
app.post('/api/register', async (req, res) => {
    try {
        // 1. Get the data the user sent from the frontend/tester
        const { username, password, role_name } = req.body;

        if (role_name !== "Admin") {
            return res.status(403).json({ error: "Only the first Admin account can be registered here." });
        }

        const existingAdmin = await pool.query('SELECT id FROM users WHERE role_id = $1 LIMIT 1', [ROLES.ADMIN]);
        if (existingAdmin.rows.length > 0) {
            return res.status(403).json({ error: "Admin registration is already locked. Please create users from the Admin portal." });
        }

        // 2. Look up the ID for the role they requested
        const roleResult = await pool.query('SELECT id FROM roles WHERE role_name = $1', [role_name]);
        if (roleResult.rows.length === 0) {
            return res.status(400).json({ error: "Invalid role specified." });
        }
        const roleId = roleResult.rows[0].id;

        // 3. Scramble (hash) the password!
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // 4. Save the user to the database
        const newUser = await pool.query(
            'INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id, username, role_id',
            [username, passwordHash, roleId]
        );

        res.json({ success: true, message: "User created successfully!", user: newUser.rows[0] });

    } catch (err) {
        console.error(err.message);
        // This usually happens if the username already exists (since we set it to UNIQUE)
        res.status(500).json({ error: "Server error. Username might already be taken." });
    }
});

// NEW: Login a User
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Check if the user exists in the database
        const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        
        if (userResult.rows.length === 0) {
            return res.status(401).json({ error: "Invalid username or password." });
        }
        
        const user = userResult.rows[0];

       // 2. Compare the typed password with the scrambled one in the database
        const isMatch = await bcrypt.compare(password, user.password_hash);
        
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        // NEW: Check if the user needs to reset their password
        if (user.requires_password_change) {
            // Give them a temporary 15-minute token JUST to change their password
            const resetToken = jwt.sign(
                { id: user.id, role_id: user.role_id, pending_reset: true }, 
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

        // 3. Create the standard JWT for fully activated users
        const token = jwt.sign(
            { id: user.id, role_id: user.role_id }, 
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
        console.error(err.message);
        res.status(500).json({ error: "Server error during login." });
    }
});

// POST: Set up new password on first login
app.post('/api/auth/setup-password', verifyToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const userId = req.user.id; // Comes from the temporary token

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long." });
        }

        // Hash the new custom password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update the database and remove the reset flag
        await pool.query(
            'UPDATE users SET password_hash = $1, requires_password_change = FALSE WHERE id = $2',
            [hashedPassword, userId]
        );

        res.json({ success: true, message: "Password updated successfully! You can now log in." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to update password." });
    }
});

// Get current system settings
app.get('/api/settings', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_settings LIMIT 1');
        res.json({ success: true, settings: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch system settings." });
    }
});

// Update system settings (SUPER ADMIN ONLY)
app.put('/api/settings', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { current_school_year, active_trisemester } = req.body;
        const result = await pool.query(
            `UPDATE system_settings SET current_school_year = $1, active_trisemester = $2, updated_at = CURRENT_TIMESTAMP WHERE id = 1 RETURNING *`,
            [current_school_year, active_trisemester]
        );
        res.json({ success: true, message: "Settings updated!", settings: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to update settings." });
    }
});



// GET: Admin Dashboard Analytics
app.get('/api/admin/dashboard', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const settings = await getSystemSettings();
        const activeYear = settings?.current_school_year;

        // Run multiple count queries simultaneously for speed
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
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch dashboard analytics." });
    }
});

// ==========================================
// ADMIN: CAROUSEL MANAGEMENT
// ==========================================

// GET: Fetch all carousel images
app.get('/api/admin/carousel', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM carousel_images ORDER BY uploaded_at DESC');
        res.json({ success: true, images: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch carousel images." });
    }
});

// POST: Upload a new carousel image
app.post('/api/admin/carousel', verifyToken, requireRole(ROLES.ADMIN), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image file provided." });
        }

        // The public URL path to store in the database
        const imageUrl = `/uploads/carousel/${req.file.filename}`;

        const result = await pool.query(
            'INSERT INTO carousel_images (image_url) VALUES ($1) RETURNING *',
            [imageUrl]
        );

        res.json({ success: true, message: "Image uploaded successfully!", image: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to upload image." });
    }
});

// DELETE: Remove a carousel image
app.delete('/api/admin/carousel/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get the image URL so we can delete the actual file
        const imageCheck = await pool.query('SELECT image_url FROM carousel_images WHERE id = $1', [id]);
        if (imageCheck.rows.length === 0) {
            return res.status(404).json({ error: "Image not found." });
        }

        const filePath = path.join(__dirname, imageCheck.rows[0].image_url);

        // 2. Delete the record from the database
        await pool.query('DELETE FROM carousel_images WHERE id = $1', [id]);

        // 3. Delete the actual file from the server
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ success: true, message: "Image deleted successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to delete image." });
    }
});

// ==========================================
// ADMIN: CALENDAR OF ACTIVITIES
// ==========================================

// GET: Fetch all events (ordered by closest date first)
app.get('/api/admin/calendar', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM school_events ORDER BY event_date ASC');
        res.json({ success: true, events: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch events." });
    }
});

// POST: Add a new event
app.post('/api/admin/calendar', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { title, event_date, description } = req.body;
        const result = await pool.query(
            'INSERT INTO school_events (title, event_date, description) VALUES ($1, $2, $3) RETURNING *',
            [title, event_date, description]
        );
        res.json({ success: true, message: "Event added successfully!", event: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to add event." });
    }
});

// DELETE: Remove an event
app.delete('/api/admin/calendar/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM school_events WHERE id = $1', [id]);
        res.json({ success: true, message: "Event deleted successfully." });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to delete event." });
    }
});

// ==========================================
// ADMIN: SCHOOL DAYS (SF2)
// ==========================================

// POST: Admin sets total school days for a month
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
        console.error("Calendar Update Error:", err);
        res.status(500).json({ error: "Failed to update calendar." });
    }
});

// GET: Fetch school days for a specific year and month
app.get('/api/admin/school-days', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { schoolYear, monthName } = req.query;
        const result = await pool.query(
            'SELECT total_days FROM school_calendar WHERE school_year = $1 AND month_name = $2',
            [schoolYear, monthName]
        );
        
        if (result.rows.length > 0) {
            res.json({ success: true, totalDays: result.rows[0].total_days });
        } else {
            res.json({ success: true, totalDays: "" }); // Indicates no data saved yet
        }
    } catch (err) {
        console.error("Fetch Calendar Error:", err);
        res.status(500).json({ error: "Failed to fetch school days." });
    }
});
// Create Learner AND auto-generate Parent (Relational Architecture)
app.post('/api/admin/users/learner', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        // Security check

        // We can now accept anything from the frontend form!
        const { lrn, first_name, middle_name, last_name, birthdate, address } = req.body;

        // Check if Learner already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [lrn]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: "A user with this LRN already exists." });
        }

        const tempPassword = "Welcome123!";
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        await pool.query('BEGIN');

        // --- 1. CREATE LEARNER ---
        // Insert login credentials
        const learnerUserResult = await pool.query(
            `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id`,
            [lrn, hashedPassword, 3]
        );
        const learnerUserId = learnerUserResult.rows[0].id;

        // Insert profile details
        await pool.query(
            `INSERT INTO learner_profiles (user_id, lrn, first_name, middle_name, last_name, birthdate, address) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [learnerUserId, lrn, first_name, middle_name, last_name, birthdate, address]
        );

        // --- 2. CREATE PARENT ---
        const parentUsername = `P-${lrn}`;
        
        // Insert login credentials
        const parentUserResult = await pool.query(
            `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id`,
            [parentUsername, hashedPassword, 4]
        );
        const parentUserId = parentUserResult.rows[0].id;

        // Insert profile details
        await pool.query(
            `INSERT INTO parent_profiles (user_id, linked_lrn) VALUES ($1, $2)`,
            [parentUserId, lrn]
        );

        await pool.query('COMMIT');

        res.json({ 
            success: true, 
            message: "Learner and Parent accounts created successfully!",
            temp_password: tempPassword
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: "Failed to create accounts." });
    }
});

// NEW: Create Faculty Account
app.post('/api/admin/users/faculty', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        // Security check: Admins only

        const { employee_no, first_name, middle_name, last_name } = req.body;

        // Check if Faculty already exists
        const existingUser = await pool.query('SELECT * FROM users WHERE username = $1', [employee_no]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: "A faculty member with this Employee No already exists." });
        }

        // Generate a temporary password
        const tempPassword = "Faculty123!";
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(tempPassword, salt);

        await pool.query('BEGIN');

        // Insert login credentials (Role ID 2 for Faculty)
        const userResult = await pool.query(
            `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id`,
            [employee_no, hashedPassword, 2]
        );
        const userId = userResult.rows[0].id;

        // Insert profile details
        await pool.query(
            `INSERT INTO faculty_profiles (user_id, employee_no, first_name, middle_name, last_name) 
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, employee_no, first_name, middle_name, last_name]
        );

        await pool.query('COMMIT');

        res.json({ 
            success: true, 
            message: "Faculty account created successfully!",
            temp_password: tempPassword
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err.message);
        res.status(500).json({ error: "Failed to create faculty account." });
    }
});

// GET all Subjects
app.get('/api/admin/subjects', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM subjects ORDER BY id ASC');
        res.json({ success: true, subjects: result.rows });
    } catch (err) {
        console.error("Error fetching subjects:", err);
        res.status(500).json({ error: "Failed to fetch subjects." });
    }
});

// POST (Add) a new Subject
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
        console.error("Error adding subject:", err);
        res.status(500).json({ error: "Failed to add subject." });
    }
});

// UPDATE a Subject
app.put('/api/admin/subjects/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;
    const { subject_name, ww_weight, pt_weight, ex_weight } = req.body;

    try {
        const result = await pool.query(
            `UPDATE subjects 
             SET subject_name = $1, ww_weight = $2, pt_weight = $3, ex_weight = $4 
             WHERE id = $5 RETURNING *`,
            [subject_name, ww_weight, pt_weight, ex_weight, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Subject not found." });
        }

        res.json({ success: true, subject: result.rows[0], message: "Subject updated successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update subject." });
    }
});

// DELETE a Subject
app.delete('/api/admin/subjects/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;

    try {
        // Note: If a subject is tied to existing faculty loads, PostgreSQL might block this 
        // if you have foreign key constraints set up to prevent accidental deletion.
        const result = await pool.query('DELETE FROM subjects WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Subject not found." });
        }

        res.json({ success: true, message: "Subject deleted successfully!" });
    } catch (err) {
        console.error(err);
        // Catch constraint violations (e.g., trying to delete a subject currently being taught)
        if (err.code === '23503') {
            return res.status(400).json({ error: "Cannot delete this subject because it is assigned to a class." });
        }
        res.status(500).json({ error: "Failed to delete subject." });
    }
});

// ==========================================
// ADMIN: SECTIONS CRUD
// ==========================================

// GET all Sections
app.get('/api/admin/sections', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sections ORDER BY grade_level ASC, section_name ASC');
        res.json({ success: true, sections: result.rows });
    } catch (err) {
        console.error("Error fetching sections:", err);
        res.status(500).json({ error: "Failed to fetch sections." });
    }
});

// POST (Add) a new Section
app.post('/api/admin/sections', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { section_name, grade_level } = req.body;

    try {
        const result = await pool.query(
            `INSERT INTO sections (section_name, grade_level) 
             VALUES ($1, $2) RETURNING *`,
            [section_name, grade_level]
        );

        res.json({ success: true, section: result.rows[0], message: "Section added successfully!" });
    } catch (err) {
        console.error("Error adding section:", err);
        if (err.code === '23505') {
            return res.status(400).json({ error: "This section name already exists." });
        }
        res.status(500).json({ error: "Failed to add section." });
    }
});

// UPDATE a Section
app.put('/api/admin/sections/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;
    const { section_name, grade_level } = req.body;

    try {
        const result = await pool.query(
            `UPDATE sections 
             SET section_name = $1, grade_level = $2 
             WHERE id = $3 RETURNING *`,
            [section_name, grade_level, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Section not found." });
        }

        res.json({ success: true, section: result.rows[0], message: "Section updated successfully!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to update section." });
    }
});

// DELETE a Section
app.delete('/api/admin/sections/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM sections WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Section not found." });
        }

        res.json({ success: true, message: "Section deleted successfully!" });
    } catch (err) {
        console.error(err);
        if (err.code === '23503') {
            return res.status(400).json({ error: "Cannot delete this section because students or faculty are currently assigned to it." });
        }
        res.status(500).json({ error: "Failed to delete section." });
    }
});

// GET: Fetch all sections AND their current advisers
app.get('/api/admin/sections/advisers', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        // This joins sections with advisers for the ACTIVE year only
        const result = await pool.query(`
            SELECT s.id, s.section_name, s.grade_level, 
                   f.first_name, f.last_name 
            FROM sections s
            LEFT JOIN section_advisories internal sa ON s.id = sa.section_id AND sa.school_year = $1
            LEFT JOIN faculty_profiles f ON sa.faculty_id = f.id
            ORDER BY s.grade_level ASC, s.section_name ASC
        `, [activeYear]);
        
        // We also need the faculty list for the dropdown
        const faculty = await pool.query('SELECT id, first_name, last_name, employee_no FROM faculty_profiles ORDER BY last_name ASC');

        res.json({ 
            success: true, 
            sections: result.rows, 
            faculty: faculty.rows,
            active_school_year: activeYear 
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch sections and advisers." });
    }
});

// POST: Assign or Update an Adviser
app.post('/api/admin/sections/advisers', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { section_id, faculty_id } = req.body;
        const settings = await getSystemSettings();
        const school_year = settings?.current_school_year;

        if (!school_year) {
            return res.status(400).json({ error: "Current school year is not set." });
        }

        // "ON CONFLICT" means if this section already has an adviser this year, update it!
        await pool.query(`
            INSERT INTO section_advisories (section_id, faculty_id, school_year) 
            VALUES ($1, $2, $3)
            ON CONFLICT (section_id, school_year) 
            DO UPDATE SET faculty_id = EXCLUDED.faculty_id
        `, [section_id, faculty_id, school_year]);

        res.json({ success: true, message: "Adviser assigned successfully!" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to assign adviser." });
    }
});

// ==========================================
// ADMIN: ACCOUNTS (USERS) CRUD
// ==========================================

// GET all Accounts (Updated to fetch ALL profile columns)
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

        const allAccounts = [...faculty.rows, ...learners.rows];
        res.json({ success: true, accounts: allAccounts });
    } catch (err) {
        console.error("Error fetching accounts:", err);
        res.status(500).json({ error: "Failed to fetch accounts." });
    }
});

// PUT: Update an existing account (Updated to save ALL profile columns)
app.put('/api/admin/accounts/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params; 
    const data = req.body;

    try {
        await pool.query('BEGIN'); 

        if (data.lrn !== undefined) {
            await pool.query('UPDATE users SET username = $1 WHERE id = $2', [data.lrn, id]);
            
            // MASSIVE UPDATE FOR ALL LEARNER COLUMNS
            await pool.query(
                `UPDATE learner_profiles 
                 SET lrn = $1, first_name = $2, middle_name = $3, last_name = $4, email = $5,
                     birthdate = $6, gender = $7, school_year = $8, grade_level = $9, is_star_eligible = $10,
                     mother_tongue = $11, ethnic_group = $12, religion = $13, house_street = $14,
                     barangay = $15, city = $16, province = $17, father_first = $18, father_middle = $19,
                     father_last = $20, mother_first = $21, mother_middle = $22, mother_last = $23,
                     guardian_name = $24, guardian_relationship = $25, contact_number = $26
                 WHERE user_id = $27`,
                [
                    data.lrn, data.firstName, data.middleName, data.lastName, data.email,
                    data.birthdate, data.gender, data.schoolYear, data.gradeLevel, data.isStarEligible,
                    data.motherTongue, data.ip, data.religion, data.houseStreet, data.barangay,
                    data.city, data.province, data.fatherFirst, data.fatherMiddle, data.fatherLast,
                    data.motherFirst, data.motherMiddle, data.motherLast, data.guardianName, 
                    data.guardianRelation, data.contactNumber, id
                ]
            );

            const newParentUsername = `P-${data.lrn}`;
            await pool.query(
                `UPDATE users SET username = $1 WHERE id = (SELECT user_id FROM parent_profiles WHERE linked_lrn = $2 LIMIT 1)`,
                [newParentUsername, data.lrn]
            );
            await pool.query('UPDATE parent_profiles SET linked_lrn = $1 WHERE linked_lrn = $2', [data.lrn, data.lrn]);
            
        } else if (data.employeeNo !== undefined) {
            await pool.query('UPDATE users SET username = $1 WHERE id = $2', [data.employeeNo, id]);
            await pool.query(
                `UPDATE faculty_profiles 
                 SET employee_no = $1, first_name = $2, middle_name = $3, last_name = $4, email = $5,
                     start_school_year = $6, contact_number = $7
                 WHERE user_id = $8`,
                [data.employeeNo, data.firstName, data.middleName, data.lastName, data.email, data.startSchoolYear, data.contactNumber, id]
            );
        }

        await pool.query('COMMIT'); 
        res.json({ success: true, message: "Account updated successfully!" });
    } catch (error) {
        await pool.query('ROLLBACK'); 
        console.error("Backend Error updating account:", error);
        if (error.code === '23505') {
            return res.status(400).json({ error: "That LRN or Employee Number is already in use by another account." });
        }
        res.status(500).json({ error: "Failed to update account in the database." });
    }
});

// POST: Create Learner (SF1 Compliant) AND auto-generate Parent
app.post('/api/admin/accounts/learner', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const data = req.body;

        // 1. Auto-Generate Credentials
        // Generates an 8-character random alphanumeric password
        const generatedPassword = Math.random().toString(36).slice(-8); 
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        
        const learnerUsername = data.lrn;
        const parentUsername = `P-${data.lrn}`;

        await pool.query('BEGIN');

        // 2. Create Learner Login (Role ID 3)
        const learnerUserResult = await pool.query(
            `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id`,
            [learnerUsername, hashedPassword, 3]
        );
        const learnerUserId = learnerUserResult.rows[0].id;

        // 3. Insert Massive SF1 Profile Details
        await pool.query(
            `INSERT INTO learner_profiles (
                user_id, lrn, birthdate, gender, first_name, middle_name, last_name, email,
                school_year, grade_level, is_star_eligible, mother_tongue, ethnic_group, religion,
                house_street, barangay, city, province, father_first, father_middle, father_last,
                mother_first, mother_middle, mother_last, guardian_name, guardian_relationship, contact_number
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
                $19, $20, $21, $22, $23, $24, $25, $26, $27
            )`,
            [
                learnerUserId, data.lrn, data.birthdate, data.gender, data.firstName, data.middleName, data.lastName, data.email,
                data.schoolYear, data.gradeLevel, data.isStarEligible, data.motherTongue, data.ip, data.religion,
                data.houseStreet, data.barangay, data.city, data.province, data.fatherFirst, data.fatherMiddle, data.fatherLast,
                data.motherFirst, data.motherMiddle, data.motherLast, data.guardianName, data.guardianRelation, data.contactNumber
            ]
        );

        // 4. Create Parent Login (Role ID 4)
        const parentUserResult = await pool.query(
            `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id`,
            [parentUsername, hashedPassword, 4]
        );
        const parentUserId = parentUserResult.rows[0].id;

        // 5. Link Parent Profile
        await pool.query(
            `INSERT INTO parent_profiles (user_id, linked_lrn) VALUES ($1, $2)`,
            [parentUserId, data.lrn]
        );

        await pool.query('COMMIT');

        // TODO: In a production environment, you would trigger Nodemailer here 
        // to send 'generatedPassword' to 'data.email'.

        // 6. Return the credentials for the Admin Popup
        res.json({ 
            success: true, 
            message: "Learner and Parent accounts created successfully!",
            credentials: {
                learnerUsername: learnerUsername,
                parentUsername: parentUsername,
                password: generatedPassword,
                emailSentTo: data.email
            }
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: "LRN already exists in the system." });
        }
        res.status(500).json({ error: "Failed to create accounts." });
    }
});

// POST: Create Faculty AND auto-generate credentials
app.post('/api/admin/accounts/faculty', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const data = req.body;
        
        // Auto-Generate Credentials
        const generatedPassword = Math.random().toString(36).slice(-8); 
        const hashedPassword = await bcrypt.hash(generatedPassword, 10);
        const facultyUsername = data.employeeNo;

        await pool.query('BEGIN');

        // Create Faculty Login (Role ID 2)
        const userResult = await pool.query(
            `INSERT INTO users (username, password_hash, role_id) VALUES ($1, $2, $3) RETURNING id`,
            [facultyUsername, hashedPassword, 2]
        );
        const userId = userResult.rows[0].id;

        // Insert Expanded Profile Details
        await pool.query(
            `INSERT INTO faculty_profiles (
                user_id, employee_no, first_name, middle_name, last_name, 
                email, start_school_year, contact_number
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
                userId, data.employeeNo, data.firstName, data.middleName, data.lastName, 
                data.email, data.startSchoolYear, data.contactNumber
            ]
        );

        await pool.query('COMMIT');

        // Return credentials for the Admin Popup
        res.json({ 
            success: true, 
            message: "Faculty account created successfully!",
            credentials: {
                learnerUsername: facultyUsername, // Using same key so popup reuses it
                parentUsername: null,             
                password: generatedPassword,
                emailSentTo: data.email
            }
        });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        if (err.code === '23505') {
            return res.status(400).json({ error: "Employee Number already exists." });
        }
        res.status(500).json({ error: "Failed to create faculty account." });
    }
});


// DELETE an Account (and clean up associated Parent accounts if applicable)
app.delete('/api/admin/accounts/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params; // This is the user_id

    try {
        // 1. First, figure out WHO we are deleting so we can clean up properly
        const userCheck = await pool.query(`
            SELECT u.role_id, l.lrn 
            FROM users u
            LEFT JOIN learner_profiles l ON u.id = l.user_id
            WHERE u.id = $1
        `, [id]);

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: "Account not found." });
        }

        const { role_id, lrn } = userCheck.rows[0];

        await pool.query('BEGIN');

        // 2. If it is a Learner (Role 3), hunt down and delete the Parent account first
        if (role_id === 3 && lrn) {
            const parentUsername = `P-${lrn}`;
            // Delete the parent profile
            await pool.query('DELETE FROM parent_profiles WHERE linked_lrn = $1', [lrn]);
            // Delete the parent user login
            await pool.query('DELETE FROM users WHERE username = $1 AND role_id = 4', [parentUsername]);
        }

        // 3. Now delete the main user's profiles
        await pool.query('DELETE FROM faculty_profiles WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM learner_profiles WHERE user_id = $1', [id]);
        
        // 4. Finally, delete the main user login
        await pool.query('DELETE FROM users WHERE id = $1', [id]);
        
        await pool.query('COMMIT');

        res.json({ success: true, message: "Account (and any linked profiles) deleted successfully!" });
    } catch (err) {
        await pool.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: "Failed to delete account. They may have dependent records (like grades)." });
    }
});

// PUT: Update an existing account
app.put('/api/admin/accounts/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    const { id } = req.params; // This is the user_id
    const data = req.body;

    try {
        await pool.query('BEGIN'); // Start a transaction

        // Check if updating a learner (payload contains 'lrn')
        if (data.lrn !== undefined) {
            // 1. Update the main login username
            await pool.query('UPDATE users SET username = $1 WHERE id = $2', [data.lrn, id]);
            
            // 2. Update the profile data
            await pool.query(
                `UPDATE learner_profiles 
                 SET lrn = $1, first_name = $2, last_name = $3, email = $4 
                 WHERE user_id = $5`,
                [data.lrn, data.firstName, data.lastName, data.email, id]
            );

            // 3. Update the linked Parent username if applicable
            const newParentUsername = `P-${data.lrn}`;
            await pool.query(
                `UPDATE users 
                 SET username = $1 
                 WHERE id = (SELECT user_id FROM parent_profiles WHERE linked_lrn = $2 LIMIT 1)`,
                [newParentUsername, data.lrn]
            );
            
            // 4. Update the Parent profile link
            await pool.query('UPDATE parent_profiles SET linked_lrn = $1 WHERE linked_lrn = $2', [data.lrn, data.lrn]);
        } 
        // Check if updating a faculty (payload contains 'employeeNo')
        else if (data.employeeNo !== undefined) {
            // 1. Update the main login username
            await pool.query('UPDATE users SET username = $1 WHERE id = $2', [data.employeeNo, id]);
            
            // 2. Update the profile data
            await pool.query(
                `UPDATE faculty_profiles 
                 SET employee_no = $1, first_name = $2, last_name = $3, email = $4 
                 WHERE user_id = $5`,
                [data.employeeNo, data.firstName, data.lastName, data.email, id]
            );
        }

        await pool.query('COMMIT'); // Save changes
        res.json({ success: true, message: "Account updated successfully!" });
    } catch (error) {
        await pool.query('ROLLBACK'); // Cancel changes on error
        console.error("Backend Error updating account:", error);
        
        // Handle duplicate LRN or Employee No errors
        if (error.code === '23505') {
            return res.status(400).json({ error: "That LRN or Employee Number is already in use by another account." });
        }
        res.status(500).json({ error: "Failed to update account in the database." });
    }
});

// GET: Fetch all data needed for Faculty Loads Dropdowns
app.get('/api/admin/faculty-loads/form-data', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        // Fetch all Faculty Members
        const faculty = await pool.query('SELECT id, first_name, last_name, employee_no FROM faculty_profiles ORDER BY last_name ASC');
        
        // Fetch all Subjects
        const subjects = await pool.query('SELECT id, subject_name FROM subjects ORDER BY subject_name ASC');
        
        // Fetch all Sections
        const sections = await pool.query('SELECT id, section_name, grade_level FROM sections ORDER BY grade_level ASC, section_name ASC');
        
        // Fetch the Active School Year from System Settings
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');

        res.json({ 
            success: true, 
            faculty: faculty.rows,
            subjects: subjects.rows,
            sections: sections.rows,
            active_school_year: settings.rows[0]?.current_school_year || "Not Set"
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch form data." });
    }
});

// POST: Save a new Faculty Load Assignment
app.post('/api/admin/faculty-loads', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        // Security check: Only admins can assign loads
        const { faculty_id, subject_id, section_id } = req.body;
        const settings = await getSystemSettings();
        const school_year = settings?.current_school_year;

        if (!school_year) {
            return res.status(400).json({ error: "Current school year is not set." });
        }

        const result = await pool.query(
            `INSERT INTO faculty_loads (faculty_id, subject_id, section_id, school_year) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [faculty_id, subject_id, section_id, school_year]
        );

        res.json({ success: true, message: "Faculty load assigned successfully!" });
    } catch (err) {
        console.error(err.message);
        // Error 23505 means this exact combination already exists in the database!
        if (err.code === '23505') {
            return res.status(400).json({ error: "This exact faculty load already exists for this school year." });
        }
        res.status(500).json({ error: "Failed to assign faculty load." });
    }
});

// GET: Fetch all active faculty loads for the Admin table
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
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch faculty loads." });
    }
});

// DELETE: Remove a faculty load
app.delete('/api/admin/faculty-loads/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('DELETE FROM faculty_loads WHERE id = $1 RETURNING *', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Load not found." });
        }
        res.json({ success: true, message: "Faculty load removed successfully!" });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to remove load. Dependent grades might already exist." });
    }
});

// GET: Fetch Grading Weights Setup
app.get('/api/admin/grading', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const result = await pool.query('SELECT id, subject_name, ww_weight, pt_weight, ex_weight FROM subjects ORDER BY subject_name ASC');
        res.json({ success: true, subjects: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch grading setup." });
    }
});

// GET: Fetch teaching loads for the logged-in Faculty
app.get('/api/faculty/my-classes', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id; 

        // FIX: Join faculty_profiles so we match the User Login ID to their Faculty Profile
        const result = await pool.query(`
            SELECT fl.id, s.subject_name, sec.section_name, sec.grade_level
            FROM faculty_loads fl
            JOIN subjects s ON fl.subject_id = s.id
            JOIN sections sec ON fl.section_id = sec.id
            JOIN faculty_profiles fp ON fl.faculty_id = fp.id
            WHERE fp.user_id = $1
            ORDER BY sec.grade_level ASC, sec.section_name ASC
        `, [userId]);

        res.json({ success: true, loads: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch teaching loads." });
    }
});
// POST: Faculty saves a student's monthly attendance
app.post('/api/faculty/attendance', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { learnerId, schoolYear, monthName, daysAbsent, daysTardy } = req.body;

    try {
        await pool.query(
            `INSERT INTO monthly_attendance (learner_id, school_year, month_name, days_absent, days_tardy) 
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (learner_id, school_year, month_name) 
             DO UPDATE SET days_absent = EXCLUDED.days_absent, days_tardy = EXCLUDED.days_tardy`,
            [learnerId, schoolYear, monthName, daysAbsent, daysTardy]
        );
        res.json({ success: true, message: "Attendance saved successfully." });
    } catch (err) {
        console.error("Attendance Update Error:", err);
        res.status(500).json({ error: "Failed to save attendance." });
    }
});
// POST: Faculty saves Core Values for a learner
app.post('/api/faculty/core-values', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { 
        learnerId, schoolYear, quarter, 
        md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2 
    } = req.body;

    try {
        await pool.query(
            `INSERT INTO core_values_grades 
             (learner_id, school_year, quarter, md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (learner_id, school_year, quarter) 
             DO UPDATE SET 
                md_1 = EXCLUDED.md_1, md_2 = EXCLUDED.md_2, 
                mt_1 = EXCLUDED.mt_1, mt_2 = EXCLUDED.mt_2, 
                mk_1 = EXCLUDED.mk_1, mb_1 = EXCLUDED.mb_1, mb_2 = EXCLUDED.mb_2`,
            [learnerId, schoolYear, quarter, md_1, md_2, mt_1, mt_2, mk_1, mb_1, mb_2]
        );
        res.json({ success: true, message: "Observed values saved successfully." });
    } catch (err) {
        console.error("Core Values Update Error:", err);
        res.status(500).json({ error: "Failed to save observed values." });
    }
});
// GET: Fetch students, overall grades, individual item scores, AND Subject Weights
app.get('/api/faculty/gradebook/:loadId', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { loadId } = req.params;
        const settings = await getSystemSettings();
        
        // ALLOW VIEWING ANY TRIMESTER: 
        // Use the requested trimester, or default to the active one if none is provided.
        const trimester = req.query.trimester ? parseInt(req.query.trimester) : settings.active_trisemester;

        // Verify ownership AND fetch subject weights at the same time
        const weights = await getFacultyOwnedLoad(loadId, req.user.id);
        
        if (!weights) {
            return res.status(403).json({ error: "Access denied. You do not teach this class." });
        }

        if (weights.school_year !== settings?.current_school_year) {
            return res.status(403).json({ error: "This class is not part of the current school year." });
        }

        // Fetch enrolled students and their final grades
        const result = await pool.query(`
            SELECT 
                e.id as enrollment_id,
                l.first_name, l.last_name, l.lrn,
                g.initial_grade,
                g.transmuted_grade
            FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            JOIN faculty_loads fl ON e.section_id = fl.section_id AND e.school_year = fl.school_year
            LEFT JOIN grades g ON e.id = g.enrollment_id AND g.faculty_load_id = fl.id AND g.trimester = $2
            WHERE fl.id = $1
            ORDER BY l.last_name ASC, l.first_name ASC
        `, [loadId, trimester]);

        // Fetch all individual cell scores for this class and trimester
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
            weights: {
                ww: weights.ww_weight,
                pt: weights.pt_weight,
                ex: weights.ex_weight
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch gradebook data." });
    }
});

// GET: Fetch Dynamic Grade Items (WW, PT, EX columns) for a specific class and trimester
app.get('/api/faculty/grade-items/:loadId', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { loadId } = req.params;
        const settings = await getSystemSettings();
        
        // ALLOW VIEWING ANY TRIMESTER: 
        // Use the requested trimester, or default to the active one if none is provided.
        const trimester = req.query.trimester ? parseInt(req.query.trimester) : settings.active_trisemester;

        const ownedLoad = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!ownedLoad) {
            return res.status(403).json({ error: "Access denied. You do not teach this class." });
        }
        
        const result = await pool.query(`
            SELECT id, component, item_name, max_score 
            FROM grade_items 
            WHERE faculty_load_id = $1 AND trimester = $2
            ORDER BY component DESC, id ASC
        `, [loadId, trimester]);

        res.json({ items: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch grade items." });
    }
});

app.post('/api/faculty/grade-items', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { loadId, trimester, component, name, max } = req.body;
    try {
        const settings = await getSystemSettings();
        const activeTrimester = ensureActiveTrimester(trimester, settings, res);

        if (!activeTrimester) return;

        const ownedLoad = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!ownedLoad || ownedLoad.school_year !== settings?.current_school_year) {
            return res.status(403).json({ error: "Access denied. You do not teach this class." });
        }

        const result = await pool.query(
            'INSERT INTO grade_items (faculty_load_id, trimester, component, item_name, max_score) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [loadId, activeTrimester, component, name, max]
        );
        res.json({ success: true, newItem: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: "Failed to add item." });
    }
});
// DELETE: Remove a grade item (and its associated scores)
app.delete('/api/faculty/grade-items/:id', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { id } = req.params;
        const itemCheck = await pool.query(`
            SELECT gi.id, gi.trimester, fl.id as load_id
            FROM grade_items gi
            JOIN faculty_loads fl ON gi.faculty_load_id = fl.id
            JOIN faculty_profiles fp ON fl.faculty_id = fp.id
            WHERE gi.id = $1 AND fp.user_id = $2
        `, [id, req.user.id]);

        if (itemCheck.rows.length === 0) {
            return res.status(403).json({ error: "Access denied. You do not own this grade item." });
        }

        const settings = await getSystemSettings();
        const activeTrimester = ensureActiveTrimester(itemCheck.rows[0].trimester, settings, res);
        if (!activeTrimester) return;

        // 1. Delete all student scores tied to this item first (Foreign Key constraint)
        await pool.query('DELETE FROM student_scores WHERE grade_item_id = $1', [id]);
        
        // 2. Delete the actual grade item
        await pool.query('DELETE FROM grade_items WHERE id = $1', [id]);
        
        res.json({ success: true, message: "Grade item deleted successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to delete grade item." });
    }
});

// Utility: Convert Initial Grade to Transmuted Grade (DepEd Standard)
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

app.post('/api/faculty/save-grades', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    const { loadId, trimester, scores } = req.body;

    try {
        const settings = await getSystemSettings();
        const activeTrimester = ensureActiveTrimester(trimester, settings, res);

        if (!activeTrimester) return;

        const ownedLoad = await getFacultyOwnedLoad(loadId, req.user.id);
        if (!ownedLoad || ownedLoad.school_year !== settings?.current_school_year) {
            return res.status(403).json({ error: "Access denied. You do not teach this class." });
        }

        const safeScores = Array.isArray(scores) ? scores : [];
        const gradeItemIds = [...new Set(safeScores.map(s => Number(s.grade_item_id)).filter(Boolean))];
        const enrollmentIds = [...new Set(safeScores.map(s => Number(s.enrollment_id)).filter(Boolean))];

        if (gradeItemIds.length > 0) {
            const itemCheck = await pool.query(
                'SELECT COUNT(*)::int as count FROM grade_items WHERE id = ANY($1::int[]) AND faculty_load_id = $2 AND trimester = $3',
                [gradeItemIds, loadId, activeTrimester]
            );

            if (itemCheck.rows[0].count !== gradeItemIds.length) {
                return res.status(403).json({ error: "Some grade items do not belong to this class." });
            }
        }

        if (enrollmentIds.length > 0) {
            const enrollmentCheck = await pool.query(`
                SELECT COUNT(*)::int as count
                FROM enrollments e
                JOIN faculty_loads fl ON e.section_id = fl.section_id AND e.school_year = fl.school_year
                WHERE e.id = ANY($1::int[]) AND fl.id = $2
            `, [enrollmentIds, loadId]);

            if (enrollmentCheck.rows[0].count !== enrollmentIds.length) {
                return res.status(403).json({ error: "Some learners are not enrolled in this class." });
            }
        }

        // 1. Save all individual cell scores using an Upsert (Insert or Update)
        for (const s of safeScores) {
            await pool.query(`
                INSERT INTO student_scores (enrollment_id, grade_item_id, score) 
                VALUES ($1, $2, $3) 
                ON CONFLICT (grade_item_id, enrollment_id) 
                DO UPDATE SET score = EXCLUDED.score
            `, [s.enrollment_id, s.grade_item_id, s.score]);
        }

        // 2. Fetch subject weights for this class
        const subjectInfo = await pool.query(`
            SELECT s.ww_weight, s.pt_weight, s.ex_weight 
            FROM subjects s
            JOIN faculty_loads fl ON s.id = fl.subject_id
            WHERE fl.id = $1
        `, [loadId]);
        
        if (subjectInfo.rows.length === 0) throw new Error("Subject weights not found.");
        const { ww_weight, pt_weight, ex_weight } = subjectInfo.rows[0];

        // 3. Perform the Math Engine calculation directly in PostgreSQL
        // This calculates the (Sum of Scores / Sum of Max Scores) * Weight * 100 for each component
        const computeQuery = await pool.query(`
            WITH StudentComponentTotals AS (
                SELECT 
                    ss.enrollment_id,
                    gi.component,
                    SUM(ss.score) as total_score,
                    SUM(gi.max_score) as total_max
                FROM student_scores ss
                JOIN grade_items gi ON ss.grade_item_id = gi.id
                WHERE gi.faculty_load_id = $1 AND gi.trimester = $2
                GROUP BY ss.enrollment_id, gi.component
            )
            SELECT 
                enrollment_id,
                MAX(CASE WHEN component = 'WW' THEN (total_score / NULLIF(total_max, 0)) * $3 * 100 ELSE 0 END) as ww_ws,
                MAX(CASE WHEN component = 'PT' THEN (total_score / NULLIF(total_max, 0)) * $4 * 100 ELSE 0 END) as pt_ws,
                MAX(CASE WHEN component = 'EX' THEN (total_score / NULLIF(total_max, 0)) * $5 * 100 ELSE 0 END) as ex_ws
            FROM StudentComponentTotals
            GROUP BY enrollment_id
        `, [loadId, activeTrimester, ww_weight, pt_weight, ex_weight]);

        // 4. Calculate Final Initial Grade, Transmute, and Save to the 'grades' table
        for (const student of computeQuery.rows) {
            // Calculate Initial Grade (WS out of 100)
            const initialGrade = Number(student.ww_ws) + Number(student.pt_ws) + Number(student.ex_ws);
            
            // Convert using your Transmutation Table
            const transmuted = getTransmutedGrade(initialGrade);

            // Save final overall grades
            await pool.query(`
                INSERT INTO grades (enrollment_id, faculty_load_id, trimester, initial_grade, transmuted_grade)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (enrollment_id, faculty_load_id, trimester) 
                DO UPDATE SET initial_grade = EXCLUDED.initial_grade, transmuted_grade = EXCLUDED.transmuted_grade
            `, [student.enrollment_id, loadId, activeTrimester, initialGrade, transmuted]);
        }

        res.json({ success: true, message: "Grades successfully saved and computed!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save and compute grades." });
    }
});

// ==========================================
// ADMIN: STUDENT ENROLLMENT & SECTIONING
// ==========================================

// GET: Fetch unassigned learners for a specific grade level
app.get('/api/admin/enrollments/unassigned', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { grade_level } = req.query;
        // Fetch the dynamic active school year from settings
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        // Find learners of this grade who DO NOT have a section in the active year
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
        console.error(err);
        res.status(500).json({ error: "Failed to fetch unassigned learners." });
    }
});

// GET: Fetch learners currently enrolled in a specific section
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
        console.error(err);
        res.status(500).json({ error: "Failed to fetch enrolled learners." });
    }
});

// POST: Enroll a learner into a section
app.post('/api/admin/enrollments', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { learner_id, section_id } = req.body;
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        await pool.query(`
            INSERT INTO enrollments (learner_id, section_id, school_year) 
            VALUES ($1, $2, $3)
        `, [learner_id, section_id, activeYear]);

        res.json({ success: true, message: "Learner officially enrolled!" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to enroll learner." });
    }
});

// DELETE: Remove a learner from a section
app.delete('/api/admin/enrollments/:id', verifyToken, requireRole(ROLES.ADMIN), async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM enrollments WHERE id = $1', [id]);
        res.json({ success: true, message: "Learner removed from section." });
    } catch (err) {
        console.error(err);
        // Error 23503 means they already have grades tied to this enrollment
        if (err.code === '23503') {
            return res.status(400).json({ error: "Cannot remove: This student already has grades recorded in this section." });
        }
        res.status(500).json({ error: "Failed to remove learner." });
    }
});

// ==========================================
// FACULTY: HOMEROOM ADVISORY & REPORT CARDS
// ==========================================

// GET: Fetch advisory section and student grades for Report Cards
app.get('/api/faculty/advisory-class', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Get Active School Year
        const settings = await pool.query('SELECT current_school_year FROM system_settings LIMIT 1');
        const activeYear = settings.rows[0]?.current_school_year;

        // 2. Find if this faculty member is an adviser for the active school year
        const adviserCheck = await pool.query(`
            SELECT sa.section_id, s.section_name, s.grade_level
            FROM section_advisories sa
            JOIN sections s ON sa.section_id = s.id
            JOIN faculty_profiles fp ON sa.faculty_id = fp.id
            WHERE fp.user_id = $1 AND sa.school_year = $2
        `, [userId, activeYear]);

        if (adviserCheck.rows.length === 0) {
            return res.json({ success: true, isAdviser: false, message: "You are not assigned as a homeroom adviser for this school year." });
        }

        const { section_id, section_name, grade_level } = adviserCheck.rows[0];

        // 3. Fetch all students enrolled in this advisory section
        const students = await pool.query(`
            SELECT e.id as enrollment_id, e.grades_visible, l.lrn, l.first_name, l.middle_name, l.last_name, l.gender
            FROM enrollments e
            JOIN learner_profiles l ON e.learner_id = l.id
            WHERE e.section_id = $1 AND e.school_year = $2
            ORDER BY l.gender DESC, l.last_name ASC, l.first_name ASC
        `, [section_id, activeYear]);

        // 4. Fetch all grades recorded for this section's enrollments across all subjects and trimesters
        const grades = await pool.query(`
            SELECT 
                g.enrollment_id,
                g.trimester,
                g.transmuted_grade,
                sub.subject_name
            FROM grades g
            JOIN faculty_loads fl ON g.faculty_load_id = fl.id
            JOIN subjects sub ON fl.subject_id = sub.id
            WHERE fl.section_id = $1 AND fl.school_year = $2
        `, [section_id, activeYear]);

        res.json({
            success: true,
            isAdviser: true,
            section: { id: section_id, name: section_name, grade_level },
            school_year: activeYear,
            students: students.rows,
            grades: grades.rows
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch advisory class data." });
    }
});

// PUT: Update Grade Visibility for a Learner
app.put('/api/faculty/advisory-class/visibility/:enrollmentId', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const { isVisible } = req.body;

        await pool.query(
            'UPDATE enrollments SET grades_visible = $1 WHERE id = $2',
            [isVisible, enrollmentId]
        );

        res.json({ success: true, message: "Visibility updated." });
    } catch (err) {
        console.error("Error updating visibility:", err);
        res.status(500).json({ error: "Failed to update visibility." });
    }
});

// GET: Generate SF1 (School Form 1)
app.get('/api/faculty/advisory-class/sf1', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await getSystemSettings();
        const activeYear = settings?.current_school_year;

        // 1. Fetch section and student data
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

        // 2. Load the specific SF1template.xlsx file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(__dirname, 'templates', 'SF1template.xlsx'));
        const worksheet = workbook.getWorksheet(1);

        // 3. Populate Header Data (Based on your SF1template.xlsx structure)
        worksheet.getCell('AB4').value = sectionCheck.rows[0].grade_level; // Grade Level
        worksheet.getCell('AN4').value = sectionCheck.rows[0].section_name; // Section Name
        worksheet.getCell('T4').value = activeYear; // School Year

        // 1. Separate students by gender and sort alphabetically (Last Name, then First Name)
        const males = students.rows
            .filter(s => s.gender === 'Male')
            .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
            
        const females = students.rows
            .filter(s => s.gender === 'Female')
            .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

        // 2. Helper function containing your exact mappings
        const populateRow = (student, currentRow) => {
            // Existing Mappings
            worksheet.getCell(`A${currentRow}`).value = student.lrn;
            worksheet.getCell(`C${currentRow}`).value = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`;
            worksheet.getCell(`G${currentRow}`).value = student.gender === 'Male' ? 'M' : 'F';
            
            // --- NEW MAPPINGS FOR DEMOGRAPHICS ---
            // Formats SQL date nicely
            worksheet.getCell(`H${currentRow}`).value = student.birthdate ? new Date(student.birthdate).toLocaleDateString() : ''; 
            
            worksheet.getCell(`M${currentRow}`).value = student.mother_tongue;
            worksheet.getCell(`N${currentRow}`).value = student.ethnic_group;
            worksheet.getCell(`O${currentRow}`).value = student.religion;
            
            // Address mapping
            worksheet.getCell(`Q${currentRow}`).value = student.house_street;
            worksheet.getCell(`T${currentRow}`).value = student.barangay;
            worksheet.getCell(`V${currentRow}`).value = student.city;
            worksheet.getCell(`AA${currentRow}`).value = student.province;
            
            // Parents mapping 
            worksheet.getCell(`AE${currentRow}`).value = student.father_last ? `${student.father_last}, ${student.father_first}, ${student.father_middle || ''}` : '';
            worksheet.getCell(`AJ${currentRow}`).value = student.mother_last ? `${student.mother_last}, ${student.mother_first}, ${student.mother_middle || ''}` : '';
            
            // Guardian Info
            worksheet.getCell(`AN${currentRow}`).value = student.guardian_name;
            worksheet.getCell(`AO${currentRow}`).value = student.guardian_relationship;
            worksheet.getCell(`AQ${currentRow}`).value = student.contact_number;
        };

        // 3. Populate Male Rows (Starts at Row 7, stops before Row 32)
        let maleRow = 7;
        males.forEach(student => {
            if (maleRow < 32) { // Safety check to prevent overwriting the total row
                populateRow(student, maleRow);
                maleRow++;
            }
        });
        
        // Write Total Males to A32
        worksheet.getCell('A32').value = males.length; // Or you can change to: `TOTAL MALE: ${males.length}`

        // 4. Populate Female Rows (Starts at Row 33, stops before Row 55)
        let femaleRow = 33;
        females.forEach(student => {
            if (femaleRow < 55) { // Safety check to prevent overwriting the total row
                populateRow(student, femaleRow);
                femaleRow++;
            }
        });
        
        // Write Total Females to A55
        worksheet.getCell('A55').value = females.length; // Or you can change to: `TOTAL FEMALE: ${females.length}`

        // 5. Write Combined Total to A56
        worksheet.getCell('A56').value = males.length + females.length; // Or you can change to: `COMBINED TOTAL: ${males.length + females.length}`

        // 5. Send the file to the frontend
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + `SF1_${sectionCheck.rows[0].section_name}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();

    } catch (err) {
        console.error("SF1 Generation Error:", err);
        res.status(500).json({ error: "Failed to generate SF1." });
    }
});

// GET: Generate SF2 (School Form 2)
app.get('/api/faculty/advisory-class/sf2', verifyToken, requireRole(ROLES.FACULTY), async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await getSystemSettings();
        const activeYear = settings?.current_school_year;

        // Fetch section and student data for SF2
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

        // Load the specific SF2template.xlsx file
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(path.join(__dirname, 'templates', 'SF2template.xlsx'));
        const worksheet = workbook.getWorksheet(1);

        // 1. Populate SF2 Header Data
        worksheet.getCell('C8').value = 'Prudencia D. Fule Memorial National High School';
        worksheet.getCell('Y8').value = sectionCheck.rows[0].grade_level;
        worksheet.getCell('AH8').value = sectionCheck.rows[0].section_name;
        worksheet.getCell('L6').value = activeYear;

        // 2. Separate students by gender and sort alphabetically
        const males = students.rows
            .filter(s => s.gender === 'Male')
            .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
            
        const females = students.rows
            .filter(s => s.gender === 'Female')
            .sort((a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));

        // 3. Populate Male Rows (Starts at Row 14)
        let maleRow = 14;
        let maleIndex = 1;
        males.forEach(student => {
            worksheet.getCell(`A${maleRow}`).value = maleIndex; // Numbering 1, 2, 3...
            worksheet.getCell(`B${maleRow}`).value = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`;
            maleRow++;
            maleIndex++;
        });

        // 4. Populate Female Rows (Starts at Row 36)
        let femaleRow = 36;
        let femaleIndex = 1;
        females.forEach(student => {
            worksheet.getCell(`A${femaleRow}`).value = femaleIndex; // Numbering 1, 2, 3...
            worksheet.getCell(`B${femaleRow}`).value = `${student.last_name}, ${student.first_name} ${student.middle_name || ''}`;
            femaleRow++;
            femaleIndex++;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=' + `SF2_${sectionCheck.rows[0].section_name}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("SF2 Generation Error:", err);
        res.status(500).json({ error: "Failed to generate SF2." });
    }
});

// ==========================================
// LEARNER & PARENT PORTALS
// ==========================================

// Add 'requestedTrimester' as the second parameter
async function getGradesForLearnerUser(userId, requestedTrimester = null) {
    const settings = await getSystemSettings();
    const activeYear = settings?.current_school_year;
    
    // Use the requested trimester, OR fallback to the active system setting
    const targetTrimester = requestedTrimester || Number(settings?.active_trisemester);

    const learnerResult = await pool.query(`
        SELECT id, lrn, first_name, middle_name, last_name, grade_level
        FROM learner_profiles
        WHERE user_id = $1
    `, [userId]);

    if (learnerResult.rows.length === 0) {
        return { settings, learner: null, enrollment: null, grades: [] };
    }

    const learner = learnerResult.rows[0];
    
    // Added ORDER BY to prevent multiple-row crashes
    const enrollmentResult = await pool.query(`
        SELECT e.id as enrollment_id, s.section_name, s.grade_level, e.grades_visible 
        FROM enrollments e
        JOIN sections s ON e.section_id = s.id
        WHERE e.learner_id = $1 AND e.school_year = $2
        ORDER BY e.id DESC LIMIT 1
    `, [learner.id, activeYear]);

    let enrollment = null;
    let grades = [];

    if (enrollmentResult.rows.length > 0) {
        enrollment = enrollmentResult.rows[0];

        // Now it is safe to check visibility
        if (enrollment.grades_visible) {
            const gradesResult = await pool.query(`
                SELECT 
                    sub.subject_name, 
                    g.initial_grade, 
                    g.transmuted_grade, 
                    f.first_name as faculty_first_name, 
                    f.last_name as faculty_last_name
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

// GET: Fetch Learner Grades
app.get('/api/learner/grades', verifyToken, requireRole(ROLES.LEARNER), async (req, res) => {
    try {
        // Grab the trimester from the URL if it exists
        const requestedTri = req.query.trimester ? parseInt(req.query.trimester) : null;
        
        // Pass it to your helper function
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
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch learner grades." });
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
            return res.json({
                success: true,
                school_year: settings?.current_school_year,
                active_trisemester: settings?.active_trisemester,
                children: []
            });
        }

        const children = [];

        for (const parentProfile of parentResult.rows) {
            const learnerUser = await pool.query(
                'SELECT user_id FROM learner_profiles WHERE lrn = $1',
                [parentProfile.linked_lrn]
            );

            if (learnerUser.rows.length > 0) {
                // Pass the requested trimester down to the child fetcher as well
                const childGrades = await getGradesForLearnerUser(learnerUser.rows[0].user_id, requestedTri);
                children.push({
                    learner: childGrades.learner,
                    enrollment: childGrades.enrollment,
                    grades: childGrades.grades
                });
            }
        }

        res.json({
            success: true,
            school_year: settings?.current_school_year,
            active_trisemester: settings?.active_trisemester,
            children
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch child grades." });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});