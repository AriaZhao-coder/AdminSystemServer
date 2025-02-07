
创建 User 表
```sql
CREATE DATABASE myapp;
USE myapp;

CREATE TABLE users (
                       id INT PRIMARY KEY AUTO_INCREMENT,
                       user_name VARCHAR(50) UNIQUE NOT NULL,
                       password VARCHAR(255) NOT NULL,
                       mobile VARCHAR(11) NOT NULL,
                       role ENUM('Admin', 'User') DEFAULT 'User',
                       company_id VARCHAR(50) NOT NULL,
                       create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                       last_login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE verification_codes (
                                    id INT PRIMARY KEY AUTO_INCREMENT,
                                    mobile VARCHAR(11) NOT NULL,
                                    code VARCHAR(6) NOT NULL,
                                    type TINYINT NOT NULL COMMENT '1:注册，2:登录，3:重置密码',
                                    expire_time TIMESTAMP NOT NULL,
                                    create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 部门表
CREATE TABLE departments (
                             id INT PRIMARY KEY AUTO_INCREMENT,
                             dept_name VARCHAR(50) NOT NULL,
                             parent_id INT DEFAULT NULL,
                             dept_level INT NOT NULL COMMENT '部门层级',
                             create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                             update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                             FOREIGN KEY (parent_id) REFERENCES departments(id),
                             UNIQUE KEY uk_dept_name (dept_name)
);

-- 员工信息表
CREATE TABLE employee_profiles (
                                   id INT PRIMARY KEY AUTO_INCREMENT,
                                   user_id INT NOT NULL,
                                   dept_id INT NOT NULL,
                                   id_number VARCHAR(18) NOT NULL COMMENT '身份证号',
                                   education ENUM('小学', '初中', '中专', '大专', '本科', '硕士') NOT NULL,
                                   gender ENUM('男', '女') NOT NULL,
                                   birth_date DATE NOT NULL,
                                   join_date DATE NOT NULL,
                                   create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                                   update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                   FOREIGN KEY (user_id) REFERENCES users(id),
                                   FOREIGN KEY (dept_id) REFERENCES departments(id),
                                   UNIQUE KEY uk_id_number (id_number)
);

INSERT INTO departments (dept_name, parent_id, dept_level) VALUES
                                                               ('总裁办', NULL, 1),
                                                               ('技术部', NULL, 1),
                                                               ('产品部', NULL, 1),
                                                               ('运营部', NULL, 1);
                                                               ('人力资源部', NULL, 1),
                                                               ('财务部', NULL, 1),
                                                               ('后端开发组', 2, 2),
                                                               ('前端开发组', 2, 2),
                                                               ('移动开发组', 2, 2),
                                                               ('测试组', 2, 2),
                                                               ('运维组', 2, 2),
                                                               ('UI设计组', 3, 2),
                                                               ('产品经理组', 3, 2),
                                                               ('市场营销组', 4, 2),
                                                               ('内容运营组', 4, 2),
                                                               ('客户服务组', 4, 2);
```
