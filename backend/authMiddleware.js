const jwt = require('jsonwebtoken');
const { createHash } = require('crypto');
const pool = require('./db');
const { sendError } = require('./errors');

const passwordVersion = hash => createHash('sha256').update(hash).digest('hex');

async function verifyToken(req, res, next) {
    const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ error: 'Please log in to continue.' });
    let decoded;
    try {
        decoded = jwt.verify(match[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
        return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
    }
    try {
        const result = await pool.query('SELECT id, role_id, password_hash, requires_password_change FROM users WHERE id = $1', [decoded.id]);
        const user = result.rows[0];
        if (!user || user.role_id !== decoded.role_id || decoded.password_version !== passwordVersion(user.password_hash)) {
            return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
        }
        const isSetup = req.path === '/api/auth/setup-password';
        if (decoded.pending_reset) {
            if (!isSetup || !user.requires_password_change) return res.status(403).json({ error: 'Please complete password setup before continuing.' });
        } else if (isSetup || user.requires_password_change) {
            return res.status(403).json({ error: 'Please log in again to set up your password.' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        sendError(res, error, 'Unable to verify your session. Please try again.');
    }
}

module.exports = verifyToken;
module.exports.passwordVersion = passwordVersion;
