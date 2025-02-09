const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// 获取员工列表

router.post('/info_list', authMiddleware, async (req, res) => {
    try {
        const { page = 1, size = 10, queryData = {}} = req.query;
        const isAdmin = req.user.role === 'Admin';
        const userId = !isAdmin ? req.user.id : null;

        //构建查询条件
        const conditions = [];
        const params = [];

        if(!isAdmin) {
            conditions.push('u.id = ?');
            params.push(userId);
        }

        //处理查询参数
        if (queryData.education && queryData.education.length) {
            conditions.push('ep.education IN (?)');
            params.push(queryData.education);
        }
        if (queryData.level && queryData.level.length) {
            conditions.push('el.level_name IN (?)');
            params.push(queryData.level);
        }
        if (queryData.department && queryData.department.length) {
            conditions.push('d.dept_name IN (?)');
            params.push(queryData.department);
        }
        if (queryData.name && queryData.name.length) {
            conditions.push('ep.real_name IN (?)');
            params.push(queryData.name);
        }

        // 查询总数
        const countSql = `
            SELECT COUNT(*) as total
            FROM employee_profiles ep
            JOIN users u ON ep.user_id = u.id
            JOIN departments d ON ep.dept_id = d.id
            LEFT JOIN employee_levels el ON ep.level_id = el.id
            ${whereClause}
        `;

        const [countResult] = await db.query(countSql, params);
        const total = countResult[0].total;

        //查询员工列表
        const offset = (page - 1) * size;
        const staffSql = `
            SELECT 
                ep.id,
                u.role as identity,
                el.level_name,
                el.level_description,
                ep.real_name as name,
                u.user_name,
                d.dept_name,
                d.id as dept_id,
                ep.education,
                ep.mobile,
                ep.gender as sex,
                ep.birth_date as birthday,
                ep.join_date,
                ep.avatar
            FROM employee_profiles ep
            JOIN users u ON ep.user_id = u.id
            JOIN departments d ON ep.dept_id = d.id
            LEFT JOIN employee_levels el ON ep.level_id = el.id
            ${whereClause}
            ORDER BY ep.id
            LIMIT ? OFFSET ?
        `;
        const [staffList] = await db.execute(staffSql, [...params, size, offset]);

        // 格式化返回数据
        const formattedStaffList = staffList.map(staff => ({
            id: staff.id,
            identity: staff.identity === 'Admin' ? 1 : 0,
            level: {
                levelName: staff.level_name,
                levelDescription: staff.level_description
            },
            name: staff.name,
            userName: staff.user_name,
            department: {
                id: staff.dept_id,
                departmentName: staff.dept_name
            },
            education: staff.education,
            mobile: staff.mobile,
            sex: staff.sex,
            birthday: staff.birthday,
            joinDate: staff.join_date,
            avatar: staff.avatar
        }));

        return res.json({
            code: 0,
            msg: 'success',
            data: {
                total,
                staffList: formattedStaffList
            }
        });

    } catch (error) {
        console.error('获取员工列表错误:', error);
        return res.json({
            code: 1,
            msg: '获取员工列表失败',
            data: null
        });
    }
});

//获取员工详情
router.post('/info/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'Admin';
        const userId = req.user.id;

        // 检查权限
        if (!isAdmin && id != userId) {
            return res.json({
                code: 0,
                message: '对不起，您无法查看其他员工详细信息',
                data: null
            });
        }

        //查询员工详情
        const staffSql = `
            SELECT 
                ep.*,
                u.role as identity,
                u.user_name,
                el.level_name,
                el.level_description,
                d.dept_name,
                d.id as dept_id
            FROM employee_profiles ep
            JOIN users u ON ep.user_id = u.id
            JOIN departments d ON ep.dept_id = d.id
            LEFT JOIN employee_levels el ON ep.level_id = el.id
            WHERE ep.id = ?
        `;

        const [staffDetails] = await db.query(staffSql, [id]);

        if (staffDetails.length === 0) {
            return res.json({
                code: 0,
                msg:'员工不存在',
                data: null
            });
        }

        const staff = staffDetails[0];
        const formattedStaff = {
            id: staff.id,
            identity: staff.identity === 'Admin' ? 1 : 0,
            level: {
                levelName:staff.level_name,
                levelDescription: staff.level_description
            },
            name: staff.real_name,
            userName: staff.user_name,
            department: {
                id: staff.dept_id,
                department: staff.dept_name
            },
            education: staff.education,
            mobile: staff.mobile,
            birthday: staff.birth_date,
            joinDate: staff.joinDate,
            avatar: staff.avatar,
            idNumber: staff.id_number
        };
        return res.json({
            code: 0,
            msg: 'success',
            data: formattedStaff
        });

    } catch (error) {
        console.error('获取员工详情错误:', error);
        return res.json({
            code: 1,
            msg: '获取员工详情失败',
            data: null
        });
    }
});

