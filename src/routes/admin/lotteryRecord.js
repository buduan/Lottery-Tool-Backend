const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const { LotteryRecord, Activity, Prize, LotteryCode, User } = require('../../models');
const { Op } = require('sequelize');
const { logOperation } = require('../../middleware/operationLogger');
const moment = require('moment');

// 获取抽奖记录列表
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须是正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('activity_id').optional().isInt({ min: 1 }).withMessage('活动ID必须是正整数'),
  query('prize_id').optional().isInt({ min: 1 }).withMessage('奖品ID必须是正整数'),
  query('lottery_code').optional().isString().withMessage('抽奖码必须是字符串'),
  query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式不正确'),
  query('draw_type').optional().isIn(['online', 'offline']).withMessage('抽奖类型必须是online或offline')
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
      activity_id,
      prize_id,
      lottery_code,
      start_date,
      end_date,
      draw_type
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // 构建查询条件
    if (activity_id) where.activity_id = activity_id;
    if (prize_id) where.prize_id = prize_id;
    if (lottery_code) where.lottery_code = { [Op.like]: `%${lottery_code}%` };
    if (draw_type) where.draw_type = draw_type;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    const { count, rows } = await LotteryRecord.findAndCountAll({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'status']
        },
        {
          model: Prize,
          as: 'prize',
          attributes: ['id', 'name', 'type', 'value']
        },
        {
          model: LotteryCode,
          as: 'lotteryCode',
          attributes: ['id', 'code', 'participant_name', 'participant_email', 'participant_phone']
        },
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
        records: rows,
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

// 获取抽奖记录详情
router.get('/:id', [
  param('id').isInt({ min: 1 }).withMessage('记录ID必须是正整数')
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

    const record = await LotteryRecord.findByPk(id, {
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['id', 'name', 'status', 'start_time', 'end_time']
        },
        {
          model: Prize,
          as: 'prize',
          attributes: ['id', 'name', 'type', 'value', 'description']
        },
        {
          model: LotteryCode,
          as: 'lotteryCode',
          attributes: ['id', 'code', 'participant_name', 'participant_email', 'participant_phone']
        },
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '抽奖记录不存在'
      });
    }

    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
});

// 删除抽奖记录
router.delete('/:id', [
  param('id').isInt({ min: 1 }).withMessage('记录ID必须是正整数')
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

    const record = await LotteryRecord.findByPk(id, {
      include: [
        { model: Activity, as: 'activity' },
        { model: Prize, as: 'prize' },
        { model: LotteryCode, as: 'lotteryCode' }
      ]
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '抽奖记录不存在'
      });
    }

    // 恢复奖品库存
    if (record.prize) {
      await record.prize.restoreStock(1);
    }

    // 标记抽奖码为未使用
    if (record.lotteryCode) {
      await record.lotteryCode.markAsUnused();
    }

    // 删除记录
    await record.destroy();

    // 记录操作日志
    logOperation(req.user.id, 'delete_lottery_record', {
      record_id: id,
      activity_id: record.activity_id,
      prize_id: record.prize_id,
      lottery_code: record.lottery_code
    });

    res.json({
      success: true,
      message: '抽奖记录删除成功'
    });
  } catch (error) {
    next(error);
  }
});

// 批量删除抽奖记录
router.delete('/', [
  body('ids').isArray({ min: 1 }).withMessage('必须提供要删除的记录ID数组'),
  body('ids.*').isInt({ min: 1 }).withMessage('记录ID必须是正整数')
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

    const { ids } = req.body;

    const records = await LotteryRecord.findAll({
      where: { id: { [Op.in]: ids } },
      include: [
        { model: Prize, as: 'prize' },
        { model: LotteryCode, as: 'lotteryCode' }
      ]
    });

    if (records.length === 0) {
      return res.status(404).json({
        success: false,
        message: '未找到要删除的抽奖记录'
      });
    }

    // 批量处理
    for (const record of records) {
      // 恢复奖品库存
      if (record.prize) {
        await record.prize.restoreStock(1);
      }

      // 标记抽奖码为未使用
      if (record.lotteryCode) {
        await record.lotteryCode.markAsUnused();
      }
    }

    // 批量删除记录
    await LotteryRecord.destroy({
      where: { id: { [Op.in]: ids } }
    });

    // 记录操作日志
    logOperation(req.user.id, 'batch_delete_lottery_records', {
      record_ids: ids,
      count: records.length
    });

    res.json({
      success: true,
      message: `成功删除 ${records.length} 条抽奖记录`
    });
  } catch (error) {
    next(error);
  }
});

