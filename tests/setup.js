// Jest测试全局设置
require('dotenv').config();

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'lottery_system_test';
process.env.JWT_SECRET = 'test-secret-key';

// 全局测试超时设置
jest.setTimeout(30000);

// 清理控制台输出
beforeEach(() => {
  jest.clearAllMocks();
});

// 全局错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// 模拟数据库连接
jest.mock('../src/config/database', () => ({
  sequelize: {
    authenticate: jest.fn().mockResolvedValue(true),
    close: jest.fn().mockResolvedValue(true),
    sync: jest.fn().mockResolvedValue(true)
  }
})); 