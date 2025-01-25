
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
```
