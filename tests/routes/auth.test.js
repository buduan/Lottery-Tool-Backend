const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../../src/models');
const TestUtils = require('../helpers/testUtils');

// 模拟app模块
jest.mock('../../src/app', () => {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../../src/routes/auth'));
  return app;
});

const app = require('../../src/app');

describe('认证模块测试', () => {
  let testUser;
  let authToken;

  beforeAll(async () => {
    // 创建测试用户
    testUser = await TestUtils.createTestUser({
      username: 'testadmin',
      email: 'testadmin@example.com',
      password: 'password123',
      role: 'super_admin'
    });
  });

  afterAll(async () => {
    // 清理测试数据
    await TestUtils.cleanupTestUser('testadmin');
  });

  describe('POST /api/auth/login', () => {
    it('应该成功登录并返回token', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.username).toBe('testadmin');
      expect(response.body.data.user.role).toBe('super_admin');

      authToken = response.body.data.token;
    });

    it('应该拒绝错误的用户名', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'wronguser',
          password: 'password123'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('应该拒绝错误的密码', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_001');
    });

    it('应该验证必需的字段', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testadmin'
          // 缺少password
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('应该返回当前用户信息', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('testadmin');
      expect(response.body.data.user.role).toBe('super_admin');
    });

    it('应该拒绝无效的token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH_002');
    });

    it('应该拒绝缺少token的请求', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/password', () => {
    it('应该成功修改密码', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          old_password: 'password123',
          new_password: 'newpassword123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('密码修改成功');
    });

    it('应该拒绝错误的旧密码', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          old_password: 'wrongpassword',
          new_password: 'newpassword123'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该验证新密码格式', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          old_password: 'password123',
          new_password: '123' // 密码太短
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('超级管理员应该能够创建新用户', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'newuser',
          email: 'newuser@example.com',
          password: 'password123',
          role: 'admin'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.username).toBe('newuser');
      expect(response.body.data.user.role).toBe('admin');

      // 清理测试用户
      await TestUtils.cleanupTestUser('newuser');
    });

    it('应该拒绝重复的用户名', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'testadmin', // 已存在的用户名
          email: 'duplicate@example.com',
          password: 'password123',
          role: 'admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('应该验证必需的字段', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          username: 'incomplete',
          // 缺少其他必需字段
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('应该成功登出', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('登出成功');
    });
  });
}); 