// 导出抽奖记录
router.get('/export/csv', [
  query('activity_id').optional().isInt({ min: 1 }).withMessage('活动ID必须是正整数'),
  query('start_date').optional().isISO8601().withMessage('开始日期格式不正确'),
  query('end_date').optional().isISO8601().withMessage('结束日期格式不正确'),
  query('draw_type').optional().isIn(['online', 'offline']).withMessage('抽奖类型必须是online或offline')
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

    const { activity_id, start_date, end_date, draw_type } = req.query;
    const where = {};

    // 构建查询条件
    if (activity_id) where.activity_id = activity_id;
    if (draw_type) where.draw_type = draw_type;
    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) where.created_at[Op.gte] = new Date(start_date);
      if (end_date) where.created_at[Op.lte] = new Date(end_date);
    }

    const records = await LotteryRecord.findAll({
      where,
      include: [
        {
          model: Activity,
          as: 'activity',
          attributes: ['name']
        },
        {
          model: Prize,
          as: 'prize',
          attributes: ['name', 'type', 'value']
        },
        {
          model: LotteryCode,
          as: 'lotteryCode',
          attributes: ['code', 'participant_name', 'participant_email', 'participant_phone']
        },
        {
          model: User,
          as: 'user',
          attributes: ['username', 'email']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // 生成CSV内容
    const csvHeaders = [
      '记录ID',
      '活动名称',
      '抽奖码',
      '参与者姓名',
      '参与者邮箱',
      '参与者电话',
      '奖品名称',
      '奖品类型',
      '奖品价值',
      '抽奖类型',
      '抽奖用户',
      '抽奖时间'
    ];

    const csvRows = records.map(record => [
      record.id,
      record.activity?.name || '',
      record.lottery_code,
      record.lotteryCode?.participant_name || '',
      record.lotteryCode?.participant_email || '',
      record.lotteryCode?.participant_phone || '',
      record.prize?.name || '',
      record.prize?.type || '',
      record.prize?.value || '',
      record.draw_type === 'online' ? '线上抽奖' : '线下抽奖',
      record.user?.username || '',
      moment(record.created_at).format('YYYY-MM-DD HH:mm:ss')
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // 设置响应头
    const filename = `抽奖记录_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // 记录操作日志
    logOperation(req.user.id, 'export_lottery_records', {
      activity_id,
      start_date,
      end_date,
      draw_type,
      count: records.length
    });

    res.send(csvContent);
  } catch (error) {
    next(error);
  }
});

// 获取抽奖统计信息
router.get('/stats/overview', async (req, res, next) => {
  try {
    const totalRecords = await LotteryRecord.count();
    const onlineRecords = await LotteryRecord.count({ where: { draw_type: 'online' } });
    const offlineRecords = await LotteryRecord.count({ where: { draw_type: 'offline' } });

    // 今日抽奖记录
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = await LotteryRecord.count({
      where: {
        created_at: {
          [Op.gte]: today
        }
      }
    });

    // 本周抽奖记录
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekRecords = await LotteryRecord.count({
      where: {
        created_at: {
          [Op.gte]: weekStart
        }
      }
    });

    // 本月抽奖记录
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthRecords = await LotteryRecord.count({
      where: {
        created_at: {
          [Op.gte]: monthStart
        }
      }
    });

    res.json({
      success: true,
      data: {
        total_records: totalRecords,
        online_records: onlineRecords,
        offline_records: offlineRecords,
        today_records: todayRecords,
        week_records: weekRecords,
        month_records: monthRecords
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router; 