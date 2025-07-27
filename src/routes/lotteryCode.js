const express = require('express');
const router = express.Router();
const { query, param, validationResult, body } = require('express-validator');
const { LotteryCode, Activity } = require('../models');
const { Op } = require('sequelize');

// 查询抽奖码信息
router.get('/query', [
  query('code').isString().isLength({ min: 1 }).withMessage('抽奖码不能为空'),
  query('activity_id').optional().isInt({ min: 1 }).withMessage('活动ID必须是正整数')
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

    const { code, activity_id } = req.query;
    const where = { code };

    if (activity_id) {
      where.activity_id = activity_id;
    }

    const lotteryCode = await LotteryCode.findOne({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'status', 'start_time', 'end_time', 'lottery_mode']
        }
      ]
    });

    if (!lotteryCode) {
      return res.status(404).json({
        success: false,
        message: '抽奖码不存在'
      });
    }

    // 检查活动状态
    if (lotteryCode.activity.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: '活动已结束或未开始'
      });
    }

    // 检查活动时间
    const now = new Date();
    if (now < lotteryCode.activity.start_time || now > lotteryCode.activity.end_time) {
      return res.status(400).json({
        success: false,
        message: '活动不在有效时间内'
      });
    }

    res.json({
      success: true,
      data: {
        lottery_code: {
          id: lotteryCode.id,
          code: lotteryCode.code,
          status: lotteryCode.status,
          participant_name: lotteryCode.participant_info?.name || null,
          participant_email: lotteryCode.participant_info?.email || null,
          participant_phone: lotteryCode.participant_info?.phone || null,
          created_at: lotteryCode.created_at
        },
        activity: {
          id: lotteryCode.activity.id,
          name: lotteryCode.activity.name,
          status: lotteryCode.activity.status,
          lottery_mode: lotteryCode.activity.lottery_mode,
          start_time: lotteryCode.activity.start_time,
          end_time: lotteryCode.activity.end_time
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 验证抽奖码
router.get('/validate/:code', [
  param('code').isString().isLength({ min: 1 }).withMessage('抽奖码不能为空'),
  query('activity_id').optional().isInt({ min: 1 }).withMessage('活动ID必须是正整数')
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

    const { code } = req.params;
    const { activity_id } = req.query;
    const where = { code };

    if (activity_id) {
      where.activity_id = activity_id;
    }

    const lotteryCode = await LotteryCode.findOne({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'status', 'start_time', 'end_time']
        }
      ]
    });

    if (!lotteryCode) {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: '抽奖码不存在'
        }
      });
    }

    // 检查活动状态
    if (lotteryCode.activity.status !== 'active') {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: '活动已结束或未开始'
        }
      });
    }

    // 检查活动时间
    const now = new Date();
    if (now < lotteryCode.activity.start_time || now > lotteryCode.activity.end_time) {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: '活动不在有效时间内'
        }
      });
    }

    // 检查抽奖码状态
    if (lotteryCode.status === 'used') {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: '抽奖码已被使用'
        }
      });
    }

    if (lotteryCode.status === 'invalid') {
      return res.json({
        success: true,
        data: {
          valid: false,
          message: '抽奖码已作废'
        }
      });
    }

    res.json({
      success: true,
      data: {
        valid: true,
        message: '抽奖码有效',
        lottery_code: {
          id: lotteryCode.id,
          code: lotteryCode.code,
          participant_name: lotteryCode.participant_info?.name || null,
          participant_email: lotteryCode.participant_info?.email || null,
          participant_phone: lotteryCode.participant_info?.phone || null
        },
        activity: {
          id: lotteryCode.activity.id,
          name: lotteryCode.activity.name
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// 获取活动下的抽奖码统计
router.get('/stats/:activity_id', [
  param('activity_id').isInt({ min: 1 }).withMessage('活动ID必须是正整数')
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

    const { activity_id } = req.params;

    // 检查活动是否存在
    const activity = await Activity.findByPk(activity_id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: '活动不存在'
      });
    }

    // 统计抽奖码
    const totalCodes = await LotteryCode.count({
      where: { activity_id }
    });

    const usedCodes = await LotteryCode.count({
      where: { 
        activity_id,
        status: 'used'
      }
    });

    const invalidCodes = await LotteryCode.count({
      where: { 
        activity_id,
        status: 'invalid'
      }
    });

    const unusedCodes = totalCodes - usedCodes - invalidCodes;

    res.json({
      success: true,
      data: {
        activity_id: parseInt(activity_id),
        total_codes: totalCodes,
        used_codes: usedCodes,
        unused_codes: unusedCodes,
        invalid_codes: invalidCodes,
        usage_rate: totalCodes > 0 ? Math.round((usedCodes / totalCodes) * 100) : 0,
        invalid_rate: totalCodes > 0 ? Math.round((invalidCodes / totalCodes) * 100) : 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// 批量验证抽奖码
router.post('/batch-validate', [
  body('codes').isArray({ min: 1, max: 100 }).withMessage('抽奖码数组不能为空且最多100个'),
  body('codes.*').isString().isLength({ min: 1 }).withMessage('抽奖码不能为空'),
  body('activity_id').optional().isInt({ min: 1 }).withMessage('活动ID必须是正整数')
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

    const { codes, activity_id } = req.body;
    const where = { code: { [Op.in]: codes } };

    if (activity_id) {
      where.activity_id = activity_id;
    }

    const lotteryCodes = await LotteryCode.findAll({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'status', 'start_time', 'end_time']
        }
      ]
    });

    const results = codes.map(code => {
      const lotteryCode = lotteryCodes.find(lc => lc.code === code);
      
      if (!lotteryCode) {
        return {
          code,
          valid: false,
          message: '抽奖码不存在'
        };
      }

      // 检查活动状态
      if (lotteryCode.activity.status !== 'active') {
        return {
          code,
          valid: false,
          message: '活动已结束或未开始'
        };
      }

      // 检查活动时间
      const now = new Date();
      if (now < lotteryCode.activity.start_time || now > lotteryCode.activity.end_time) {
        return {
          code,
          valid: false,
          message: '活动不在有效时间内'
        };
      }

      // 检查抽奖码状态
      if (lotteryCode.status === 'used') {
        return {
          code,
          valid: false,
          message: '抽奖码已被使用'
        };
      }

      if (lotteryCode.status === 'invalid') {
        return {
          code,
          valid: false,
          message: '抽奖码已作废'
        };
      }

      return {
        code,
        valid: true,
        message: '抽奖码有效',
        lottery_code_id: lotteryCode.id,
        participant_name: lotteryCode.participant_info?.name || null,
        participant_email: lotteryCode.participant_info?.email || null,
        participant_phone: lotteryCode.participant_info?.phone || null
      };
    });

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: codes.length,
          valid: results.filter(r => r.valid).length,
          invalid: results.filter(r => !r.valid).length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});



module.exports = router;