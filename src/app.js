const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
require('dotenv').config();

const { sequelize } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');

// 检查是否在Docker环境中
const isDockerEnvironment = () => {
  return process.env.DOCKER_ENV === 'true' || 
         process.env.NODE_ENV === 'production' ||
         fs.existsSync('/.dockerenv');
};

// 自动安装系统
const autoInstallSystem = () => {
  return new Promise((resolve, reject) => {
    console.log('\n=== 检测到系统未安装，正在启动自动安装流程 ===\n');
    
    // 使用spawn运行安装脚本
    const installProcess = spawn('node', ['scripts/install.js'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit' // 继承父进程的stdio，这样可以看到安装过程的交互
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        console.log('\n=== 自动安装完成 ===\n');
        resolve();
      } else {
        reject(new Error(`安装进程退出，退出码: ${code}`));
      }
    });
    
    installProcess.on('error', (error) => {
      reject(new Error(`安装进程启动失败: ${error.message}`));
    });
  });
};

// 检查系统是否已安装，如果未安装则自动安装
const checkAndInstallSystem = async () => {
  // 在Docker环境中跳过自动安装
  if (isDockerEnvironment()) {
    console.log('\n=== Docker环境检测到，跳过自动安装 ===\n');
    console.log('请确保系统已正确配置，包括：');
    console.log('1. 数据库连接配置');
    console.log('2. 系统配置文件 (config/system.json)');
    console.log('3. 环境变量设置');
    console.log('=====================================\n');
    return;
  }

  const configPath = path.join(__dirname, '../config/system.json');
  
  // 检查配置文件是否存在
  if (!fs.existsSync(configPath)) {
    console.log('\n=== 抽奖系统首次启动 ===');
    console.log('系统配置文件不存在，将自动进入安装流程...');
    console.log('========================\n');
    
    try {
      await autoInstallSystem();
      // 安装完成后重新检查
      return checkAndInstallSystem();
    } catch (error) {
      console.error('自动安装失败:', error.message);
      console.log('\n请手动运行安装脚本：npm run install-system');
      process.exit(1);
    }
  }
  
  // 检查安装状态
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!config.installed) {
      console.log('\n=== 系统未完成安装 ===');
      console.log('检测到安装未完成，将自动重新安装...');
      console.log('===================\n');
      
      try {
        await autoInstallSystem();
        // 安装完成后重新检查
        return checkAndInstallSystem();
      } catch (error) {
        console.error('自动安装失败:', error.message);
        console.log('\n请手动运行安装脚本：npm run install-system');
        process.exit(1);
      }
    }
    
    console.log('\n=== 系统已安装，正在启动服务 ===\n');
  } catch (error) {
    console.error('读取系统配置文件失败:', error.message);
    console.log('配置文件可能损坏，将重新安装...');
    
    try {
      await autoInstallSystem();
      // 安装完成后重新检查
      return checkAndInstallSystem();
    } catch (installError) {
      console.error('自动安装失败:', installError.message);
      console.log('\n请手动运行安装脚本：npm run install-system');
      process.exit(1);
    }
  }
};

const createApp = async () => {
  // 检查安装状态，如果未安装则自动安装
  await checkAndInstallSystem();
  
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
    console.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
  });
  
  // 数据库连接
  try {
    await sequelize.authenticate();
    console.info('数据库连接成功');
    
    // 导入模型关联
    require('./models');
  } catch (error) {
    console.error('数据库连接失败:', error);
    // 在Docker环境中，如果数据库连接失败，不要立即退出
    if (isDockerEnvironment()) {
      console.log('数据库连接失败，但应用将继续启动...');
      console.log('请检查数据库配置和环境变量');
    } else {
      process.exit(1);
    }
  }
  
  // 路由
  app.use('/auth', require('./routes/auth'));
  app.use('/admin', require('./routes/admin'));
  app.use('/lottery', require('./routes/lottery'));
  app.use('/lottery-codes', require('./routes/lotteryCode'));
  app.use('/webhook', require('./routes/webhook'));
  app.use('/system', require('./routes/system'));
  
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
  app.listen(PORT, '0.0.0.0', () => {
    console.info(`服务器已启动，端口: ${PORT}`);
    console.info(`健康检查: http://localhost:${PORT}/health`);
  });
};

// 启动应用
createApp().catch(error => {
  console.error('应用启动失败:', error);
  process.exit(1);
});

module.exports = createApp;