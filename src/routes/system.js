const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { User, OperationLog, Activity, LotteryRecord } = require('../models');
const { Op } = require('sequelize');
const { logOperation } = require('../middleware/operationLogger');
const bcrypt = require('bcryptjs');
const moment = require('moment');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有system路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// ==================== 用户管理 ====================

// 获取用户列表
router.get('/users', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('role').optional().isIn(['super_admin', 'admin', 'participant']).withMessage('角色必须是有效的角色类型'),
  query('search').optional().isString().withMessage('搜索关键词必须是字符串')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      role,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // 构建查询条件
    if (role) where.role = role;
    if (search) {
      where[Op.or] = [
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          total_pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取用户详情
router.get('/users/:id', [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

// 创建用户
router.post('/users', [
  body('username').isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间'),
  body('email').isEmail().withMessage('邮箱格式不正确'),
  body('password').isLength({ min: 6 }).withMessage('密码长度至少6个字符'),
  body('role').isIn(['admin', 'participant']).withMessage('角色必须是admin或participant')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { username, email, password, role } = req.body;

    // 检查用户名和邮箱是否已存在
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名或邮箱已存在'
      });
    }

    // 创建用户
    const user = await User.create({
      username,
      email,
      password_hash: await bcrypt.hash(password, 10),
      role
    });

    // 记录操作日志
    logOperation(req.user.id, 'create_user', {
      new_user_id: user.id,
      username: user.username,
      role: user.role
    });

    res.status(201).json({
      success: true,
      message: '用户创建成功',
      data: user.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
});

// 更新用户信息
router.put('/users/:id', [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('username').optional().isLength({ min: 3, max: 50 }).withMessage('用户名长度必须在3-50个字符之间'),
  body('email').optional().isEmail().withMessage('邮箱格式不正确'),
  body('role').optional().isIn(['admin', 'participant']).withMessage('角色必须是admin或participant'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('状态必须是active或inactive')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { username, email, role, status } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查是否修改超级管理员
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '无权修改超级管理员信息'
      });
    }

    // 检查用户名和邮箱是否已被其他用户使用
    if (username || email) {
      const where = { id: { [Op.ne]: id } };
      if (username) where.username = username;
      if (email) where.email = email;

      const existingUser = await User.findOne({ where });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '用户名或邮箱已被其他用户使用'
        });
      }
    }

    // 更新用户信息
    const updateData = {};
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    await user.update(updateData);

    // 记录操作日志
    logOperation(req.user.id, 'update_user', {
      user_id: id,
      updated_fields: Object.keys(updateData)
    });

    res.json({
      success: true,
      message: '用户信息更新成功',
      data: user.toSafeJSON()
    });
  } catch (error) {
    next(error);
  }
});

// 重置用户密码
router.put('/users/:id/reset-password', [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  body('new_password').isLength({ min: 6 }).withMessage('新密码长度至少6个字符')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { new_password } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查是否修改超级管理员
    if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '无权修改超级管理员密码'
      });
    }

    // 更新密码
    await user.update({
      password_hash: await bcrypt.hash(new_password, 10)
    });

    // 记录操作日志
    logOperation(req.user.id, 'reset_user_password', {
      user_id: id,
      username: user.username
    });

    res.json({
      success: true,
      message: '密码重置成功'
    });
  } catch (error) {
    next(error);
  }
});

