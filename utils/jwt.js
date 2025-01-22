const jwt = require('jsonwebtoken');
const SECRET_KEY = '1234'; // 在生产环境中应该使用环境变量

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
