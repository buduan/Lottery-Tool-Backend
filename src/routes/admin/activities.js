const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const { logActivityOperation, logLotteryCodeOperation, logPrizeOperation } = require('../../middleware/operationLogger');
const { createError } = require('../../utils/customError');
const { generateBatchLotteryCodes, validateLotteryCodeFormat } = require('../../utils/lotteryCodeGenerator');
const Activity = require('../../models/Activity');
const Prize = require('../../models/Prize');
const LotteryCode = require('../../models/LotteryCode');
const OperationLog = require('../../models/OperationLog');

// 验证请求参数的中间件
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(createError('VALIDATION_INVALID_FORMAT', '请求参数验证失败', errors.array()));
  }
  next();
};

/**
 * @route   GET /api/admin/activities
 * @desc    获取活动列表
 * @access  Private (Admin)
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100的整数'),
  query('search').optional().isLength({ max: 100 }).withMessage('搜索关键词不能超过100个字符'),
  query('status').optional().isIn(['draft', 'active', 'ended']).withMessage('状态只能是draft、active或ended')
], 
validateRequest,
async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const userId = req.user.id;

    const activities = await Activity.findByCreator(userId, {
      page,
      limit,
      search,
      status
    });

    res.json({
      success: true,
      data: activities
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/activities/:id
 * @desc    获取活动详情
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const activityId = req.params.id;

    const activity = await Activity.findByPk(activityId, {
      include: [
        {
          model: Prize,
          as: 'prizes',
          order: [['sort_order', 'ASC']]
        }
      ]
    });

    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 检查用户权限（只能查看自己创建的活动，超级管理员除外）
    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能查看自己创建的活动');
    }

    // 获取抽奖码统计
    const lotteryCodesCount = await LotteryCode.count({
      where: { activity_id: activityId }
    });

    const activityData = activity.toJSON();
    activityData.lottery_codes_count = lotteryCodesCount;

    res.json({
      success: true,
      data: {
        activity: activityData
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/activities
 * @desc    创建新活动
 * @access  Private (Admin)
 */
