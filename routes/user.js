const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { generateToken} = require('../utils/jwt');
const authMiddleware = require('../middleware/auth');
const { generateCode, saveCode, verifyCode } = require('../utils/verification');

//注册接口
router.post('/register', async (req,res) => {
    console.log(req.body);
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
        if (!passwordRegex.test(password)) {
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

        //验证码验证
        const isValid = await verifyCode(mobile, code, 1);
        if (!isValid) {
            return res.json({
                code: 400,
                message: '验证码无效或已过期',
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
        // 密码加密company_id
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

        return res.json({
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
        return res.json({
            code: 500,
            message:"服务器内部错误",
            data: null
        })
    }
});

router.post('/login', async (req,res) => {
    try {
        const { type, user_name, password, mobile, code } = req.body;
        if (type === 0) {
            if (!user_name || !password) {
                return res.json({
                    code: 400,
                    message:"请求参数错误",
                    data: null
                });
            }

            const [users] = await db.execute(
                'SELECT * FROM users WHERE user_name = ?',
                [user_name]
            );
            if (users.length === 0) {
                return res.json({
                    code: 400,
                    message: '用户名或密码错误',
                    data: null
                });
            }
            const user = users[0];
            const isValidPassword = await bcrypt.compare(password, user.password);
            if (!isValidPassword) {
                return res.json({
                    code: 400,
                    message:'用户名或密码错误',
                    data: null
                });
            }

            const token = generateToken({
                user_id: user.id,
                user_name: user.user_name,
                role: user.role,
            })

            return res.json({
                code: 200,
                message: '登录成功',
                data: {
                    user_id: user.id,
                    user_name: user.user_name,
                    role: user.role,
                    token,
                    expire_time: Math.floor(Date.now() / 1000) + 24 * 60 * 60
                }
            });
        } else if (type === 1) {
            if (!mobile || !code) {
                return res.json({
                    code: 400,
                    message: '请求参数错误',
                    data: null
                });
            }

            // 手机验证码登录时
            const isValid = await verifyCode(mobile, code, 2);
            if (!isValid) {
                return res.json({
                    code: 400,
                    message: '验证码无效或已过期',
                    data: null
                });
            }

            const [users] = await db.execute(
                'SELECT * FROM users WHERE mobile = ?',
                [mobile]
            );
            if (users.length === 0) {
                return res.json({
                    code: 400,
                    message: '用户不存在',
                    data: null
                });
            }
            const user = users[0];
            const token = generateToken({
                user_id: user.id,
                user_name: user.user_name,
                role: user.role
            });
            return res.json({
                code: 200,
                message: '登录成功',
                data: {
                    user_id: user.id,
                    user_name: user.user_name,
                    role: user.role,
                    token,
                    expire_time: Math.floor(Date.now() / 1000) + 24 * 60 * 60
                }
            });
        } else {
            return res.json({
                code: 400,
                message: '不支持的登录类型',
                data: null
            });
        }
    } catch (error) {
        console.error('登录错误:', error);
        return res.json({
            code: 500,
            message: '服务器内部错误',
            data: null
        });
    }
});

// 忘记密码接口
router.post('/forget_password', async (req, res) => {
    try {
        const { mobile, code, new_password } = req.body;

        if (!mobile || !code || !new_password) {
            return res.json({
                code: 400,
                message: '请求参数错误',
                data: null
            });
        }

        // 验证密码格式
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,20}$/;
        if (!passwordRegex.test(new_password)) {
            return res.json({
                code: 400,
                message: '密码格式不正确',
                data: null
            });
        }

        // 验证验证码
        const isValid = await verifyCode(mobile, code, 3);
        if (!isValid) {
            return res.json({
                code: 400,
                message: '验证码无效或已过期',
                data: null
            });
        }

        const hashedPassword = await bcrypt.hash(new_password, 10);

        const [result] = await db.execute(
            'UPDATE users SET password = ? WHERE mobile = ?',
            [hashedPassword, mobile]
        );

        if (result.affectedRows === 0) {
            return res.json({
                code: 400,
                message: '用户不存在',
                data: null
            });
        }

        return res.json({
            code: 200,
            message: '密码重置成功',
            data: null
        });
    } catch (error) {
        console.error('重置密码错误:', error);
        return res.json({
            code: 500,
            message: '服务器内部错误',
            data: null
        });
    }
});

// 获取用户信息接口
router.get('/info', authMiddleware, async (req, res) => {
    try {
        const [users] = await db.execute(
            'SELECT id, user_name, mobile, role, company_id, create_time, last_login_time FROM users WHERE id = ?',
            [req.user.user_id]
        );

        if (users.length === 0) {
            return res.json({
                code: 404,
                message: '用户不存在',
                data: null
            });
        }

        const user = users[0];
        // 手机号脱敏
        const maskedMobile = user.mobile.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');

        return res.json({
            code: 200,
            message: 'success',
            data: {
                user_id: user.id,
                user_name: user.user_name,
                mobile: maskedMobile,
                role: user.role,
                company_id: user.company_id,
                create_time: user.create_time,
                last_login_time: user.last_login_time
            }
        });
    } catch (error) {
        console.error('获取用户信息错误:', error);
        return res.json({
            code: 500,
            message: '服务器内部错误',
            data: null
        });
    }
});

// 发送验证码接口
router.post('/send_code', async (req, res) => {
    console.log(req.body);
    try {
        const { mobile, type } = req.body;

        if (!mobile || !type) {
            return res.json({
                code: 400,
                message: '请求参数错误',
                data: null
            });
        }

        const mobileRegex = /^1[3-9]\d{9}$/;
        if (!mobileRegex.test(mobile)) {
            return res.json({
                code: 400,
                message: '手机号格式不正确',
                data: null
            });
        }

        const code = generateCode();
        const expireTime = await saveCode(mobile, code, type);

        return res.json({
            code: 200,
            message: '验证码发送成功',
            data: {
                expire_time: 300
            }
        });
    } catch (error) {
        console.error('发送验证码错误:', error);
        return res.json({
            code: 500,
            message: '服务器内部错误',
            data: null
        });
    }
});


module.exports = router;
