const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken} = require('../middleware/auth');
const authMiddleware = require('../middleware/auth');

//注册接口
router.post('/register', async (req,res) => {
    try {
        const { user_name, password, mobile, code, company_id = 'default_company' } = req.body;

        //验证参数
        if(!user_name || !password || !mobile || !code) {
            return res.json({
                code: 400,
                message: '请求参数错误',
                data: null
            })
        }

        //验证密码格式
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,20}$/;
        if (!passwordRegex.test(user_name)) {
            return res.json({
                code: 400,
                message: '密码格式不正确',
                data: null
            })
        }

        // 验证手机号
        const mobileRegex = /^1[3-9]\d{9}$/;
        if (!mobileRegex.test(mobile)) {
            return res.json({
                code: 400,
                message: '手机号格式不正确',
                data: null
            });
        }

        //检查用户名是否已存在
        const [users] = await db.execute('SELECT id FROM users WHERE user_name = ?', [user_name]);
        if (users.length > 0) {
            return res.json({
                code: 400,
                message:'用户名已存在',
                data:null
            })
        }
        // 密码加密
        const hashedPassword = await bcrypt.hash(password, 10);

        //插入用户数据
        const [result] = await db.execute(
            'INSERT INTO users (user_name, password, mobile, role, company_id) VALUES (?, ?, ?, ?, ?)',
            [user_name, hashedPassword, mobile, 'User', company_id]
        );
        // 生成token
        const token = generateToken({
            user_id: result.insertId,
            user_name,
            role:"User"
        });

        res.json({
            code: 200,
            message:'注册成功',
            data: {
                user_id: result.insertId,
                user_name,
                role:'User',
                token,
                expire_time: Math.floor(Date.now() / 1000) + 24 * 60 * 60
            }
        })
    } catch (error){
        console.error('注册错误', error);
        res.json({
            code: 500,
            message:"服务器内部错误",
            data: null
        })
    }
});

// router.post('/login', async (req,res) => {
//     try {
//         const { type, user_name, password, mobile, code } = req.body;
//         if (type === 0) {
//             if (!user_name || !password) {
//                 return res.json({
//                     code: 400,
//                     message:"请求参数错误",
//                     data: null
//                 });
//             }
//
//             const []
//         }
//     }
// })
module.exports = router;