router.post('/', [
  body('name')
    .notEmpty()
    .withMessage('活动名称不能为空')
    .isLength({ min: 1, max: 100 })
    .withMessage('活动名称长度为1-100个字符'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('活动描述不能超过1000个字符'),
  
  body('lottery_mode')
    .isIn(['offline', 'online'])
    .withMessage('抽奖模式只能是offline或online'),
  
  body('start_time')
    .optional()
    .isISO8601()
    .withMessage('开始时间格式错误'),
  
  body('end_time')
    .optional()
    .isISO8601()
    .withMessage('结束时间格式错误'),
  
  body('settings.max_lottery_codes')
    .optional()
    .isInt({ min: 1 })
    .withMessage('最大抽奖码数量必须是正整数'),
  
  body('settings.lottery_code_format')
    .optional()
    .isIn(['4_digit_number', '8_digit_number', '8_digit_alphanumeric', '12_digit_number', '12_digit_alphanumeric'])
    .withMessage('抽奖码格式不正确')
], 
validateRequest,
logActivityOperation(OperationLog.OPERATION_TYPES.CREATE_ACTIVITY),
async (req, res, next) => {
  try {
    const { name, description, lottery_mode, start_time, end_time, settings } = req.body;

    // 验证时间逻辑
    if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
      throw createError('VALIDATION_INVALID_FORMAT', '开始时间必须早于结束时间');
    }

    const activityData = {
      name,
      description,
      lottery_mode,
      start_time: start_time ? new Date(start_time) : null,
      end_time: end_time ? new Date(end_time) : null,
      created_by: req.user.id,
      status: 'draft'
    };

    // 设置活动配置
    if (settings) {
      activityData.settings = {
        max_lottery_codes: settings.max_lottery_codes || 1000,
        lottery_code_format: settings.lottery_code_format || '8_digit_number',
        allow_duplicate_phone: settings.allow_duplicate_phone || false
      };
    }

    const activity = await Activity.create(activityData);

    res.status(201).json({
      success: true,
      data: {
        activity
      },
      message: '活动创建成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/activities/:id
 * @desc    更新活动信息
 * @access  Private (Admin)
 */
router.put('/:id', [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('活动名称长度为1-100个字符'),
  
  body('description')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('活动描述不能超过1000个字符'),
  
  body('status')
    .optional()
    .isIn(['draft', 'active', 'ended'])
    .withMessage('状态只能是draft、active或ended'),
  
  body('start_time')
    .optional()
    .isISO8601()
    .withMessage('开始时间格式错误'),
  
  body('end_time')
    .optional()
    .isISO8601()
    .withMessage('结束时间格式错误')
], 
validateRequest,
logActivityOperation(OperationLog.OPERATION_TYPES.UPDATE_ACTIVITY),
async (req, res, next) => {
  try {
    const activityId = req.params.id;
    const updateData = req.body;

    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能修改自己创建的活动');
    }

    // 验证时间逻辑
    const startTime = updateData.start_time ? new Date(updateData.start_time) : activity.start_time;
    const endTime = updateData.end_time ? new Date(updateData.end_time) : activity.end_time;
    
    if (startTime && endTime && startTime >= endTime) {
      throw createError('VALIDATION_INVALID_FORMAT', '开始时间必须早于结束时间');
    }

    // 更新活动
    await activity.update(updateData);

    res.json({
      success: true,
      data: {
        activity
      },
      message: '活动更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/activities/:id
 * @desc    删除活动
 * @access  Private (Admin)
 */
router.delete('/:id', 
logActivityOperation(OperationLog.OPERATION_TYPES.DELETE_ACTIVITY),
async (req, res, next) => {
  try {
    const activityId = req.params.id;

    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能删除自己创建的活动');
    }

    // 检查活动状态
    if (activity.status === 'active') {
      throw createError('VALIDATION_INVALID_FORMAT', '不能删除进行中的活动');
    }

    await activity.destroy();

    res.json({
      success: true,
      message: '活动删除成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/activities/:id/lottery-codes
 * @desc    获取活动的抽奖码列表
 * @access  Private (Admin)
 */
router.get('/:id/lottery-codes', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须是1-100的整数'),
  query('search').optional().isLength({ max: 100 }).withMessage('搜索关键词不能超过100个字符'),
  query('status').optional().isIn(['unused', 'used']).withMessage('状态只能是unused或used'),
  query('has_participant_info').optional().isBoolean().withMessage('has_participant_info必须是布尔值')
], 
validateRequest,
async (req, res, next) => {
  try {
    const activityId = req.params.id;
    const { page = 1, limit = 20, search, status, has_participant_info } = req.query;

    // 验证活动存在且有权限
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能查看自己创建的活动');
    }

    const result = await LotteryCode.findByActivity(activityId, {
      page,
      limit,
      search,
      status,
      has_participant_info: has_participant_info === 'true' ? true : has_participant_info === 'false' ? false : undefined
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/activities/:id/lottery-codes/batch
 * @desc    批量创建抽奖码
 * @access  Private (Admin)
 */
router.post('/:id/lottery-codes/batch', [
  body('count')
    .isInt({ min: 1, max: 1000 })
    .withMessage('创建数量必须是1-1000的整数')
], 
validateRequest,
logLotteryCodeOperation(OperationLog.OPERATION_TYPES.BATCH_CREATE_LOTTERY_CODE),
async (req, res, next) => {
  try {
    const activityId = req.params.id;
    const { count } = req.body;

    // 验证活动存在且有权限
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能管理自己创建的活动');
    }

    // 获取活动设置
    const settings = activity.settings || {};
    const lotteryCodeFormat = settings.lottery_code_format || '8_digit_number';
    const maxLotteryCodes = settings.max_lottery_codes || 1000;

    // 检查是否超过最大限制
    const existingCount = await LotteryCode.count({
      where: { activity_id: activityId }
    });

    if (existingCount + count > maxLotteryCodes) {
      throw createError('VALIDATION_OUT_OF_RANGE', `超过活动最大抽奖码限制 ${maxLotteryCodes}`);
    }

    // 获取已存在的抽奖码
    const existingCodes = await LotteryCode.getAllCodesForActivity(activityId);

    // 生成新的抽奖码
    const newCodes = generateBatchLotteryCodes(lotteryCodeFormat, count, existingCodes);

    // 批量创建抽奖码
    const createdCodes = await LotteryCode.createBatch(activityId, newCodes);

    res.status(201).json({
      success: true,
      data: {
        created_count: createdCodes.length,
        lottery_codes: createdCodes
      },
      message: `成功创建 ${createdCodes.length} 个抽奖码`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/activities/:id/webhook-info
 * @desc    获取活动的Webhook接口信息
 * @access  Private (Admin)
 */
router.get('/:id/webhook-info', async (req, res, next) => {
  try {
    const activityId = req.params.id;

    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能查看自己创建的活动');
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    res.json({
      success: true,
      data: {
        webhook_url: `${baseUrl}/api/webhook/activities/${activity.webhook_id}/lottery-codes`,
        webhook_token: activity.webhook_token,
        activity_id: activity.webhook_id
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/activities/:id/lottery-codes
 * @desc    单个添加抽奖码
 * @access  Private (Admin)
 */
router.post('/:id/lottery-codes', [
  body('code')
    .notEmpty()
    .withMessage('抽奖码不能为空')
    .isLength({ min: 1, max: 50 })
    .withMessage('抽奖码长度不正确'),
  
  body('participant_info.name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('姓名长度为1-100个字符'),
  
  body('participant_info.phone')
    .optional()
    .isMobilePhone('zh-CN')
    .withMessage('手机号格式不正确'),
  
  body('participant_info.email')
    .optional()
    .isEmail()
    .withMessage('邮箱格式不正确')
], 
validateRequest,
logLotteryCodeOperation(OperationLog.OPERATION_TYPES.CREATE_LOTTERY_CODE),
async (req, res, next) => {
  try {
    const activityId = req.params.id;
    const { code, participant_info } = req.body;

    // 验证活动存在且有权限
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能管理自己创建的活动');
    }

    // 验证抽奖码格式
    const settings = activity.settings || {};
    const lotteryCodeFormat = settings.lottery_code_format || '8_digit_number';
    
    if (!validateLotteryCodeFormat(code, lotteryCodeFormat)) {
      throw createError('VALIDATION_INVALID_FORMAT', `抽奖码格式不符合要求：${lotteryCodeFormat}`);
    }

    // 检查抽奖码是否已存在
    const existingCode = await LotteryCode.findByActivityAndCode(activityId, code);
    if (existingCode) {
      throw createError('BUSINESS_LOTTERY_CODE_EXISTS', '抽奖码已存在');
    }

    // 检查是否超过最大限制
    const maxLotteryCodes = settings.max_lottery_codes || 1000;
    const existingCount = await LotteryCode.count({
      where: { activity_id: activityId }
    });

    if (existingCount >= maxLotteryCodes) {
      throw createError('VALIDATION_OUT_OF_RANGE', `超过活动最大抽奖码限制 ${maxLotteryCodes}`);
    }

    // 创建抽奖码
    const lotteryCode = await LotteryCode.create({
      activity_id: activityId,
      code: code,
      participant_info: participant_info || null,
      status: 'unused'
    });

    res.status(201).json({
      success: true,
      data: {
        lottery_code: lotteryCode
      },
      message: '抽奖码添加成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/activities/:id/lottery-codes/import
 * @desc    批量导入抽奖码
 * @access  Private (Admin)
 */
router.post('/:id/lottery-codes/import', 
logLotteryCodeOperation(OperationLog.OPERATION_TYPES.IMPORT_LOTTERY_CODE),
async (req, res, next) => {
  try {
    const activityId = req.params.id;

    // 验证活动存在且有权限
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能管理自己创建的活动');
    }

    // 这里应该处理文件上传和解析
    // 由于没有配置multer，先返回一个占位响应
    res.json({
      success: true,
      data: {
        imported_count: 0,
        lottery_codes: []
      },
      message: '批量导入功能开发中'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   GET /api/admin/activities/:id/prizes
 * @desc    获取指定活动的奖品列表
 * @access  Private (Admin)
 */
router.get('/:id/prizes', async (req, res, next) => {
  try {
    const activityId = req.params.id;

    // 验证活动存在且有权限
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能查看自己创建的活动');
    }

    const prizes = await Prize.findByActivity(activityId);

    res.json({
      success: true,
      data: {
        prizes
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/admin/activities/:id/prizes
 * @desc    为活动添加奖品
 * @access  Private (Admin)
 */
router.post('/:id/prizes', [
  body('name')
    .notEmpty()
    .withMessage('奖品名称不能为空')
    .isLength({ min: 1, max: 100 })
    .withMessage('奖品名称长度为1-100个字符'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('奖品描述不能超过500个字符'),
  
  body('total_quantity')
    .isInt({ min: 0 })
    .withMessage('奖品总数量必须是非负整数'),
  
  body('probability')
    .isFloat({ min: 0, max: 1 })
    .withMessage('中奖概率必须是0-1之间的数值'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('排序值必须是非负整数')
], 
validateRequest,
logPrizeOperation(OperationLog.OPERATION_TYPES.CREATE_PRIZE),
async (req, res, next) => {
  try {
    const activityId = req.params.id;
    const { name, description, total_quantity, probability, sort_order } = req.body;

    // 验证活动存在且有权限
    const activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能管理自己创建的活动');
    }

    // 验证概率总和
    const validation = await Prize.validateProbabilities(activityId);
    if (validation.totalProbability + probability > 1) {
      throw createError('VALIDATION_OUT_OF_RANGE', 
        `奖品概率总和不能超过1，当前总和: ${validation.totalProbability}`);
    }

    const prize = await Prize.create({
      activity_id: activityId,
      name,
      description,
      total_quantity,
      remaining_quantity: total_quantity,
      probability,
      sort_order: sort_order || 0
    });

    res.status(201).json({
      success: true,
      data: {
        prize
      },
      message: '奖品添加成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 