const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { generateToken, authenticateToken, requireSuperAdmin } = require('../middleware/auth');
const { logAuthOperation } = require('../middleware/operationLogger');
const { createError } = require('../utils/customError');
const User = require('../models/User');
const OperationLog = require('../models/OperationLog');

// 验证请求参数的中间件
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(createError('VALIDATION_INVALID_FORMAT', '请求参数验证失败', errors.array()));
  }
  next();
};

/**
 * @route   POST /api/auth/login
 * @desc    用户登录
 * @access  Public
 */
router.post('/login', [
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度为3-50个字符'),
  
  body('password')
    .notEmpty()
    .withMessage('密码不能为空')
    .isLength({ min: 6 })
    .withMessage('密码至少6个字符')
], 
validateRequest,
logAuthOperation(OperationLog.OPERATION_TYPES.USER_LOGIN),
async (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 查找用户
    const user = await User.findByUsername(username);
    if (!user) {
      throw createError('AUTH_INVALID_CREDENTIALS');
    }

    // 验证密码
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw createError('AUTH_INVALID_CREDENTIALS');
    }

    // 检查账户状态
    if (user.status !== 'active') {
      throw createError('AUTH_ACCOUNT_DISABLED');
    }

    // 生成JWT token
    const token = generateToken(user.id);

    res.json({
      success: true,
      data: {
        token,
        user: user.toSafeJSON()
      },
      message: '登录成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/register
 * @desc    创建新管理员账户（仅超级管理员可操作）
 * @access  Private (Super Admin only)
 */
router.post('/register', [
  authenticateToken,
  requireSuperAdmin,
  
  body('username')
    .notEmpty()
    .withMessage('用户名不能为空')
    .isLength({ min: 3, max: 50 })
    .withMessage('用户名长度为3-50个字符')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('用户名只能包含字母、数字和下划线'),
  
  body('email')
    .isEmail()
    .withMessage('邮箱格式不正确')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 6 })
    .withMessage('密码至少6个字符')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('密码必须包含字母和数字'),
  
  body('role')
    .isIn(['admin', 'super_admin'])
    .withMessage('角色只能是admin或super_admin')
], 
validateRequest,
logAuthOperation(OperationLog.OPERATION_TYPES.USER_REGISTER),
async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body;

    // 检查用户名是否已存在
    const existingUser = await User.findByUsername(username);
    if (existingUser) {
      throw createError('VALIDATION_DUPLICATE_DATA', '用户名已存在');
    }

    // 检查邮箱是否已存在
    const existingEmail = await User.findOne({ where: { email } });
    if (existingEmail) {
      throw createError('VALIDATION_DUPLICATE_DATA', '邮箱已存在');
    }

    // 创建用户
    const newUser = await User.createUser({
      username,
      email,
      password,
      role
    });

    res.status(201).json({
      success: true,
      data: {
        user: newUser.toSafeJSON()
      },
      message: '用户创建成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/me
 * @desc    获取当前用户信息
 * @access  Private
 */
router.get('/me', 
authenticateToken,
async (req, res, next) => {
  try {
    // 重新从数据库获取用户信息，确保数据最新
    const user = await User.findByPk(req.user.id);
    if (!user) {
      throw createError('AUTH_TOKEN_INVALID', '用户不存在');
    }

    res.json({
      success: true,
      data: {
        user: user.toSafeJSON()
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/auth/password
 * @desc    修改当前用户密码
 * @access  Private
 */
router.put('/password', [
  authenticateToken,
  
  body('old_password')
    .notEmpty()
    .withMessage('原密码不能为空'),
  
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('新密码至少6个字符')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/)
    .withMessage('新密码必须包含字母和数字')
], 
validateRequest,
logAuthOperation(OperationLog.OPERATION_TYPES.PASSWORD_CHANGE),
async (req, res, next) => {
  try {
    const { old_password, new_password } = req.body;

    // 获取当前用户
    const user = await User.findByPk(req.user.id);
    if (!user) {
      throw createError('AUTH_TOKEN_INVALID', '用户不存在');
    }

    // 验证原密码
    const isValidOldPassword = await user.validatePassword(old_password);
    if (!isValidOldPassword) {
      throw createError('AUTH_INVALID_CREDENTIALS', '原密码错误');
    }

    // 检查新密码是否与原密码相同
    const isSamePassword = await user.validatePassword(new_password);
    if (isSamePassword) {
      throw createError('VALIDATION_INVALID_FORMAT', '新密码不能与原密码相同');
    }

    // 更新密码
    await user.setPassword(new_password);
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    用户登出
 * @access  Private
 */
router.post('/logout', 
authenticateToken,
logAuthOperation(OperationLog.OPERATION_TYPES.USER_LOGOUT),
async (req, res, next) => {
  try {
    // 这里可以实现token黑名单功能
    // 目前只是返回成功响应
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    刷新token
 * @access  Private
 */
router.post('/refresh', 
authenticateToken,
async (req, res, next) => {
  try {
    // 生成新的token
    const newToken = generateToken(req.user.id);

    res.json({
      success: true,
      data: {
        token: newToken
      },
      message: 'Token刷新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/auth/validate-token
 * @desc    验证token有效性
 * @access  Private
 */
router.get('/validate-token', 
authenticateToken,
async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: {
        valid: true,
        user: req.user
      },
      message: 'Token有效'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 