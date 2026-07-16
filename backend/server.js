const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt'); // Added bcrypt for security
const jwt = require('jsonwebtoken');
const pool = require('./db');
require('dotenv').config();

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});