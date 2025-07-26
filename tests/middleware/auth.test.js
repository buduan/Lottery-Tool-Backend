const jwt = require('jsonwebtoken');
const auth = require('../../src/middleware/auth');
const TestUtils = require('../helpers/testUtils');

// 模拟Express请求和响应对象
const createMockRequest = (headers = {}) => ({
  headers,
  get: (name) => headers[name]
});

const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = () => jest.fn();

describe('认证中间件测试', () => {
  let testUser;
  let validToken;

  beforeAll(async () => {
    // 创建测试用户
    testUser = await TestUtils.createTestUser({
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password123',
      role: 'admin'
    });

    // 生成有效token
    validToken = TestUtils.generateTestToken(testUser.id, testUser.role);
  });

  afterAll(async () => {
    await TestUtils.cleanupTestUser('testuser');
  });

  describe('authenticateToken', () => {
    it('应该验证有效的JWT token', () => {
      const req = createMockRequest({
        'authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
      expect(req.user.role).toBe(testUser.role);
    });

    it('应该处理缺少Authorization头的请求', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      auth.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '访问令牌缺失'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理无效的token格式', () => {
      const req = createMockRequest({
        'authorization': 'InvalidFormat token123'
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '访问令牌格式错误'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理无效的JWT token', () => {
      const req = createMockRequest({
        'authorization': 'Bearer invalid.token.here'
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.authenticateToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '访问令牌无效'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该处理过期的JWT token', () => {
      // 生成一个过期的token
      const expiredToken = jwt.sign(
        { id: testUser.id, role: testUser.role },
        process.env.JWT_SECRET || 'test-secret-key',
        { expiresIn: '0s' }
      );

      const req = createMockRequest({
        'authorization': `Bearer ${expiredToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 等待token过期
      setTimeout(() => {
        auth.authenticateToken(req, res, next);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: {
            code: 'AUTH_002',
            message: '访问令牌已过期'
          }
        });
        expect(next).not.toHaveBeenCalled();
      }, 1000);
    });

    it('应该处理不同大小写的Authorization头', () => {
      const req = createMockRequest({
        'Authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.authenticateToken(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
    });
  });

  describe('requireAuth', () => {
    it('应该允许已认证的请求通过', () => {
      const req = createMockRequest({
        'authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 先设置用户信息
      auth.authenticateToken(req, res, next);
      
      const requireAuthNext = createMockNext();
      auth.requireAuth(req, res, requireAuthNext);

      expect(requireAuthNext).toHaveBeenCalled();
    });

    it('应该拒绝未认证的请求', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '需要登录'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole', () => {
    it('应该允许具有正确角色的用户访问', () => {
      const req = createMockRequest({
        'authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 先设置用户信息
      auth.authenticateToken(req, res, next);
      
      const requireRoleNext = createMockNext();
      auth.requireRole(['admin', 'super_admin'])(req, res, requireRoleNext);

      expect(requireRoleNext).toHaveBeenCalled();
    });

    it('应该拒绝权限不足的用户', () => {
      // 创建一个普通用户token
      const userToken = TestUtils.generateTestToken(testUser.id, 'participant');
      
      const req = createMockRequest({
        'authorization': `Bearer ${userToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 先设置用户信息
      auth.authenticateToken(req, res, next);
      
      const requireRoleNext = createMockNext();
      auth.requireRole(['admin', 'super_admin'])(req, res, requireRoleNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '权限不足'
        }
      });
      expect(requireRoleNext).not.toHaveBeenCalled();
    });

    it('应该处理未认证的请求', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireRole(['admin'])(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '需要登录'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('应该支持单个角色参数', () => {
      const req = createMockRequest({
        'authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 先设置用户信息
      auth.authenticateToken(req, res, next);
      
      const requireRoleNext = createMockNext();
      auth.requireRole('admin')(req, res, requireRoleNext);

      expect(requireRoleNext).toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('应该允许超级管理员访问', () => {
      // 创建超级管理员token
      const superAdminToken = TestUtils.generateTestToken(testUser.id, 'super_admin');
      
      const req = createMockRequest({
        'authorization': `Bearer ${superAdminToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 先设置用户信息
      auth.authenticateToken(req, res, next);
      
      const requireSuperAdminNext = createMockNext();
      auth.requireSuperAdmin(req, res, requireSuperAdminNext);

      expect(requireSuperAdminNext).toHaveBeenCalled();
    });

    it('应该拒绝普通管理员访问', () => {
      const req = createMockRequest({
        'authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      // 先设置用户信息
      auth.authenticateToken(req, res, next);
      
      const requireSuperAdminNext = createMockNext();
      auth.requireSuperAdmin(req, res, requireSuperAdminNext);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '需要超级管理员权限'
        }
      });
      expect(requireSuperAdminNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('应该允许有token的请求通过并设置用户信息', () => {
      const req = createMockRequest({
        'authorization': `Bearer ${validToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(testUser.id);
    });

    it('应该允许没有token的请求通过但不设置用户信息', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('应该处理无效token但不阻止请求', () => {
      const req = createMockRequest({
        'authorization': 'Bearer invalid.token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
}); 