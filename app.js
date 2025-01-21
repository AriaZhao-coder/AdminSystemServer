const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/authRoutes');

const app = express();
const port = 3000;

// 中间件：解析 JSON 请求体
app.use(bodyParser.json());

// 处理根路由
app.get('/', (req, res) => {
  res.send('Welcome to the API');
});

// 使用路由
app.use('/api/auth', authRoutes);

// 启动服务器
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});