// 删除用户
router.delete('/users/:id', [
  param('id').isInt({ min: 1 }).withMessage('用户ID必须是正整数')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 检查是否删除超级管理员
    if (user.role === 'super_admin') {
      return res.status(403).json({
        success: false,
        message: '不能删除超级管理员'
      });
    }

    // 检查是否删除自己
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能删除自己的账户'
      });
    }

    // 删除用户
    await user.destroy();

    // 记录操作日志
    logOperation(req.user.id, 'delete_user', {
      deleted_user_id: id,
      username: user.username,
      role: user.role
    });

    res.json({
      success: true,
      message: '用户删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// ==================== 操作日志管理 ====================

// 获取操作日志列表
router.get('/logs', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('user_id').optional().isInt({ min: 1 }).withMessage('用户ID必须是正整数'),
  query('operation_type').optional().isString().withMessage('操作类型必须是字符串'),
  query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式不正确')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      user_id,
      operation_type,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // 构建查询条件
    if (user_id) where.user_id = user_id;
    if (operation_type) where.operation_type = operation_type;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    const { count, rows } = await OperationLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          total_pages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取操作日志详情
router.get('/logs/:id', [
  param('id').isInt({ min: 1 }).withMessage('日志ID必须是正整数')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { id } = req.params;

    const log = await OperationLog.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!log) {
      return res.status(404).json({
        success: false,
        message: '操作日志不存在'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    next(error);
  }
});

// 清空操作日志
router.delete('/logs', [
  query('before_date').optional().isISO8601().withMessage('日期格式不正确')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: '参数验证失败',
        errors: errors.array()
      });
    }

    const { before_date } = req.query;
    const where = {};

    if (before_date) {
      where.created_at = { [Op.lt]: new Date(before_date) };
    }

    const deletedCount = await OperationLog.destroy({ where });

    // 记录操作日志
    logOperation(req.user.id, 'clear_operation_logs', {
      deleted_count: deletedCount,
      before_date: before_date || 'all'
    });

    res.json({
      success: true,
      message: `成功清空 ${deletedCount} 条操作日志`
    });
  } catch (error) {
    next(error);
  }
});

// ==================== 系统状态 ====================

// 获取系统概览信息
router.get('/overview', async (req, res, next) => {
  try {
    // 用户统计
    const totalUsers = await User.count();
    const adminUsers = await User.count({ where: { role: { [Op.in]: ['admin', 'super_admin'] } } });
    const participantUsers = await User.count({ where: { role: 'participant' } });

    // 活动统计
    const totalActivities = await Activity.count();
    const activeActivities = await Activity.count({ where: { status: 'active' } });
    const inactiveActivities = await Activity.count({ where: { status: 'inactive' } });

    // 抽奖记录统计
    const totalRecords = await LotteryRecord.count();
    const todayRecords = await LotteryRecord.count({
      where: {
        created_at: {
          [Op.gte]: new Date().setHours(0, 0, 0, 0)
        }
      }
    });

    // 系统运行时间（这里简化处理，实际可以从配置文件读取启动时间）
    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          admin: adminUsers,
          participant: participantUsers
        },
        activities: {
          total: totalActivities,
          active: activeActivities,
          inactive: inactiveActivities
        },
        lottery_records: {
          total: totalRecords,
          today: todayRecords
        },
        system: {
          uptime: Math.floor(uptime),
          uptime_formatted: moment.duration(uptime, 'seconds').humanize()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取系统健康状态
router.get('/health', async (req, res, next) => {
  try {
    // 检查数据库连接
    let dbStatus = 'unknown';
    try {
      await User.findOne({ limit: 1 });
      dbStatus = 'healthy';
    } catch (error) {
      dbStatus = 'unhealthy';
    }

    // 检查内存使用
    const memoryUsage = process.memoryUsage();
    const memoryStatus = memoryUsage.heapUsed / memoryUsage.heapTotal < 0.9 ? 'healthy' : 'warning';

    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          memory: memoryStatus
        },
        metrics: {
          memory_usage: {
            heap_used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
            heap_total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
            external: Math.round(memoryUsage.external / 1024 / 1024)
          },
          uptime: process.uptime()
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// ==================== 系统配置 ====================

// 获取系统配置
router.get('/config', async (req, res, next) => {
  try {
    // 这里可以从配置文件或数据库读取系统配置
    const config = {
      system_name: '抽奖系统',
      version: '1.0.0',
      max_file_size: 10 * 1024 * 1024, // 10MB
      allowed_file_types: ['.xlsx', '.xls', '.csv'],
      lottery_code_formats: [
        { value: '8_digits', label: '8位纯数字' },
        { value: '8_digits_letters', label: '8位数字+小写字母' },
        { value: '4_digits', label: '4位纯数字' },
        { value: '12_digits', label: '12位纯数字' },
        { value: '12_digits_letters', label: '12位纯数字+字母' }
      ],
      prize_types: [
        { value: 'physical', label: '实物奖品' },
        { value: 'virtual', label: '虚拟奖品' },
        { value: 'coupon', label: '优惠券' }
      ]
    };

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 