// 删除员工
router.delete('/delete/:id', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'Admin';

        // 检查权限
        if (!isAdmin) {
            return res.json({
                code: 403,
                msg: '对不起，您没有删除员工信息的权限',
                data: null
            });
        }

        await connection.beginTransaction();

        // 查询关联的user_id
        const [userResult] = await connection.execute(
            'SELECT user_id FROM employee_profiles WHERE id = ?',
            [id]
        );

        if (userResult.length === 0) {
            return res.json({
                code: 1,
                msg: '员工不存在',
                data: null
            });
        }

        const userId = userResult[0].user_id;

        // 删除员工信息
        await connection.execute(
            'DELETE FROM employee_profiles WHERE id = ?',
            [id]
        );

        // 删除用户账号
        await connection.execute(
            'DELETE FROM users WHERE id = ?',
            [userId]
        );

        await connection.commit();

        return res.json({
            code: 0,
            msg: '删除成功',
            data: null
        });

    } catch (error) {
        await connection.rollback();
        console.error('删除员工错误:', error);
        return res.json({
            code: 1,
            msg: '删除员工失败',
            data: null
        });
    } finally {
        connection.release();
    }
});

// 新增员工
router.post('/add', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const isAdmin = req.user.role === 'Admin';

        // 检查权限
        if (!isAdmin) {
            return res.json({
                code: 403,
                msg: '对不起，您没有新增员工的权限',
                data: null
            });
        }

        const {
            name, userName, password, department, education,
            mobile, sex, birthday, joinDate, level, avatar = null,
            idNumber
        } = req.body;

        await connection.beginTransaction();

        // 插入用户账号
        const [userResult] = await connection.execute(
            'INSERT INTO users (user_name, password, mobile, role, company_id) VALUES (?, ?, ?, ?, ?)',
            [userName, password, mobile, 'User', 'default_company']
        );

        // 插入员工信息
        const [employeeResult] = await connection.execute(
            `INSERT INTO employee_profiles 
            (user_id, dept_id, real_name, education, gender, birth_date, 
            join_date, avatar, id_number, level_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userResult.insertId,
                department.id,
                name,
                education,
                sex,
                birthday,
                joinDate,
                avatar,
                idNumber,
                level.id
            ]
        );

        await connection.commit();

        return res.json({
            code: 0,
            msg: '新增成功',
            data: {
                id: employeeResult.insertId,
                name,
                userName
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('新增员工错误:', error);
        return res.json({
            code: 1,
            msg: '新增员工失败',
            data: null
        });
    } finally {
        connection.release();
    }
});

//修改员工信息
router.put('/update/:id', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'Admin';
        const userId = req.user.role;
        //获取当前员工信息
        const [currentEmployee] = await connection.execute(
            'SELECT user_id FROM employee_profiles WHERE id = ?',
            [id]
        );
        if (currentEmployee.length === 0) {
            return res.json({
                code: 1,
                msg:'员工不存在',
                data: null
            })
        }
        //检查权限
        if (!isAdmin && currentEmployee[0].user_id !== userId) {
            return res.json({
                code: 403,
                msg: '对不起，您没有修改该信息的权限',
                data: null
            });
        }

        const updateData = req.body;
        await connection.beginTransaction();

        //构建更新字段
        const updateFields = [];
        const updateParams = [];

        //管理员可以修改所有字段
        if (isAdmin) {
            if (updateData.name) {
                updateFields.push('real_name = ?');
                updateParams.push(updateData.name);
            }
            if (updateData.department) {
                updateFields.push('dept_id = ?');
                updateParams.push(updateData.department.id);
            }
            if (updateData.education) {
                updateFields.push('education = ?');
                updateParams.push(updateData.education);
            }
            if (updateData.level) {
                updateFields.push('level_id = ?');
                updateParams.push(updateData.level.id);
            }
        }

        //所有用户都可以修改的字段
        if (updateData.mobile) {
            updateFields.push('mobil = ?');
            updateParams.push(updateData.mobile);
        }

        //执行更新
        if (updateFields.length > 0) {
            updateParams.push(id);
            await connection.execute(
                `UPDATE employee_profiles 
                 SET ${updateFields.join(',')}
                 WHERE id = ?`,
                updateParams,
            );

        }
        await connection.commit();

        return res.json({
            code: 0,
            msg: '修改成功',
            data: {
                id,
                ...updateData,
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('修改员工信息错误:', error);
        return res.json({
            code: 1,
            msg:"修改员工信息失败",
            data: null
        });
    }finally {
        connection.release();
    }
})
module.exports = router;
