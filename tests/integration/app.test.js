const request = require('supertest');
const { sequelize } = require('../../src/config/database');
const TestUtils = require('../helpers/testUtils');

// 创建测试应用实例
let app;

beforeAll(async () => {
  // 确保数据库连接
  await sequelize.authenticate();
  
  // 导入模型关联
  require('../../src/models');
  
  // 创建应用实例
  const express = require('express');
  app = express();
  app.use(express.json());
  
  // 添加中间件
  app.use(require('../../src/middleware/errorHandler'));
  
  // 添加路由
  app.use('/api/auth', require('../../src/routes/auth'));
  app.use('/api/admin', require('../../src/routes/admin'));
  app.use('/api/lottery', require('../../src/routes/lottery'));
  app.use('/api/lottery-codes', require('../../src/routes/lotteryCode'));
  app.use('/api/system', require('../../src/routes/system'));
  
  // 健康检查端点
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      }
    });
  });
});

afterAll(async () => {
  // 关闭数据库连接
  await sequelize.close();
});

describe('应用集成测试', () => {
  let authToken;
  let testActivity;
  let testPrize;
  let testLotteryCode;

  beforeAll(async () => {
    // 创建测试用户并登录
    await TestUtils.createTestUser({
      username: 'integrationtest',
      email: 'integrationtest@example.com',
      password: 'password123',
      role: 'super_admin'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'integrationtest',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    // 清理测试数据
    if (testActivity) {
      await request(app)
        .delete(`/api/admin/activities/${testActivity.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    }
    await TestUtils.cleanupTestUser('integrationtest');
  });

  describe('健康检查', () => {
    it('应该返回健康状态', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
    });
  });

  describe('完整的抽奖流程', () => {
    it('应该完成完整的抽奖流程', async () => {
      // 1. 创建活动
      const activityResponse = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '集成测试活动',
          description: '这是一个集成测试活动',
          lottery_mode: 'online',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          settings: {
            max_lottery_codes: 100,
            lottery_code_format: '8_digit_number',
            allow_duplicate_phone: false
          }
        });

      expect(activityResponse.status).toBe(201);
      expect(activityResponse.body.success).toBe(true);
      testActivity = activityResponse.body.data.activity;

      // 2. 添加奖品
      const prizeResponse = await request(app)
        .post(`/api/admin/activities/${testActivity.id}/prizes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '一等奖',
          description: 'iPhone 15 Pro',
          total_quantity: 1,
          probability: 0.1,
          sort_order: 1
        });

      expect(prizeResponse.status).toBe(201);
      expect(prizeResponse.body.success).toBe(true);
      testPrize = prizeResponse.body.data.prize;

      // 3. 批量创建抽奖码
      const lotteryCodeResponse = await request(app)
        .post(`/api/admin/activities/${testActivity.id}/lottery-codes/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          count: 10
        });

      expect(lotteryCodeResponse.status).toBe(201);
      expect(lotteryCodeResponse.body.success).toBe(true);
      expect(lotteryCodeResponse.body.data.created_count).toBe(10);
      testLotteryCode = lotteryCodeResponse.body.data.lottery_codes[0];

      // 4. 获取活动公开信息
      const publicInfoResponse = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}`);

      expect(publicInfoResponse.status).toBe(200);
      expect(publicInfoResponse.body.success).toBe(true);
      expect(publicInfoResponse.body.data.activity.id).toBe(testActivity.id);

      // 5. 进行线上抽奖
      const drawResponse = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/draw`)
        .send({
          lottery_code: testLotteryCode.code
        });

      expect(drawResponse.status).toBe(200);
      expect(drawResponse.body.success).toBe(true);
      expect(drawResponse.body.data).toHaveProperty('is_winner');
      expect(drawResponse.body.data).toHaveProperty('lottery_record');

      // 6. 获取抽奖记录
      const recordsResponse = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/records`);

      expect(recordsResponse.status).toBe(200);
      expect(recordsResponse.body.success).toBe(true);
      expect(recordsResponse.body.data.records.length).toBeGreaterThan(0);

      // 7. 获取统计信息
      const statsResponse = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.success).toBe(true);
      expect(statsResponse.body.data.statistics.total_lottery_codes).toBe(10);
      expect(statsResponse.body.data.statistics.total_lottery_records).toBe(1);
    });
  });

  describe('错误处理', () => {
    it('应该处理404错误', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('应该处理无效的JSON', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该处理未认证的请求', async () => {
      const response = await request(app)
        .get('/api/admin/activities');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_002');
    });
  });

  describe('数据验证', () => {
    it('应该验证活动创建参数', async () => {
      const response = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // 空名称
          description: '测试'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该验证抽奖码格式', async () => {
      const response = await request(app)
        .post('/api/lottery/activities/1/draw')
        .send({
          lottery_code: 'invalid' // 无效格式
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('权限控制', () => {
    let normalUserToken;

    beforeAll(async () => {
      // 创建普通用户
      await TestUtils.createTestUser({
        username: 'normaluser',
        email: 'normaluser@example.com',
        password: 'password123',
        role: 'participant'
      });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'normaluser',
          password: 'password123'
        });

      normalUserToken = loginResponse.body.data.token;
    });

    afterAll(async () => {
      await TestUtils.cleanupTestUser('normaluser');
    });

    it('应该拒绝普通用户访问管理接口', async () => {
      const response = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${normalUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_003');
    });

    it('应该允许普通用户访问公开接口', async () => {
      if (testActivity) {
        const response = await request(app)
          .get(`/api/lottery/activities/${testActivity.id}`)
          .set('Authorization', `Bearer ${normalUserToken}`);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('性能测试', () => {
    it('应该能够处理并发请求', async () => {
      const concurrentRequests = 10;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
          request(app).get('/health')
        );
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });

    it('应该能够快速响应健康检查', async () => {
      const startTime = Date.now();
      
      const response = await request(app).get('/health');
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.status).toBe(200);
      expect(responseTime).toBeLessThan(1000); // 1秒内响应
    });
  });
}); 