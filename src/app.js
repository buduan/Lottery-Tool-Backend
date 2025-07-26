const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logger = require('./utils/logger');
const { sequelize } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// 检查系统是否已安装
const checkSystemInstalled = () => {
  const configPath = path.join(__dirname, '../config/system.json');
  if (!fs.existsSync(configPath)) {
    console.log('\n=== 抽奖系统首次启动 ===');
    console.log('请先运行安装脚本：npm run install-system');
    console.log('========================\n');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.installed) {
    console.log('\n=== 系统未完成安装 ===');
    console.log('请运行安装脚本：npm run install-system');
    console.log('===================\n');
    process.exit(1);
  }
};

const createApp = async () => {
  // 检查安装状态
  checkSystemInstalled();
  
  const app = express();
  
  // 安全中间件
  app.use(helmet());
  app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
  }));
  
  // 限流中间件
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 1000, // 每个IP最多1000次请求
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '请求频率过高，请稍后再试'
      }
    }
  });
  app.use('/api', limiter);
  
  // 解析中间件
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  
  // 日志中间件
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
  });
  
  // 数据库连接
  try {
    await sequelize.authenticate();
    logger.info('数据库连接成功');
    
    // 导入模型关联
    require('./models');
  } catch (error) {
    logger.error('数据库连接失败:', error);
    process.exit(1);
  }
  
  // 路由
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/lottery', require('./routes/lottery'));
  app.use('/api/lottery-codes', require('./routes/lotteryCode'));
  app.use('/api/webhook', require('./routes/webhook'));
  app.use('/api/system', require('./routes/system'));
  
  // 健康检查
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: require('../package.json').version
      }
    });
  });
  
  // 404处理
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '请求的资源不存在'
      }
    });
  });
  
  // 错误处理中间件
  app.use(errorHandler);
  
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    logger.info(`服务器已启动，端口: ${PORT}`);
    logger.info(`API文档: http://localhost:${PORT}/api`);
    logger.info(`健康检查: http://localhost:${PORT}/health`);
  });
};

// 启动应用
createApp().catch(error => {
  logger.error('应用启动失败:', error);
  process.exit(1);
});

module.exports = createApp; 