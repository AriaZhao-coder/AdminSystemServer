const jwt = require('jsonwebtoken');
const SECRET_KEY = '1234';
const generateToken = (payload) => {
    return jwt.sign(payload, SECRET_KEY, { expiresIn: '24h' });
};

const verifyToken = (token) => {
    try {
        return jwt.verify(token, SECRET_KEY);
    } catch (error) {
        return null;
    }
};

module.exports = {
    generateToken,
    verifyToken
};
