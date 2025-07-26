const request = require('supertest');
const { Activity, Prize, LotteryCode } = require('../../../src/models');
const TestUtils = require('../../helpers/testUtils');

// 模拟app模块
jest.mock('../../../src/app', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/admin', require('../../../src/routes/admin'));
  return app;
});

const app = require('../../../src/app');

describe('活动管理测试', () => {
  let authToken;
  let testActivity;
  let testPrize;

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
  });

  afterAll(async () => {
    // 清理测试数据
    if (testActivity) {
      await Activity.destroy({ where: { id: testActivity.id } });
    }
    await TestUtils.cleanupTestUser('testadmin');
  });

  describe('POST /api/admin/activities', () => {
    it('应该成功创建活动', async () => {
      const activityData = {
        name: '测试抽奖活动',
        description: '这是一个测试活动',
        lottery_mode: 'online',
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        settings: {
          max_lottery_codes: 100,
          lottery_code_format: '8_digit_number',
          allow_duplicate_phone: false
        }
      };

      const response = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${authToken}`)
        .send(activityData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activity.name).toBe(activityData.name);
      expect(response.body.data.activity.status).toBe('draft');

      testActivity = response.body.data.activity;
    });

    it('应该验证必需的字段', async () => {
      const response = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '不完整的活动'
          // 缺少其他必需字段
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该验证日期格式', async () => {
      const response = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '日期错误的活动',
          description: '测试',
          lottery_mode: 'online',
          start_time: 'invalid-date',
          end_time: 'invalid-date'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/activities', () => {
    it('应该返回活动列表', async () => {
      const response = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activities');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.activities)).toBe(true);
    });

    it('应该支持分页查询', async () => {
      const response = await request(app)
        .get('/api/admin/activities?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(5);
    });

    it('应该支持状态过滤', async () => {
      const response = await request(app)
        .get('/api/admin/activities?status=draft')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/admin/activities/:id', () => {
    it('应该返回活动详情', async () => {
      const response = await request(app)
        .get(`/api/admin/activities/${testActivity.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activity.id).toBe(testActivity.id);
      expect(response.body.data.activity.name).toBe(testActivity.name);
    });

    it('应该处理不存在的活动', async () => {
      const response = await request(app)
        .get('/api/admin/activities/99999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/activities/:id', () => {
    it('应该成功更新活动', async () => {
      const updateData = {
        name: '更新后的活动名称',
        description: '更新后的描述',
        status: 'active'
      };

      const response = await request(app)
        .put(`/api/admin/activities/${testActivity.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.activity.name).toBe(updateData.name);
      expect(response.body.data.activity.status).toBe(updateData.status);
    });

    it('应该验证更新数据', async () => {
      const response = await request(app)
        .put(`/api/admin/activities/${testActivity.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '' // 空名称
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/activities/:id/prizes', () => {
    it('应该成功添加奖品', async () => {
      const prizeData = {
        name: '一等奖',
        description: 'iPhone 15 Pro',
        total_quantity: 1,
        probability: 0.1,
        sort_order: 1
      };

      const response = await request(app)
        .post(`/api/admin/activities/${testActivity.id}/prizes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(prizeData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.prize.name).toBe(prizeData.name);
      expect(response.body.data.prize.remaining_quantity).toBe(prizeData.total_quantity);

      testPrize = response.body.data.prize;
    });

    it('应该验证奖品数据', async () => {
      const response = await request(app)
        .post(`/api/admin/activities/${testActivity.id}/prizes`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '无效奖品',
          probability: 1.5 // 概率超过100%
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/activities/:id/prizes', () => {
    it('应该返回活动奖品列表', async () => {
      const response = await request(app)
        .get(`/api/admin/activities/${testActivity.id}/prizes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('prizes');
      expect(Array.isArray(response.body.data.prizes)).toBe(true);
    });
  });

  describe('POST /api/admin/activities/:id/lottery-codes/batch', () => {
    it('应该成功批量创建抽奖码', async () => {
      const response = await request(app)
        .post(`/api/admin/activities/${testActivity.id}/lottery-codes/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          count: 10
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.created_count).toBe(10);
      expect(response.body.data.lottery_codes).toHaveLength(10);
    });

    it('应该验证创建数量', async () => {
      const response = await request(app)
        .post(`/api/admin/activities/${testActivity.id}/lottery-codes/batch`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          count: 0 // 无效数量
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/admin/activities/:id/lottery-codes', () => {
    it('应该返回抽奖码列表', async () => {
      const response = await request(app)
        .get(`/api/admin/activities/${testActivity.id}/lottery-codes`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lottery_codes');
      expect(response.body.data).toHaveProperty('pagination');
    });

    it('应该支持状态过滤', async () => {
      const response = await request(app)
        .get(`/api/admin/activities/${testActivity.id}/lottery-codes?status=unused`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/activities/:id', () => {
    it('应该成功删除活动', async () => {
      // 先将活动状态改为draft
      await request(app)
        .put(`/api/admin/activities/${testActivity.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'draft' });

      const response = await request(app)
        .delete(`/api/admin/activities/${testActivity.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('活动删除成功');

      testActivity = null; // 标记已删除
    });
  });
}); 