const { Pool, types } = require('pg');
require('dotenv').config();

// DATE values represent school calendar days, not timezone-dependent instants.
types.setTypeParser(1082, value => value);

const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    statement_timeout: 15000
});

pool.on('error', error => console.error('Idle database connection error:', error.message));

module.exports = pool;
