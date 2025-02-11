const mysql = require('mysql2/promise');

// 数据库配置
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '123456',
    database: 'myapp'
};

// 批处理大小
const BATCH_SIZE = 50;

// 常用中国姓氏
const SURNAMES = [
    '王', '李', '张', '刘', '陈', '杨', '黄', '吴', '赵', '周',
    '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗'
];

// 常用字
const NAME_CHARS = {
    '男': ['伟', '强', '勇', '军', '华', '明', '建', '峰', '毅', '龙',
        '海', '波', '鹏', '昊', '然', '浩', '天', '晨', '阳', '文'],
    '女': ['芳', '娟', '敏', '静', '丽', '艳', '霞', '燕', '娜', '玲',
        '华', '雪', '倩', '婷', '萍', '琳', '佳', '莉', '晶', '雅']
};

function generateChineseName(gender) {
    const surname = SURNAMES[Math.floor(Math.random() * SURNAMES.length)];
    const nameChars = NAME_CHARS[gender];

    const useDoubleName = Math.random() < 0.7;

    if (useDoubleName) {
        const firstName = nameChars[Math.floor(Math.random() * nameChars.length)];
        let secondName;
        do {
            secondName = nameChars[Math.floor(Math.random() * nameChars.length)];
        } while (secondName === firstName);

        return surname + firstName + secondName;
    } else {
        return surname + nameChars[Math.floor(Math.random() * nameChars.length)];
    }
}

async function updateEmployeeNames() {
    const connection = await mysql.createConnection(dbConfig);
    try {
        // 获取所有员工ID和性别
        const [employees] = await connection.execute(
            'SELECT id, gender FROM employee_profiles ORDER BY id'
        );

        const totalEmployees = employees.length;
        console.log(`Total employees to update: ${totalEmployees}`);

        // 分批处理
        for(let i = 0; i < employees.length; i += BATCH_SIZE) {
            const batch = employees.slice(i, i + BATCH_SIZE);

            // 开始事务
            await connection.beginTransaction();
            try {
                for (const employee of batch) {
                    const newName = generateChineseName(employee.gender);
                    await connection.execute(
                        'UPDATE employee_profiles SET real_name = ? WHERE id = ?',
                        [newName, employee.id]
                    );
                }
                await connection.commit();

                console.log(`Progress: ${Math.min(i + BATCH_SIZE, totalEmployees)}/${totalEmployees} (${Math.round((Math.min(i + BATCH_SIZE, totalEmployees))/totalEmployees*100)}%)`);
            } catch (error) {
                await connection.rollback();
                throw error;
            }
        }

        console.log('Name update completed successfully!');
    } catch (error) {
        console.error('Error updating names:', error);
        throw error;
    } finally {
        await connection.end();
    }
}

// 运行更新
updateEmployeeNames()
    .then(() => console.log('Update completed successfully!'))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
