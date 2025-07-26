const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { authenticateWebhook } = require('../middleware/auth');
const { createError } = require('../utils/customError');
const { validateLotteryCodeFormat } = require('../utils/lotteryCodeGenerator');
const LotteryCode = require('../models/LotteryCode');
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
 * @route   POST /api/webhook/activities/:webhook_id/lottery-codes
 * @desc    通过Webhook添加抽奖码（第三方系统调用）
 * @access  Webhook (requires webhook token)
 */
router.post('/activities/:webhook_id/lottery-codes', [
  authenticateWebhook,
  
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
async (req, res, next) => {
  try {
    const { code, participant_info } = req.body;
    const activity = req.activity; // 从中间件获取

    // 验证抽奖码格式
    const settings = activity.settings || {};
    const lotteryCodeFormat = settings.lottery_code_format || '8_digit_number';
    
    if (!validateLotteryCodeFormat(code, lotteryCodeFormat)) {
      throw createError('VALIDATION_INVALID_FORMAT', `抽奖码格式不符合要求：${lotteryCodeFormat}`);
    }

    // 检查抽奖码是否已存在
    const existingCode = await LotteryCode.findByActivityAndCode(activity.id, code);
    if (existingCode) {
      throw createError('BUSINESS_LOTTERY_CODE_EXISTS', '抽奖码已存在');
    }

    // 检查是否超过最大限制
    const maxLotteryCodes = settings.max_lottery_codes || 1000;
    const existingCount = await LotteryCode.count({
      where: { activity_id: activity.id }
    });

    if (existingCount >= maxLotteryCodes) {
      throw createError('VALIDATION_OUT_OF_RANGE', `超过活动最大抽奖码限制 ${maxLotteryCodes}`);
    }

    // 创建抽奖码
    const lotteryCode = await LotteryCode.create({
      activity_id: activity.id,
      code: code,
      participant_info: participant_info || null,
      status: 'unused'
    });

    // 记录操作日志
    await OperationLog.log({
      user_id: null, // Webhook调用没有用户ID
      operation_type: OperationLog.OPERATION_TYPES.WEBHOOK_CREATE_LOTTERY_CODE,
      operation_detail: `Webhook创建抽奖码: ${code}`,
      target_type: 'ACTIVITY',
      target_id: activity.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    });

    res.status(201).json({
      success: true,
      data: {
        lottery_code: {
          id: lotteryCode.id,
          code: lotteryCode.code,
          status: lotteryCode.status,
          participant_info: lotteryCode.participant_info,
          created_at: lotteryCode.created_at
        }
      },
      message: '抽奖码添加成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 