const db = require('../config/database');

const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const saveCode = async (mobile, code, type) => {
    const expireTime = new Date(Date.now() + 60 * 60 * 1000); // 60分钟后过期

    await db.execute(
        'INSERT INTO verification_codes (mobile, code, type, expire_time) VALUES (?, ?, ?, ?)',
        [mobile, code, type, expireTime]
    );

    console.log(`验证码已发送到手机号 ${mobile}: ${code}`);
    return expireTime;
};

const verifyCode = async (mobile, code, type) => {
    const [codes] = await db.execute(
        'SELECT * FROM verification_codes WHERE mobile = ? AND type = ? AND code = ? AND expire_time > NOW() ORDER BY id DESC LIMIT 1',
        [mobile, type, code]
    );

    return codes.length > 0;
};

module.exports = {
    generateCode,
    saveCode,
    verifyCode
};
