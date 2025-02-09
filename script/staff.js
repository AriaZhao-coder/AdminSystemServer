const mysql = require('mysql2/promise');

// 常量定义
const TOTAL_EMPLOYEES = 1000;
const BATCH_SIZE = 50;

// 职级定义
const EMPLOYEE_LEVELS = [
    { name: 'T1-1', description: '初级工程师', salary_min: 5000, salary_max: 8000 },
    { name: 'T1-2', description: '中级工程师', salary_min: 8000, salary_max: 12000 },
    { name: 'T2-1', description: '高级工程师', salary_min: 12000, salary_max: 20000 },
    { name: 'T2-2', description: '资深工程师', salary_min: 20000, salary_max: 30000 },
    { name: 'T3-1', description: '技术专家', salary_min: 30000, salary_max: 45000 },
    { name: 'T3-2', description: '高级技术专家', salary_min: 45000, salary_max: 60000 }
];

// 绩效等级定义
const PERFORMANCE_LEVELS = ['A+', 'A', 'B+', 'B', 'C', 'D'];
const PERFORMANCE_WEIGHTS = [0.05, 0.15, 0.25, 0.35, 0.15, 0.05]; // 正态分布权重

// 数据库配置
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'myapp'
};

// 生成符合正态分布的随机数
function gaussianRandom(mean, standardDeviation) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * standardDeviation + mean;
}

// 根据权重随机选择
function weightedRandom(items, weights) {
    const r = Math.random();
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (r <= sum) return items[i];
    }
    return items[items.length - 1];
}

// 插入职级数据
async function insertLevels(connection) {
    console.log('Inserting employee levels...');
    for (const level of EMPLOYEE_LEVELS) {
        await connection.execute(
            `INSERT INTO employee_levels 
            (level_name, level_description, salary_range_min, salary_range_max) 
            VALUES (?, ?, ?, ?)`,
            [level.name, level.description, level.salary_min, level.salary_max]
        );
    }
}

// 更新员工资料，添加职级
async function updateEmployeeProfiles(connection) {
    console.log('Updating employee profiles...');
    const [employees] = await connection.execute('SELECT id FROM employee_profiles');

    for (const employee of employees) {
        // 按正态分布分配职级
        const levelIndex = Math.min(
            Math.max(
                Math.floor(gaussianRandom(2, 1)),
                0
            ),
            EMPLOYEE_LEVELS.length - 1
        );
        const [levels] = await connection.execute(
            'SELECT id FROM employee_levels WHERE level_name = ?',
            [EMPLOYEE_LEVELS[levelIndex].name]
        );

        await connection.execute(
            `UPDATE employee_profiles 
            SET level_id = ?,
                avatar = ?,
                real_name = ?
            WHERE id = ?`,
            [
                levels[0].id,
                `/avatars/default${Math.floor(Math.random() * 10) + 1}.png`,
                `员工${employee.id}`,
                employee.id
            ]
        );
    }
}

