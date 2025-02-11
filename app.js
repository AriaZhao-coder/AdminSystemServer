const express = require('express');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const attendanceRoutes = require('./routes/attendance');
const staffRoutes = require('./routes/staff');
const avatarRoutes = require('./routes/avatar');
const path = require('path');
const cors = require('cors');
const app = express();


app.use(cors({
    origin: 'http://localhost:8000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//路由
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/avatar', avatarRoutes);

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        code: 500,
        message: '服务器内部错误',
        data: null
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
