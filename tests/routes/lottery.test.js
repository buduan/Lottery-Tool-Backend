const request = require('supertest');
const { Activity, Prize, LotteryCode, LotteryRecord } = require('../../src/models');
const TestUtils = require('../helpers/testUtils');

// 模拟app模块
jest.mock('../../src/app', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/lottery', require('../../src/routes/lottery'));
  return app;
});

const app = require('../../src/app');

describe('抽奖模块测试', () => {
  let authToken;
  let testActivity;
  let testPrize;
  let testLotteryCode;

  beforeAll(async () => {
    // 创建测试用户并获取token
    await TestUtils.createTestUser({
      username: 'testadmin',
      email: 'testadmin@example.com',
      password: 'password123',
      role: 'super_admin'
    });

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'testadmin',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;

    // 创建测试活动
    testActivity = await Activity.create({
      name: '测试抽奖活动',
      description: '这是一个测试活动',
      status: 'active',
      lottery_mode: 'online',
      start_time: new Date(),
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      settings: {
        max_lottery_codes: 100,
        lottery_code_format: '8_digit_number',
        allow_duplicate_phone: false
      }
    });

    // 创建测试奖品
    testPrize = await Prize.create({
      activity_id: testActivity.id,
      name: '一等奖',
      description: 'iPhone 15 Pro',
      total_quantity: 1,
      remaining_quantity: 1,
      probability: 0.1,
      sort_order: 1
    });

    // 创建测试抽奖码
    testLotteryCode = await LotteryCode.create({
      activity_id: testActivity.id,
      code: '12345678',
      status: 'unused',
      participant_info: {
        name: '张三',
        phone: '13800138000',
        email: 'zhangsan@example.com'
      }
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await LotteryRecord.destroy({ where: { activity_id: testActivity.id } });
    await LotteryCode.destroy({ where: { activity_id: testActivity.id } });
    await Prize.destroy({ where: { activity_id: testActivity.id } });
    await Activity.destroy({ where: { id: testActivity.id } });
    await TestUtils.cleanupTestUser('testadmin');
  });

  describe('GET /api/lottery/activities/:id', () => {
    it('应该返回活动公开信息', async () => {
      const response = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activity');
      expect(response.body.data).toHaveProperty('prizes');
      expect(response.body.data.activity.id).toBe(testActivity.id);
      expect(response.body.data.activity.name).toBe(testActivity.name);
    });

    it('应该处理不存在的活动', async () => {
      const response = await request(app)
        .get('/api/lottery/activities/99999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('应该处理已结束的活动', async () => {
      // 创建一个已结束的活动
      const endedActivity = await Activity.create({
        name: '已结束的活动',
        description: '测试',
        status: 'ended',
        lottery_mode: 'online',
        start_time: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        end_time: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        settings: {
          max_lottery_codes: 100,
          lottery_code_format: '8_digit_number',
          allow_duplicate_phone: false
        }
      });

      const response = await request(app)
        .get(`/api/lottery/activities/${endedActivity.id}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activity.status).toBe('ended');

      // 清理
      await Activity.destroy({ where: { id: endedActivity.id } });
    });
  });

  describe('POST /api/lottery/activities/:id/draw', () => {
    it('应该成功进行线上抽奖', async () => {
      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/draw`)
        .send({
          lottery_code: testLotteryCode.code
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('is_winner');
      expect(response.body.data).toHaveProperty('lottery_record');
      expect(response.body.data).toHaveProperty('lottery_code');
      expect(typeof response.body.data.is_winner).toBe('boolean');
    });

    it('应该拒绝无效的抽奖码', async () => {
      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/draw`)
        .send({
          lottery_code: 'invalid-code'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('BUSINESS_001');
    });

    it('应该拒绝已使用的抽奖码', async () => {
      // 先使用一次抽奖码
      await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/draw`)
        .send({
          lottery_code: '87654321'
        });

      // 再次使用同一个抽奖码
      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/draw`)
        .send({
          lottery_code: '87654321'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该验证必需的字段', async () => {
      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/draw`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/lottery/activities/:id/offline-draw', () => {
    it('管理员应该能够进行线下抽奖', async () => {
      // 创建新的抽奖码用于线下抽奖
      const offlineCode = await LotteryCode.create({
        activity_id: testActivity.id,
        code: '87654321',
        status: 'unused',
        participant_info: {
          name: '李四',
          phone: '13900139000',
          email: 'lisi@example.com'
        }
      });

      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/offline-draw`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lottery_code: offlineCode.code,
          prize_id: testPrize.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('is_winner');
      expect(response.body.data).toHaveProperty('prize');
      expect(response.body.data.prize.id).toBe(testPrize.id);
    });

    it('应该拒绝无效的奖品ID', async () => {
      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/offline-draw`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          lottery_code: '12345678',
          prize_id: 99999
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该验证管理员权限', async () => {
      const response = await request(app)
        .post(`/api/lottery/activities/${testActivity.id}/offline-draw`)
        .send({
          lottery_code: '12345678',
          prize_id: testPrize.id
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/lottery/activities/:id/records', () => {
    it('应该返回抽奖记录列表', async () => {
      const response = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/records`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('records');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.records)).toBe(true);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/records?page=1&limit=5`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('应该支持仅显示中奖记录', async () => {
      const response = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/records?winner_only=true`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/lottery/activities/:id/statistics', () => {
    it('应该返回抽奖统计信息', async () => {
      const response = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/statistics`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('statistics');
      expect(response.body.data.statistics).toHaveProperty('total_lottery_codes');
      expect(response.body.data.statistics).toHaveProperty('total_lottery_records');
      expect(response.body.data.statistics).toHaveProperty('total_winners');
      expect(response.body.data.statistics).toHaveProperty('win_rate');
    });

    it('应该验证管理员权限', async () => {
      const response = await request(app)
        .get(`/api/lottery/activities/${testActivity.id}/statistics`);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
}); 