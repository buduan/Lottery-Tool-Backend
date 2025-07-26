const jwt = require('jsonwebtoken');
const { createError } = require('../utils/customError');
const User = require('../models/User');

/**
 * JWT Token 验证中间件
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      throw createError('AUTH_TOKEN_INVALID', 'Token缺失');
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      throw createError('AUTH_TOKEN_INVALID', '用户不存在');
    }

    if (user.status !== 'active') {
      throw createError('AUTH_ACCOUNT_DISABLED');
    }

    // 将用户信息添加到请求对象
    req.user = user.toSafeJSON();
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(createError('AUTH_TOKEN_INVALID', 'Token格式错误'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(createError('AUTH_TOKEN_INVALID', 'Token已过期'));
    }
    next(error);
  }
};

/**
 * 管理员权限验证中间件
 * 检查用户是否具有管理员权限
 */
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(createError('AUTH_TOKEN_INVALID', '未认证'));
  }

  if (!['admin', 'super_admin'].includes(req.user.role)) {
    return next(createError('AUTH_INSUFFICIENT_PERMISSION', '需要管理员权限'));
  }

  next();
};

/**
 * 超级管理员权限验证中间件
 * 检查用户是否具有超级管理员权限
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(createError('AUTH_TOKEN_INVALID', '未认证'));
  }

  if (req.user.role !== 'super_admin') {
    return next(createError('AUTH_INSUFFICIENT_PERMISSION', '需要超级管理员权限'));
  }

  next();
};

/**
 * 可选认证中间件
 * 如果提供了token则验证，否则继续执行
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(); // 没有token，继续执行
    }

    // 验证token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 查找用户
    const user = await User.findByPk(decoded.userId);
    if (user && user.status === 'active') {
      req.user = user.toSafeJSON();
    }

    next();
  } catch (error) {
    // 可选认证失败不阻止请求继续
    next();
  }
};

/**
 * Webhook认证中间件
 * 验证Webhook请求的token
 */
const authenticateWebhook = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      throw createError('AUTH_TOKEN_INVALID', 'Webhook Token缺失');
    }

    // 从URL参数获取webhook_id
    const webhookId = req.params.webhook_id;
    if (!webhookId) {
      throw createError('VALIDATION_MISSING_PARAMS', 'Webhook ID缺失');
    }

    // 查找对应的活动
    const Activity = require('../models/Activity');
    const activity = await Activity.findByWebhookId(webhookId);
    
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND', '活动不存在');
    }

    // 验证webhook token
    if (activity.webhook_token !== token) {
      throw createError('AUTH_TOKEN_INVALID', 'Webhook Token无效');
    }

    // 将活动信息添加到请求对象
    req.activity = activity;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * 生成JWT Token
 */
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

/**
 * 验证JWT Token（不用于中间件）
 */
const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  optionalAuth,
  authenticateWebhook,
  generateToken,
  verifyToken
}; 