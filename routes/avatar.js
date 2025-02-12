const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// 配置multer存储
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../public/uploads/avatars');
        try {
            await fs.access(uploadDir);
        } catch (error) {
            await fs.mkdir(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

// 文件过滤器
const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型！只允许 JPG/PNG 格式。'), false);
    }
};

// 创建multer实例
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024
    }
});


// 仅上传接口（用于新增员工时上传头像）
router.post('/upload', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                code: 1,
                msg: '没有文件被上传',
                data: null
            });
        }

        // 构建文件访问URL
        const fileUrl = `/uploads/avatars/${req.file.filename}`;

        return res.json({
            code: 0,
            msg: '上传成功',
            data: {
                url: fileUrl
            }
        });
    } catch (error) {
        // 如果上传失败，删除已上传的文件
        if (req.file) {
            const filePath = path.join(__dirname, '../public/uploads/avatars', req.file.filename);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error('删除失败的上传文件时出错:', err);
            }
        }

        console.error('文件上传错误:', error);
        return res.status(500).json({
            code: 1,
            msg: error.message || '文件上传失败',
            data: null
        });
    }
});

// 上传头像接口
router.post('/:employeeId', authMiddleware, upload.single('avatar'), async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { employeeId } = req.params;
        const isAdmin = req.user.role === 'Admin';

        // 获取当前员工信息用于权限验证
        const [employee] = await connection.execute(
            'SELECT user_id FROM employee_profiles WHERE id = ?',
            [employeeId]
        );

        if (employee.length === 0) {
            return res.status(404).json({
                code: 1,
                msg: '员工不存在',
                data: null
            });
        }

        // 权限检查：只有管理员或本人可以修改头像
        if (!isAdmin && employee[0].user_id !== req.user.id) {
            return res.status(403).json({
                code: 1,
                msg: '没有权限修改其他用户的头像',
                data: null
            });
        }

        if (!req.file) {
            return res.status(400).json({
                code: 1,
                msg: '没有文件被上传',
                data: null
            });
        }

        await connection.beginTransaction();

        // 获取旧头像路径
        const [oldAvatar] = await connection.execute(
            'SELECT avatar FROM employee_profiles WHERE id = ?',
            [employeeId]
        );

        // 构建新文件访问URL
        const fileUrl = `/uploads/avatars/${req.file.filename}`;

        // 更新数据库中的头像URL
        await connection.execute(
            'UPDATE employee_profiles SET avatar = ? WHERE id = ?',
            [fileUrl, employeeId]
        );

        await connection.commit();

        // 如果存在旧头像且不是默认头像，则删除
        if (oldAvatar[0]?.avatar && !oldAvatar[0].avatar.includes('default')) {
            const oldFilePath = path.join(__dirname, '../public', oldAvatar[0].avatar);
            try {
                await fs.access(oldFilePath);
                await fs.unlink(oldFilePath);
            } catch (err) {
                console.error('删除旧头像文件失败:', err);
            }
        }

        return res.json({
            code: 0,
            msg: '上传成功',
            data: {
                url: fileUrl
            }
        });

    } catch (error) {
        // 如果上传过程中出现错误，回滚事务并删除已上传的文件
        if (connection) {
            await connection.rollback();
        }
        if (req.file) {
            const filePath = path.join(__dirname, '../public/uploads/avatars', req.file.filename);
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error('删除失败的上传文件时出错:', err);
            }
        }

        console.error('文件上传错误:', error);
        return res.status(500).json({
            code: 1,
            msg: error.message || '文件上传失败',
            data: null
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;
