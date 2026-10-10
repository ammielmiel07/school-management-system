function httpError(status, message) {
    return Object.assign(new Error(message), { status, expose: true });
}

function sendError(res, err, fallback = 'Something went wrong. Please try again.') {
    const databaseErrors = {
        '23505': [409, 'This record already exists. Check the identifier or name and try again.'],
        '23503': [409, 'This record is linked to other records, or the selected record no longer exists.'],
        '23502': [400, 'Please complete all required fields.'],
        '23514': [400, 'One or more values are outside the allowed range.'],
        '22P02': [400, 'One or more fields contain an invalid value.'],
        '22007': [400, 'Please enter a valid date.'],
        '22008': [400, 'Please enter a valid date.'],
        '22001': [400, 'One or more fields are too long.'],
        '53300': [503, 'The system is busy. Please try again shortly.'],
        'ECONNREFUSED': [503, 'The database is unavailable. Please try again shortly.'],
        'ETIMEDOUT': [503, 'The database did not respond. Please try again shortly.'],
    };
    const [status, message] = databaseErrors[err.code] ||
        (err.status && (err.status < 500 || err.expose) ? [err.status, err.message] : [500, fallback]);
    if (status >= 500) console.error(fallback, err.message);
    return res.status(status).json({ success: false, error: message });
}

module.exports = { httpError, sendError };
