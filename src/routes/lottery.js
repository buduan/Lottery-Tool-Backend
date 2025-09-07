const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

const { optionalAuth, authenticateToken, requireAdmin } = require('../middleware/auth');
const { logLotteryDraw } = require('../middleware/operationLogger');
const { createError } = require('../utils/customError');
const { sequelize } = require('../config/database');
const Activity = require('../models/Activity');
const LotteryCode = require('../models/LotteryCode');
const Prize = require('../models/Prize');
const LotteryRecord = require('../models/LotteryRecord');
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
 * @route   GET /api/lottery/activities/:id
 * @desc    获取活动的抽奖信息（公开接口）
 * @access  Public
 */
router.get('/activities/:id', async (req, res, next) => {
  try {
    const activityId = req.params.id;

    const activity = await Activity.findByPk(activityId, {
      include: [
        {
          model: Prize,
          as: 'prizes',
          attributes: ['id', 'name', 'description', 'total_quantity'],
          order: [['sort_order', 'ASC']]
        }
      ]
    });

    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 只返回公开信息
    const lotteryCodesCount = await LotteryCode.count({
      where: { activity_id: activityId }
    });

    res.json({
      success: true,
      data: {
        activity: {
          id: activity.id,
          name: activity.name,
          description: activity.description,
          status: activity.status,
          lottery_mode: activity.lottery_mode,
          start_time: activity.start_time,
          end_time: activity.end_time
        },
        prizes: activity.prizes,
        lottery_codes_count: lotteryCodesCount
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   POST /api/lottery/activities/:id/draw
 * @desc    用户使用抽奖码参与线上抽奖
 * @access  Public
 */
router.post('/activities/:id/draw', [
  body('lottery_code')
    .notEmpty()
    .withMessage('抽奖码不能为空')
    .isLength({ min: 1, max: 50 })
    .withMessage('抽奖码长度不正确')
], 
validateRequest,
logLotteryDraw(OperationLog.OPERATION_TYPES.ONLINE_LOTTERY),
async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const activityId = req.params.id;
    const { lottery_code } = req.body;

    // 查找活动
    const activity = await Activity.findByPk(activityId, { transaction });
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 检查活动是否可以抽奖
    const canStart = activity.canStartLottery();
    if (!canStart.canStart) {
      throw createError('BUSINESS_ACTIVITY_NOT_STARTED', canStart.reason);
    }

    // 查找抽奖码
    const lotteryCodeRecord = await LotteryCode.findByActivityAndCode(
      activityId,
      lottery_code
    );
    if (!lotteryCodeRecord) {
      throw createError(
        'BUSINESS_LOTTERY_CODE_NOT_FOUND',
        '抽奖码不存在或不属于此活动'
      );
    }

    // 检查抽奖码是否已使用
    if (lotteryCodeRecord.isUsed()) {
      throw createError('BUSINESS_LOTTERY_CODE_USED');
    }

    // 检查是否已经抽过奖
    const existingRecord = await LotteryRecord.findOne({
      where: { lottery_code_id: lotteryCodeRecord.id },
      transaction
    });

    if (existingRecord) {
      throw createError('BUSINESS_LOTTERY_CODE_USED', '该抽奖码已参与过抽奖');
    }

    // 执行抽奖逻辑
    let isWinner = false;
    let selectedPrize = null;

    // 根据概率选择奖品（内部会处理总和>1抛错，总和<1可能未中奖）
    const selectedPrizeRecord = await Prize.selectByProbability(activityId, activity);
    
    if (selectedPrizeRecord && selectedPrizeRecord.hasStock()) {
      isWinner = true;
      selectedPrize = selectedPrizeRecord;
      
      // 扣减库存（在事务中）
      await selectedPrize.deductStock(1, { transaction });
    } else {
      isWinner = false;
      selectedPrize = null;
    }

    // 标记抽奖码为已使用（在事务中）
    await lotteryCodeRecord.markAsUsed({ transaction });

    // 创建抽奖记录（在事务中）
    const lotteryRecord = await LotteryRecord.createRecord({
      activity_id: activityId,
      lottery_code_id: lotteryCodeRecord.id,
      prize_id: selectedPrize ? selectedPrize.id : null,
      is_winner: isWinner,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    }, { transaction });

    await transaction.commit();

    // 准备响应数据
    const responseData = {
      is_winner: isWinner,
      lottery_record: {
        id: lotteryRecord.id,
        created_at: lotteryRecord.created_at
      },
      lottery_code: {
        code: lotteryCodeRecord.code,
        participant_info: lotteryCodeRecord.getParticipantInfo()
      }
    };

    if (isWinner && selectedPrize) {
      responseData.prize = {
        id: selectedPrize.id,
        name: selectedPrize.name,
        description: selectedPrize.description
      };
    }

    res.json({
      success: true,
      data: responseData,
      message: isWinner ? '恭喜您中奖了！' : '很遗憾，您没有中奖'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

/**
 * @route   POST /api/lottery/activities/:id/offline-draw
 * @desc    管理员使用抽奖码进行线下抽奖
 * @access  Private (Admin)
 */
router.post('/activities/:id/offline-draw', [
  authenticateToken,
  requireAdmin,
  
  body('lottery_code')
    .notEmpty()
    .withMessage('抽奖码不能为空'),
  
  body('prize_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('奖品ID必须是正整数')
], 
validateRequest,
logLotteryDraw(OperationLog.OPERATION_TYPES.OFFLINE_LOTTERY),
async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const activityId = req.params.id;
    const { lottery_code, prize_id } = req.body;

    // 查找活动
    const activity = await Activity.findByPk(activityId, { transaction });
    if (!activity) {
      throw createError('BUSINESS_ACTIVITY_NOT_FOUND');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能管理自己创建的活动');
    }

    // 查找抽奖码
    const lotteryCodeRecord = await LotteryCode.findByActivityAndCode(
      activityId,
      lottery_code
    );
    if (!lotteryCodeRecord) {
      throw createError(
        'BUSINESS_LOTTERY_CODE_NOT_FOUND',
        '抽奖码不存在或不属于此活动'
      );
    }

    // 检查抽奖码是否已使用
    if (lotteryCodeRecord.isUsed()) {
      throw createError('BUSINESS_LOTTERY_CODE_USED');
    }

    // 检查是否已经抽过奖
    const existingRecord = await LotteryRecord.findOne({
      where: { lottery_code_id: lotteryCodeRecord.id },
      transaction
    });

    if (existingRecord) {
      throw createError('BUSINESS_LOTTERY_CODE_USED', '该抽奖码已参与过抽奖');
    }

    let isWinner = false;
    let selectedPrize = null;

    // 如果指定了奖品ID，使用指定奖品
    if (prize_id) {
      const prize = await Prize.findByPk(prize_id, { transaction });
      if (!prize || prize.activity_id !== parseInt(activityId)) {
        throw createError('VALIDATION_INVALID_FORMAT', '奖品不存在或不属于此活动');
      }

      if (!prize.hasStock()) {
        throw createError('BUSINESS_PRIZE_OUT_OF_STOCK');
      }

      isWinner = true;
      selectedPrize = prize;
      await selectedPrize.deductStock(1, { transaction });
    } else {
      // 使用概率抽奖
      const selectedPrizeRecord = await Prize.selectByProbability(activityId, activity);
      
      if (selectedPrizeRecord && selectedPrizeRecord.hasStock()) {
        isWinner = true;
        selectedPrize = selectedPrizeRecord;
        await selectedPrize.deductStock(1, { transaction });
      } else {
        isWinner = false;
        selectedPrize = null;
      }
    }

    // 标记抽奖码为已使用
    await lotteryCodeRecord.markAsUsed({ transaction });

    // 创建抽奖记录
    const lotteryRecord = await LotteryRecord.createRecord({
      activity_id: activityId,
      lottery_code_id: lotteryCodeRecord.id,
      prize_id: selectedPrize ? selectedPrize.id : null,
      is_winner: isWinner,
      operator_id: req.user.id,
      ip_address: req.ip,
      user_agent: req.get('User-Agent')
    }, { transaction });

    await transaction.commit();

    // 准备响应数据
    const responseData = {
      is_winner: isWinner,
      lottery_record: {
        id: lotteryRecord.id,
        created_at: lotteryRecord.created_at
      },
      lottery_code: {
        code: lotteryCodeRecord.code,
        participant_info: lotteryCodeRecord.getParticipantInfo()
      }
    };

    if (isWinner && selectedPrize) {
      responseData.prize = {
        id: selectedPrize.id,
        name: selectedPrize.name,
        description: selectedPrize.description
      };
    }

    res.json({
      success: true,
      data: responseData,
      message: isWinner ? '抽奖成功，参与者中奖！' : '很遗憾未中奖'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
});

module.exports = router;