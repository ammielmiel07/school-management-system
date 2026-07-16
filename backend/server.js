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

        // 3. Create the JWT (The digital VIP pass)
        // We include the user's ID and Role ID inside the token so we know their access level
        const token = jwt.sign(
            { id: user.id, role_id: user.role_id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' } // Token expires in 8 hours (typical school day)
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
app.put('/api/settings', verifyToken, async (req, res) => {
    try {
        if (req.user.role_id !== 1) {
            return res.status(403).json({ error: "Access denied." });
        }
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



// NEW: A Protected Route (Only logged-in users can see this)
app.get('/api/admin/dashboard', verifyToken, (req, res) => {
    // Because verifyToken ran first, we now know EXACTLY who is making the request
    res.json({ 
        success: true, 
        message: "Welcome to the secret Admin Dashboard!", 
        user_data: req.user 
    });
});

// Create Learner AND auto-generate Parent (Relational Architecture)
app.post('/api/admin/users/learner', verifyToken, async (req, res) => {
    try {
        // Security check
        if (req.user.role_id !== 1) {
            return res.status(403).json({ error: "Access denied. Admins only." });
        }

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
app.post('/api/admin/users/faculty', verifyToken, async (req, res) => {
    try {
        // Security check: Admins only
        if (req.user.role_id !== 1) {
            return res.status(403).json({ error: "Access denied. Admins only." });
        }

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

// GET: Fetch all sections
app.get('/api/admin/sections', verifyToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM sections ORDER BY grade_level ASC, section_name ASC');
        res.json({ success: true, sections: result.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Failed to fetch sections." });
    }
});

// POST: Add a new section
app.post('/api/admin/sections', verifyToken, async (req, res) => {
    try {
        // Security check
        if (req.user.role_id !== 1) {
            return res.status(403).json({ error: "Access denied. Admins only." });
        }

        const { section_name, grade_level } = req.body;

        const result = await pool.query(
            'INSERT INTO sections (section_name, grade_level) VALUES ($1, $2) RETURNING *',
            [section_name, grade_level]
        );

        res.json({ success: true, message: "Section added successfully!", section: result.rows[0] });
    } catch (err) {
        console.error(err.message);
        // A unique constraint violation (error code 23505) means the section already exists
        if (err.code === '23505') {
            return res.status(400).json({ error: "This section name already exists." });
        }
        res.status(500).json({ error: "Failed to add section." });
    }
});

// GET: Fetch all data needed for Faculty Loads Dropdowns
app.get('/api/admin/faculty-loads/form-data', verifyToken, async (req, res) => {
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
app.post('/api/admin/faculty-loads', verifyToken, async (req, res) => {
    try {
        // Security check: Only admins can assign loads
        if (req.user.role_id !== 1) {
            return res.status(403).json({ error: "Access denied. Admins only." });
        }

        const { faculty_id, subject_id, section_id, school_year } = req.body;

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});