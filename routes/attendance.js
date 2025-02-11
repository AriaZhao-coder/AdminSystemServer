const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// 格式化日期时间
function formatDateTime(date) {
    return new Date(date).toISOString();
}

// 获取时间范围内的考勤数据
async function getAttendanceData(type, startDate, endDate, userId = null) {
    // 构建基础查询条件
    const conditions = [
        'ar.attendance_type = ?',
        'ar.check_in_time BETWEEN ? AND ?'
    ];
    const params = [type, startDate, endDate];

    if (userId) {
        conditions.push('ar.user_id = ?');
        params.push(userId);
    }

    // 统计数据查询
    const statsSql = `
        SELECT 
            DATE(check_in_time) as date,
            COUNT(*) as count
        FROM attendance_records ar
        WHERE ${conditions.join(' AND ')}
        GROUP BY DATE(check_in_time)
        ORDER BY date ASC
    `;

    // 详细记录查询
    const detailsSql = `
        SELECT 
            ar.id,
            ar.create_time,
            ep.real_name as staffName,
            d.dept_name as staffDepartment,
            ar.attendance_type
        FROM attendance_records ar
        JOIN users u ON ar.user_id = u.id
        JOIN employee_profiles ep ON ar.employee_id = ep.id
        JOIN departments d ON ar.dept_id = d.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY ar.create_time DESC
    `;

    const [stats] = await db.execute(statsSql, params);
    const [details] = await db.execute(detailsSql, params);

    return {
        stats,
        details
    };
}

// 考勤统计接口
router.get('/attendanceTable', authMiddleware, async (req, res) => {
    try {
        // 验证用户权限
        const isAdmin = req.user.role === 'Admin';
        const userId = !isAdmin ? req.user.id : null;

        // 获取统计时间范围（最近30天）
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        // 获取迟到数据
        const lateData = await getAttendanceData(3, startDate, endDate, userId);
        // 获取早退数据
        const earlyData = await getAttendanceData(4, startDate, endDate, userId);

        // 构建返回数据
        const response = {
            code: 0,
            msg: '',
            data: {
                // 迟到统计图表数据
                lateBI: {
                    xData: lateData.stats.map(item => formatDateTime(item.date)),
                    yData: lateData.stats.map(item => item.count)
                },
                // 迟到详细记录
                lateTableList: lateData.details.map(item => ({
                    _id: item.id,
                    createTime: formatDateTime(item.create_time),
                    staffName: item.staffName,
                    staffDepartment: item.staffDepartment,
                    attendanceType: item.attendance_type,
                    _v: 0
                })),
                // 早退统计图表数据
                earlyBI: {
                    xData: earlyData.stats.map(item => formatDateTime(item.date)),
                    yData: earlyData.stats.map(item => item.count),
                },
                // 早退详细记录
                earlyTableList: earlyData.details.map(item => ({
                    _id: item.id,
                    createTime: formatDateTime(item.create_time),
                    staffName: item.staffName,
                    staffDepartment: item.staffDepartment,
                    attendanceType: item.attendance_type,
                    _v: 0
                }))
    }
    };

        return res.json(response);

    } catch (error) {
        console.error('考勤统计错误:', error);
        return res.json({
            code: 1,
            msg: '获取考勤统计数据失败',
            data: null
        });
    }
});

module.exports = router;
