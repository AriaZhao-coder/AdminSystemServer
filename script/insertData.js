const mysql = require('mysql2/promise');

// 常量定义
const TOTAL_RECORDS = 1000;
const BATCH_SIZE = 50;

// 更新后的部门数据
const DEPARTMENTS = [
    { id: 1, name: '总裁办', parent_id: null, level: 1 },
    { id: 2, name: '技术部', parent_id: null, level: 1 },
    { id: 3, name: '产品部', parent_id: null, level: 1 },
    { id: 4, name: '运营部', parent_id: null, level: 1 },
    { id: 21, name: '人力资源部', parent_id: null, level: 1 },
    { id: 22, name: '财务部', parent_id: null, level: 1 },
    { id: 23, name: '后端开发组', parent_id: 2, level: 2 },
    { id: 24, name: '前端开发组', parent_id: 2, level: 2 },
    { id: 25, name: '移动开发组', parent_id: 2, level: 2 },
    { id: 26, name: '测试组', parent_id: 2, level: 2 }
];

// 数据库配置
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'myapp',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 修改部门ID生成函数以匹配实际部门ID
function generateDeptId() {
    const level = Math.random() < 0.2 ? 1 : 2;
    if (level === 1) {
        // 一级部门: [1,2,3,4,21,22]
        const firstLevelDepts = [1, 2, 3, 4, 21, 22];
        const index = Math.floor(gaussianRandom(2, 1.5)) % firstLevelDepts.length;
        return firstLevelDepts[Math.max(0, Math.min(index, firstLevelDepts.length - 1))];
    } else {
        // 二级部门: [23,24,25,26]
        const secondLevelDepts = [23, 24, 25, 26];
        const index = Math.floor(gaussianRandom(2, 1)) % secondLevelDepts.length;
        return secondLevelDepts[Math.max(0, Math.min(index, secondLevelDepts.length - 1))];
    }
}

function gaussianRandom(mean, standardDeviation) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * standardDeviation + mean;
}

function generateMobile() {
    const prefixes = ['133', '134', '135', '136', '137', '138', '139', '150', '151', '152', '157', '158', '159', '187', '188'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
    return prefix + suffix;
}

function generateIDNumber(birthDate) {
    const areaCode = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
    const birthYear = birthDate.getFullYear().toString();
    const birthMonth = String(birthDate.getMonth() + 1).padStart(2, '0');
    const birthDay = String(birthDate.getDate()).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `${areaCode}${birthYear}${birthMonth}${birthDay}${sequence}`;
}

function generateDate(startYear, endYear) {
    const start = new Date(startYear, 0, 1).getTime();
    const end = new Date(endYear, 11, 31).getTime();
    return new Date(start + Math.random() * (end - start));
}

function generateEducation() {
    const educations = ['小学', '初中', '中专', '大专', '本科', '硕士'];
    const index = Math.min(Math.max(Math.floor(gaussianRandom(4, 1)), 0), 5);
    return educations[index];
}

function generateUsername(index) {
    const prefixes = ['zh', 'li', 'wang', 'zhang', 'chen', 'yang', 'zhao', 'wu', 'sun', 'hu'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return `${prefix}${String(index).padStart(5, '0')}`;
}

async function insertBatchData(pool) {
    const connection = await pool.getConnection();
    let processedRecords = 0;

    try {
        await connection.beginTransaction();

        for (let i = 0; i < TOTAL_RECORDS; i++) {
            if (i > 0 && i % BATCH_SIZE === 0) {
                await connection.commit();
                await connection.beginTransaction();
                processedRecords = i;
                console.log(`Processed ${processedRecords} records (${Math.floor(processedRecords/TOTAL_RECORDS*100)}%)...`);
            }

            // 插入用户数据
            const userName = generateUsername(i + 1);
            const createTime = generateDate(2024, 2025);
            const lastLoginTime = new Date(createTime.getTime() + Math.random() * (new Date() - createTime));

            const [userResult] = await connection.execute(
                'INSERT INTO users (user_name, password, mobile, role, company_id, create_time, last_login_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    userName,
                    '$2a$10$cxHt.RNH8PRsFMxogZFu..g77NJT4u4oC8W6Hj.E5Or78XO.SuHKa',
                    generateMobile(),
                    Math.random() < 0.1 ? 'Admin' : 'User',
                    'default_company',
                    createTime,
                    lastLoginTime
                ]
            );

            const userId = userResult.insertId;
            const birthDate = generateDate(1970, 2000);

            await connection.execute(
                'INSERT INTO employee_profiles (user_id, dept_id, id_number, education, gender, birth_date, join_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                    userId,
                    generateDeptId(),
                    generateIDNumber(birthDate),
                    generateEducation(),
                    Math.random() < 0.6 ? '男' : '女',
                    birthDate,
                    createTime
                ]
            );
        }

        await connection.commit();
        console.log(`Completed! Total ${TOTAL_RECORDS} records inserted.`);
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

// 主函数
async function main() {
    let pool;
    try {
        console.log('Starting data insertion...');
        console.log(`Target: ${TOTAL_RECORDS} records`);
        console.log(`Batch size: ${BATCH_SIZE}`);

        pool = mysql.createPool(dbConfig);
        await insertBatchData(pool);

        console.log('Data insertion completed successfully!');
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
