const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();

const { logPrizeOperation } = require('../../middleware/operationLogger');
const { createError } = require('../../utils/customError');
const Prize = require('../../models/Prize');
const Activity = require('../../models/Activity');
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
 * @route   GET /api/admin/prizes/:id
 * @desc    获取奖品详情
 * @access  Private (Admin)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const prizeId = req.params.id;

    const prize = await Prize.findByPk(prizeId, {
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'created_by']
        }
      ]
    });

    if (!prize) {
      throw createError('VALIDATION_INVALID_FORMAT', '奖品不存在');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && prize.activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能查看自己创建的活动的奖品');
    }

    res.json({
      success: true,
      data: {
        prize
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   PUT /api/admin/prizes/:id
 * @desc    更新奖品信息
 * @access  Private (Admin)
 */
router.put('/:id', [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('奖品名称长度为1-100个字符'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('奖品描述不能超过500个字符'),
  
  body('total_quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('奖品总数量必须是非负整数'),
  
  body('probability')
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage('中奖概率必须是0-1之间的数值'),
  
  body('sort_order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('排序值必须是非负整数')
], 
validateRequest,
logPrizeOperation(OperationLog.OPERATION_TYPES.UPDATE_PRIZE),
async (req, res, next) => {
  try {
    const prizeId = req.params.id;
    const updateData = req.body;

    const prize = await Prize.findByPk(prizeId, {
      include: [
        {
          model: Activity,
          as: 'activity'
        }
      ]
    });

    if (!prize) {
      throw createError('VALIDATION_INVALID_FORMAT', '奖品不存在');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && prize.activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能修改自己创建的活动的奖品');
    }

    // 如果更新概率，验证概率总和
    if (updateData.probability !== undefined) {
      const validation = await Prize.validateProbabilities(prize.activity_id);
      const currentProbability = parseFloat(prize.probability);
      const newProbability = parseFloat(updateData.probability);
      const newTotal = validation.totalProbability - currentProbability + newProbability;
      
      if (newTotal > 1) {
        throw createError('VALIDATION_OUT_OF_RANGE', 
          `奖品概率总和不能超过1，更新后总和: ${newTotal.toFixed(4)}`);
      }
    }

    // 如果更新总数量，调整剩余数量
    if (updateData.total_quantity !== undefined) {
      const awardedCount = prize.total_quantity - prize.remaining_quantity;
      const newRemainingQuantity = Math.max(0, updateData.total_quantity - awardedCount);
      updateData.remaining_quantity = newRemainingQuantity;
    }

    await prize.update(updateData);

    res.json({
      success: true,
      data: {
        prize
      },
      message: '奖品更新成功'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route   DELETE /api/admin/prizes/:id
 * @desc    删除奖品
 * @access  Private (Admin)
 */
router.delete('/:id', 
logPrizeOperation(OperationLog.OPERATION_TYPES.DELETE_PRIZE),
async (req, res, next) => {
  try {
    const prizeId = req.params.id;

    const prize = await Prize.findByPk(prizeId, {
      include: [
        {
          model: Activity,
          as: 'activity'
        }
      ]
    });

    if (!prize) {
      throw createError('VALIDATION_INVALID_FORMAT', '奖品不存在');
    }

    // 检查用户权限
    if (req.user.role !== 'super_admin' && prize.activity.created_by !== req.user.id) {
      throw createError('AUTH_INSUFFICIENT_PERMISSION', '只能删除自己创建的活动的奖品');
    }

    // 检查是否有已分配的奖品
    const awardedCount = prize.total_quantity - prize.remaining_quantity;
    if (awardedCount > 0) {
      throw createError('VALIDATION_INVALID_FORMAT', '已有用户获得此奖品，无法删除');
    }

    await prize.destroy();

    res.json({
      success: true,
      message: '奖品删除成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 