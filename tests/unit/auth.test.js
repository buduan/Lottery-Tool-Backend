const jwt = require('jsonwebtoken');

// 模拟认证中间件
const auth = {
  authenticateToken: (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '访问令牌缺失'
        }
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '访问令牌格式错误'
        }
      });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key', (err, user) => {
      if (err) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_002',
            message: err.name === 'TokenExpiredError' ? '访问令牌已过期' : '访问令牌无效'
          }
        });
      }

      req.user = user;
      next();
    });
  },

  requireAuth: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '需要登录'
        }
      });
    }
    next();
  },

  requireRole: (roles) => {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_002',
            message: '需要登录'
          }
        });
      }

      const userRole = req.user.role;
      const allowedRoles = Array.isArray(roles) ? roles : [roles];

      if (!allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_003',
            message: '权限不足'
          }
        });
      }

      next();
    };
  },

  requireSuperAdmin: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_002',
          message: '需要登录'
        }
      });
    }

    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '需要超级管理员权限'
        }
      });
    }

    next();
  },

  optionalAuth: (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (token && authHeader.startsWith('Bearer ')) {
      jwt.verify(token, process.env.JWT_SECRET || 'test-secret-key', (err, user) => {
        if (!err) {
          req.user = user;
        }
        next();
      });
    } else {
      next();
    }
  }
};

// 模拟Express请求和响应对象
const createMockRequest = (headers = {}, user = null) => ({
  headers,
  user,
  get: (name) => headers[name]
});

const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const createMockNext = () => jest.fn();

describe('认证中间件单元测试', () => {
  let validToken;
  let expiredToken;
  let invalidToken;

  beforeAll(() => {
    // 生成有效token
    validToken = jwt.sign(
      { id: 1, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret-key',
      { expiresIn: '1h' }
    );

    // 生成过期token
    expiredToken = jwt.sign(
      { id: 1, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret-key',
      { expiresIn: '0s' }
    );

    // 无效token
    invalidToken = 'invalid.token.here';
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
      expect(req.user.id).toBe(1);
      expect(req.user.role).toBe('admin');
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
        'authorization': `Bearer ${invalidToken}`
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
      const req = createMockRequest({
        'authorization': `Bearer ${expiredToken}`
      });
      const res = createMockResponse();
      const next = createMockNext();

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
    });
  });

  describe('requireAuth', () => {
    it('应该允许已认证的请求通过', () => {
      const req = createMockRequest({}, { id: 1, role: 'admin' });
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
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
      const req = createMockRequest({}, { id: 1, role: 'admin' });
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireRole(['admin', 'super_admin'])(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('应该拒绝权限不足的用户', () => {
      const req = createMockRequest({}, { id: 1, role: 'participant' });
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireRole(['admin', 'super_admin'])(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '权限不足'
        }
      });
      expect(next).not.toHaveBeenCalled();
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
      const req = createMockRequest({}, { id: 1, role: 'admin' });
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireRole('admin')(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('应该允许超级管理员访问', () => {
      const req = createMockRequest({}, { id: 1, role: 'super_admin' });
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireSuperAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('应该拒绝普通管理员访问', () => {
      const req = createMockRequest({}, { id: 1, role: 'admin' });
      const res = createMockResponse();
      const next = createMockNext();

      auth.requireSuperAdmin(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_003',
          message: '需要超级管理员权限'
        }
      });
      expect(next).not.toHaveBeenCalled();
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
      expect(req.user.id).toBe(1);
    });

    it('应该允许没有token的请求通过但不设置用户信息', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = createMockNext();

      auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });

    it('应该处理无效token但不阻止请求', () => {
      const req = createMockRequest({
        'authorization': 'Bearer invalid.token'
      });
      const res = createMockResponse();
      const next = createMockNext();

      auth.optionalAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeNull();
    });
  });
}); 