// 生成绩效记录
async function generatePerformanceRecords(connection) {
    console.log('Generating performance records...');
    const [employees] = await connection.execute('SELECT id, user_id FROM employee_profiles');
    const years = [2023, 2024];
    const quarters = [1, 2, 3, 4];

    for (const employee of employees) {
        for (const year of years) {
            for (const quarter of quarters) {
                // 跳过未来的季度
                if (year === 2024 && quarter > 1) continue;

                const performanceLevel = weightedRandom(PERFORMANCE_LEVELS, PERFORMANCE_WEIGHTS);
                const score = 60 + Math.floor(gaussianRandom(25, 8)); // 60-100分，均值85，标准差8

                const [result] = await connection.execute(
                    `INSERT INTO performance_records 
                    (employee_id, year, quarter, score, level, evaluator_id, 
                    evaluation_date, feedback, status) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        employee.id,
                        year,
                        quarter,
                        score,
                        performanceLevel,
                        employee.user_id, // 假设上级是同部门的管理员
                        `${year}-${quarter * 3}-15`,
                        `${year}年第${quarter}季度绩效评估反馈：整体表现${performanceLevel}级...`,
                        '已确认'
                    ]
                );

                // 生成绩效目标
                const targetCount = Math.floor(gaussianRandom(4, 1));
                for (let i = 0; i < targetCount; i++) {
                    await connection.execute(
                        `INSERT INTO performance_targets 
                        (performance_id, content, weight, score, comment) 
                        VALUES (?, ?, ?, ?, ?)`,
                        [
                            result.insertId,
                            `目标${i + 1}：完成XX项目开发`,
                            25, // 权重
                            Math.floor(gaussianRandom(85, 8)),
                            '按时完成目标要求'
                        ]
                    );
                }
            }
        }
    }
}

// 生成考核记录
async function generateAssessmentRecords(connection) {
    console.log('Generating assessment records...');
    const [employees] = await connection.execute('SELECT id, user_id FROM employee_profiles');

    for (const employee of employees) {
        // 每个员工生成2023年度考核
        const totalScore = 60 + Math.floor(gaussianRandom(25, 8));
        const level = totalScore >= 90 ? '优秀' :
            totalScore >= 80 ? '良好' :
                totalScore >= 60 ? '合格' : '不合格';

        const [result] = await connection.execute(
            `INSERT INTO assessment_records 
            (employee_id, year, period, type, status, start_date, end_date,
            total_score, level, assessment_rank, comment, assessor_id) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employee.id,
                2023,
                '2023年度',
                '年度考核',
                '已完成',
                '2023-01-01',
                '2023-12-31',
                totalScore,
                level,
                totalScore >= 90 ? 'A' :
                    totalScore >= 80 ? 'B' :
                        totalScore >= 60 ? 'C' : 'D',
                '年度考核评语...',
                employee.user_id
            ]
        );

        // 生成考核项目
        const assessmentItems = [
            { name: '工作业绩', weight: 40 },
            { name: '专业能力', weight: 30 },
            { name: '工作态度', weight: 30 }
        ];

        for (const item of assessmentItems) {
            await connection.execute(
                `INSERT INTO assessment_items 
                (assessment_id, name, weight, score, criteria, comment) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    result.insertId,
                    item.name,
                    item.weight,
                    Math.floor(gaussianRandom(85, 8)),
                    '评分标准...',
                    '项目评语...'
                ]
            );
        }
    }
}

// 生成奖惩记录
async function generateRewardPunishmentRecords(connection) {
    console.log('Generating reward and punishment records...');
    const [employees] = await connection.execute('SELECT id, user_id FROM employee_profiles');

    for (const employee of employees) {
        // 按20%概率生成奖励记录
        if (Math.random() < 0.2) {
            await connection.execute(
                `INSERT INTO reward_punishment_records 
                (employee_id, type, title, level, date, reason, description,
                related_project, approver_id, reward_type, reward_amount, reward_bonus) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    employee.id,
                    'reward',
                    '季度优秀员工奖',
                    '一等功',
                    '2023-12-31',
                    '工作表现优秀，成功完成重要项目',
                    '详细说明...',
                    'XX项目',
                    employee.user_id,
                    '物质奖励',
                    5000,
                    '带薪休假3天'
                ]
            );
        }

        // 按5%概率生成处罚记录
        if (Math.random() < 0.05) {
            await connection.execute(
                `INSERT INTO reward_punishment_records 
                (employee_id, type, title, level, date, reason, description,
                related_project, approver_id, punishment_type, punishment_period, punishment_impact) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    employee.id,
                    'punishment',
                    '工作失误处分',
                    '警告',
                    '2023-11-15',
                    '工作严重失误导致系统故障',
                    '详细说明...',
                    'XX项目',
                    employee.user_id,
                    '警告',
                    '6个月',
                    '暂缓升职升级'
                ]
            );
        }
    }
}

// 主函数
async function main() {
    let pool = null;
    try {
        console.log('Starting data generation...');
        pool = mysql.createPool(dbConfig);
        const connection = await pool.getConnection();

        try {
            await connection.beginTransaction();

            // 按顺序执行各个数据生成函数
            await insertLevels(connection);
            await updateEmployeeProfiles(connection);
            await generatePerformanceRecords(connection);
            await generateAssessmentRecords(connection);
            await generateRewardPunishmentRecords(connection);

            await connection.commit();
            console.log('Data generation completed successfully!');
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Fatal error:', error);
    } finally {
        if (pool) {
            await pool.end();
        }
    }
}

// 运行程序
main().catch(console.error);
