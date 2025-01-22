const { verifyToken } = require('../utils/jwt');

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            code: 401,
            message: '未授权',
            data: null
        });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (!decoded) {
        return res.status(401).json({
            code: 401,
            message: 'token无效或已过期',
            data: null
        });
    }

    req.user = decoded;
    next();
};

module.exports = authMiddleware;
