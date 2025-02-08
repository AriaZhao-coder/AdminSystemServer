const express = require('express');
const router = express.Router();
const db = require('../config/database');
const authMiddleware = require('../middleware/auth');

// 计算星座的函数
function getConstellation(month, day) {
    const dates = [20, 19, 21, 20, 21, 22, 23, 23, 23, 24, 22, 21];
    const constellations = ["水瓶", "双鱼", "白羊", "金牛", "双子", "巨蟹", "狮子", "处女", "天秤", "天蝎", "射手", "摩羯"];
    month = parseInt(month);
    day = parseInt(day);
    const index = day < dates[month - 1] ? month - 1 : month;
    return constellations[index % 12];
}

// 计算工作年限区间
function getWorkingYearsRange(joinDate) {
    const now = new Date();
    const join = new Date(joinDate);
    const years = (now - join) / (365 * 24 * 60 * 60 * 1000);

    if (years <= 1) return "1年内";
    if (years <= 2) return "1-2年内";
    return "2年以上";
}

// 获取年龄段
function getAgeRange(age) {
    if (age < 20) return "20岁以下";
    if (age <= 25) return "20-25岁";
    if (age <= 30) return "26-30岁";
    if (age <= 35) return "31-35岁";
    if (age <= 40) return "36-40岁";
    if (age <= 45) return "41-45岁";
    if (age <= 50) return "46-50岁";
    return "50岁以上";
}

// 员工分析接口
router.get('/analyze_staff', authMiddleware, async (req, res) => {
    try {
        // 验证管理员权限
        if (req.user.role !== 'Admin') {
            return res.json({
                code: 403,
                msg: '权限不足',
                data: null
            });
        }

        // 1. 获取总员工数
        const [totalResult] = await db.execute(
            'SELECT COUNT(*) as total FROM employee_profiles'
        );
        const total = totalResult[0].total;

        // 2. 获取员工详细信息用于统计
        const [employees] = await db.execute(`
            SELECT ep.*, u.user_name, d.dept_name, d.parent_id, d2.dept_name as parent_dept_name
            FROM employee_profiles ep
                     LEFT JOIN users u ON ep.user_id = u.id
                     LEFT JOIN departments d ON ep.dept_id = d.id
                     LEFT JOIN departments d2 ON d.parent_id = d2.id
        `);

        // 3. 统计星座分布
        const constellationMap = new Map();
        employees.forEach(emp => {
            const birthDate = new Date(emp.birth_date);
            const month = birthDate.getMonth() + 1;
            const day = birthDate.getDate();
            const constellation = getConstellation(month, day);
            constellationMap.set(constellation, (constellationMap.get(constellation) || 0) + 1);
        });

        const constellationList = Array.from(constellationMap.entries()).map(([name, value]) => ({
            name,
            value
        }));

        // 4. 统计学历分布
        const educationMap = new Map();
        employees.forEach(emp => {
            educationMap.set(emp.education, (educationMap.get(emp.education) || 0) + 1);
        });

        const educationList = Array.from(educationMap.entries()).map(([name, value]) => ({
            name,
            value
        }));

        // 5. 统计性别和平均年龄
        const genderStats = new Map();
        employees.forEach(emp => {
            if (!genderStats.has(emp.gender)) {
                genderStats.set(emp.gender, { count: 0, totalAge: 0 });
            }
            const stats = genderStats.get(emp.gender);
            stats.count++;
            const age = new Date().getFullYear() - new Date(emp.birth_date).getFullYear();
            stats.totalAge += age;
        });

        const genderList = Array.from(genderStats.entries()).map(([name, stats]) => ({
            name,
            value: stats.count,
            age: (stats.totalAge / stats.count).toFixed(2)
        }));

        // 6. 统计入职时间分布
        const onboardingTimeData = {
            "1年内": 0,
            "1-2年内": 0,
            "2年以上": 0
        };

        employees.forEach(emp => {
            const range = getWorkingYearsRange(emp.join_date);
            onboardingTimeData[range]++;
        });

        // 7. 获取工龄最长的员工
        const workingYearsMaps = employees
            .sort((a, b) => new Date(a.join_date) - new Date(b.join_date))
            .slice(0, 10)
            .map(emp => ({
                userName: emp.user_name,
                department: emp.dept_name
            }));
        // 8. 统计年龄分布
        const ageMap = {
            "20岁以下": 0,
            "20-25岁": 0,
            "26-30岁": 0,
            "31-35岁": 0,
            "36-40岁": 0,
            "41-45岁": 0,
            "46-50岁": 0,
            "50岁以上": 0
        };

        employees.forEach(emp => {
            const age = new Date().getFullYear() - new Date(emp.birth_date).getFullYear();
            const range = getAgeRange(age);
            ageMap[range]++;
        });

        // 9. 部门分布统计
        const departmentDistribution = {};
        const deptEmployeeCount = new Map();

        // 首先统计每个部门的人数
        employees.forEach(emp => {
            if (emp.dept_name) {
                // 如果是二级部门，将员工计入一级部门
                const deptName = emp.parent_dept_name || emp.dept_name;
                deptEmployeeCount.set(deptName, (deptEmployeeCount.get(deptName) || 0) + 1);
            }
        });

        // 转换为对象格式并计算百分比
        for (const [dept, count] of deptEmployeeCount.entries()) {
            const percentage = ((count / total) * 100).toFixed(1);
            departmentDistribution[dept] = {
                count,
                percentage: `${percentage}%`
            };
        }
        return res.json({
            code: 0,
            msg: 'success',
            data: {
                total,
                constellationList,
                educationList,
                genderList,
                onboardingTimeData,
                workingYearsMaps,
                ageMap,
                departmentDistribution
            }
        });

    } catch (error) {
        console.error('员工分析错误:', error);
        return res.json({
            code: 1,
            msg: '获取员工分析数据失败',
            data: null
        });
    }
});

module.exports = router;
