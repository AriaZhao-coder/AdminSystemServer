const mysql = require('mysql2/promise');

// 常量定义
const TOTAL_RECORDS = 1000;
const BATCH_SIZE = 50;

// 考勤类型
const ATTENDANCE_TYPES = {
    NORMAL: 1,    // 正常打卡
    补卡: 2,      // 补卡
    LATE: 3,      // 迟到
    EARLY: 4,     // 早退
    ABSENT: 5     // 旷工
};

// 预期工作时间
const WORK_START = '09:00:00';
const WORK_END = '18:00:00';

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

// 生成符合正态分布的随机数
function gaussianRandom(mean, standardDeviation) {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * standardDeviation + mean;
}

// 生成打卡时间
function generateCheckTime(baseTime, meanMinutes, stdDevMinutes) {
    const offsetMinutes = Math.round(gaussianRandom(meanMinutes, stdDevMinutes));
    const time = new Date(baseTime);
    time.setMinutes(time.getMinutes() + offsetMinutes);
    return time;
}

// 生成考勤记录
async function generateAttendanceRecord(connection, date) {
    try {
        // 随机获取一个员工
        const [employees] = await connection.execute(
            'SELECT ep.id as employee_id, ep.user_id, ep.dept_id FROM employee_profiles ep ORDER BY RAND() LIMIT 1'
        );

        if (employees.length === 0) return null;
        const employee = employees[0];

        // 设置基准时间
        const baseCheckInTime = new Date(date);
        baseCheckInTime.setHours(9, 0, 0);
        const baseCheckOutTime = new Date(date);
        baseCheckOutTime.setHours(18, 0, 0);

        // 决定考勤类型（使用正态分布）
        const attendanceRandom = Math.random();
        let attendanceType;
        let checkInTime;
        let checkOutTime;
        let lateMinutes = 0;
        let earlyMinutes = 0;

        if (attendanceRandom < 0.75) { // 75% 正常打卡
            attendanceType = ATTENDANCE_TYPES.NORMAL;
            checkInTime = generateCheckTime(baseCheckInTime, -10, 5); // 通常提前10分钟，标准差5分钟
            checkOutTime = generateCheckTime(baseCheckOutTime, 5, 5); // 通常晚走5分钟
        } else if (attendanceRandom < 0.9) { // 15% 迟到或早退
            if (Math.random() < 0.5) {
                attendanceType = ATTENDANCE_TYPES.LATE;
                checkInTime = generateCheckTime(baseCheckInTime, 15, 10); // 平均迟到15分钟
                checkOutTime = generateCheckTime(baseCheckOutTime, 5, 5);
                lateMinutes = Math.round((checkInTime - baseCheckInTime) / 1000 / 60);
            } else {
                attendanceType = ATTENDANCE_TYPES.EARLY;
                checkInTime = generateCheckTime(baseCheckInTime, -5, 5);
                checkOutTime = generateCheckTime(baseCheckOutTime, -20, 10); // 平均早退20分钟
                earlyMinutes = Math.round((baseCheckOutTime - checkOutTime) / 1000 / 60);
            }
        } else if (attendanceRandom < 0.95) { // 5% 补卡
            attendanceType = ATTENDANCE_TYPES.补卡;
            checkInTime = generateCheckTime(baseCheckInTime, 0, 5);
            checkOutTime = generateCheckTime(baseCheckOutTime, 0, 5);
        } else { // 5% 旷工
            attendanceType = ATTENDANCE_TYPES.ABSENT;
            checkInTime = null;
            checkOutTime = null;
        }

        // 插入考勤记录
        await connection.execute(
            `INSERT INTO attendance_records 
            (user_id, employee_id, dept_id, attendance_type, check_in_time, check_out_time, 
             expected_check_in, expected_check_out, late_minutes, early_minutes) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employee.user_id,
                employee.employee_id,
                employee.dept_id,
                attendanceType,
                checkInTime,
                checkOutTime,
                WORK_START,
                WORK_END,
                lateMinutes,
                earlyMinutes
            ]
        );

    } catch (error) {
        console.error('Error generating attendance record:', error);
        throw error;
    }
}

// 生成指定日期范围内的考勤记录
async function generateAttendanceRecords(pool, startDate, endDate) {
    const connection = await pool.getConnection();
    let recordsGenerated = 0;

    try {
        await connection.beginTransaction();

        // 遍历日期范围
        const currentDate = new Date(startDate);
        while (currentDate <= endDate && recordsGenerated < TOTAL_RECORDS) {
            // 跳过周末
            if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
                // 每天生成多条记录
                const dailyRecords = Math.min(
                    Math.floor(gaussianRandom(20, 5)), // 平均每天20条记录，标准差5
                    TOTAL_RECORDS - recordsGenerated
                );

                for (let i = 0; i < dailyRecords; i++) {
                    await generateAttendanceRecord(connection, currentDate);
                    recordsGenerated++;

                    if (recordsGenerated % BATCH_SIZE === 0) {
                        await connection.commit();
                        await connection.beginTransaction();
                        console.log(`Generated ${recordsGenerated} records (${Math.floor(recordsGenerated/TOTAL_RECORDS*100)}%)...`);
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        await connection.commit();
        console.log(`Completed! Total ${recordsGenerated} attendance records generated.`);

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
        console.log('Starting attendance records generation...');
        console.log(`Target: ${TOTAL_RECORDS} records`);
        console.log(`Batch size: ${BATCH_SIZE}`);

        pool = mysql.createPool(dbConfig);

        // 生成最近30天的考勤记录
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        await generateAttendanceRecords(pool, startDate, endDate);

        console.log('Data generation completed successfully!');
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
