const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// 获取员工列表
router.post('/info_list', authMiddleware, async (req, res) => {
    try {
        // 确保转换为数字类型
        const page = parseInt(req.body.page) || 1;
        const size = parseInt(req.body.size) || 5;
        const queryData = req.body.queryData || {};

        const isAdmin = req.user.role === 'Admin';

        // 构建查询条件
        const conditions = [];
        const params = [];

        if (!isAdmin) {
            conditions.push('u.id = ?');
            params.push(req.user.id); // 使用 req.user.id 替代 userId
        }

        // 处理查询参数，确保是数组
        if (Array.isArray(queryData.education) && queryData.education.length > 0) {
            const placeholders = queryData.education.map(() => '?').join(',');
            conditions.push(`ep.education IN (${placeholders})`);
            params.push(...queryData.education);
        }

        if (Array.isArray(queryData.level) && queryData.level.length > 0) {
            const placeholders = queryData.level.map(() => '?').join(',');
            conditions.push(`el.level_name IN (${placeholders})`);
            params.push(...queryData.level);
        }

        if (Array.isArray(queryData.department) && queryData.department.length > 0) {
            const placeholders = queryData.department.map(() => '?').join(',');
            conditions.push(`d.dept_name IN (${placeholders})`);
            params.push(...queryData.department);
        }

        if (Array.isArray(queryData.name) && queryData.name.length > 0) {
            const placeholders = queryData.name.map(() => '?').join(',');
            conditions.push(`ep.real_name IN (${placeholders})`);
            params.push(...queryData.name);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';


        // 查询总数
        const countSql = `
            SELECT COUNT(*) as total
            FROM employee_profiles ep
            JOIN users u ON ep.user_id = u.id
            JOIN departments d ON ep.dept_id = d.id
            LEFT JOIN employee_levels el ON ep.level_id = el.id
            ${whereClause}
        `;

        const [countResult] = await db.execute(countSql, params);
        const total = countResult[0].total;

        // 查询员工列表
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
        u.mobile,
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
                LIMIT ${Number(offset)}, ${Number(size)}
        `;

        // 不再需要将分页参数添加到查询参数中
        const queryParams = conditions.length ? params : [];
        const [staffList] = await db.execute(staffSql, queryParams);

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
// 获取员工详情
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

        // 查询员工详情
        const staffSql = `
            SELECT
                ep.*,
                u.role as identity,
                u.user_name,
                u.mobile,
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

        const [staffDetails] = await db.execute(staffSql, [id]);

        if (staffDetails.length === 0) {
            return res.json({
                code: 1,
                msg: '员工不存在',
                data: null
            });
        }

        const staff = staffDetails[0];
        const formattedStaff = {
            id: staff.id,
            identity: staff.identity === 'Admin' ? 1 : 0,
            level: {
                levelName: staff.level_name,
                levelDescription: staff.level_description
            },
            name: staff.real_name,
            userName: staff.user_name,
            department: {
                id: staff.dept_id,
                departmentName: staff.dept_name
            },
            education: staff.education,
            mobile: staff.mobile,
            sex: staff.gender,
            birthday: staff.birth_date,
            joinDate: staff.join_date,
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
        if (!req.user.role === 'Admin') {
            return res.json({
                code: 403,
                msg: '对不起，您没有删除员工信息的权限',
                data: null
            });
        }

        await connection.beginTransaction();

        const [userResult] = await connection.execute(
            'SELECT user_id FROM employee_profiles WHERE id = ?',
            [id]
        );

        if (!userResult.length) {
            return res.json({
                code: 1,
                msg: '员工不存在',
                data: null
            });
        }

        const userId = userResult[0].user_id;

        // 1. 删除考核项目
        await connection.execute(
            `DELETE ai FROM assessment_items ai 
             JOIN assessment_records ar ON ai.assessment_id = ar.id 
             WHERE ar.employee_id = ?`,
            [id]
        );

        // 2. 删除考核记录
        await connection.execute(
            'DELETE FROM assessment_records WHERE employee_id = ?',
            [id]
        );

        // 3. 删除绩效目标
        await connection.execute(
            `DELETE pt FROM performance_targets pt
             JOIN performance_records pr ON pt.performance_id = pr.id
             WHERE pr.employee_id = ?`,
            [id]
        );

        // 4. 删除绩效记录
        await connection.execute(
            'DELETE FROM performance_records WHERE employee_id = ?',
            [id]
        );

        // 5. 删除员工信息
        await connection.execute(
            'DELETE FROM employee_profiles WHERE id = ?',
            [id]
        );

        // 6. 删除用户账号
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

// 修改员工信息
router.put('/update/:id', authMiddleware, async (req, res) => {
    const connection = await db.getConnection();
    try {
        const { id } = req.params;
        const isAdmin = req.user.role === 'Admin';
        const userId = req.user.id;

        // 获取当前员工信息
        const [currentEmployee] = await connection.execute(
            'SELECT user_id FROM employee_profiles WHERE id = ?',
            [id]
        );

        if (currentEmployee.length === 0) {
            return res.json({
                code: 1,
                msg: '员工不存在',
                data: null
            });
        }

        // 检查权限
        if (!isAdmin && currentEmployee[0].user_id !== userId) {
            return res.json({
                code: 403,
                msg: '对不起，您没有修改该信息的权限',
                data: null
            });
        }

        const updateData = req.body;
        await connection.beginTransaction();

        // 构建 employee_profiles 表的更新字段
        const profileUpdateFields = [];
        const profileUpdateParams = [];

        // 构建 users 表的更新字段
        const userUpdateFields = [];
        const userUpdateParams = [];

        // 管理员可以修改所有字段
        if (isAdmin) {
            if (updateData.name) {
                profileUpdateFields.push('real_name = ?');
                profileUpdateParams.push(updateData.name);
            }
            if (updateData.department) {
                profileUpdateFields.push('dept_id = ?');
                profileUpdateParams.push(updateData.department.id);
            }
            if (updateData.education) {
                profileUpdateFields.push('education = ?');
                profileUpdateParams.push(updateData.education);
            }
            if (updateData.level) {
                profileUpdateFields.push('level_id = ?');
                profileUpdateParams.push(updateData.level.id);
            }
        }

        // 所有用户都可以修改的字段
        if (updateData.mobile) {
            userUpdateFields.push('mobile = ?');
            userUpdateParams.push(updateData.mobile);
        }

        // 执行 employee_profiles 表的更新
        if (profileUpdateFields.length > 0) {
            profileUpdateParams.push(id);
            await connection.execute(
                `UPDATE employee_profiles
                 SET ${profileUpdateFields.join(', ')}
                 WHERE id = ?`,
                profileUpdateParams
            );
        }

        // 执行 users 表的更新
        if (userUpdateFields.length > 0) {
            userUpdateParams.push(currentEmployee[0].user_id);
            await connection.execute(
                `UPDATE users
                 SET ${userUpdateFields.join(', ')}
                 WHERE id = ?`,
                userUpdateParams
            );
        }

        await connection.commit();

        return res.json({
            code: 0,
            msg: '修改成功',
            data: {
                id,
                ...updateData
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('修改员工信息错误:', error);
        return res.json({
            code: 1,
            msg: '修改员工信息失败',
            data: null
        });
    } finally {
        connection.release();
    }
});

module.exports = router;
