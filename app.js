const express = require('express');
const bodyParser = require('body-parser');
const userRoutes = require('./routes/user');

const app = express();

// 中间件
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

//路由
app.use('/api/user', userRoutes);
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
