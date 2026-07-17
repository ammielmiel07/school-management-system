const bcrypt = require('bcrypt');
const pool = require('./db'); // <-- Verify this matches your DB connection file

async function restoreAdmin() {
    try {
        const plainTextPassword = 'admin123'; 
        const hashedPassword = await bcrypt.hash(plainTextPassword, 10);

        const query = `
            INSERT INTO users (
                username, 
                password_hash, 
                role_id, 
                first_name, 
                last_name, 
                requires_password_change
            ) 
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, username, role_id;
        `;
        
        // Values: username, hashed password, role_id (assuming 1 = superadmin), first name, last name, requires_password_change
        const values = ['superadmin', hashedPassword, 1, 'Super', 'Admin', false]; 

        const res = await pool.query(query, values);
        console.log("✅ Superadmin restored successfully:", res.rows[0]);
        
    } catch (err) {
        console.error("❌ Error creating admin:", err);
    } finally {
        pool.end(); 
    }
}

restoreAdmin();