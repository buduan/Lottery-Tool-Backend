const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { User, Activity, LotteryCode, LotteryRecord } = require('../models');
const { Op } = require('sequelize');

// 所有dashboard路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * @route   GET /api/dashboard
 * @desc    获取仪表盘统计数据
 * @access  Private (Admin/Super Admin)
 */
router.get('/', async (req, res, next) => {
  try {
    const user = req.user;
    let dashboardData = {};

    if (user.role === 'super_admin') {
      // 超级管理员：返回系统中活动总数、抽奖码总数、管理员总数、抽奖记录总数
      const [totalActivities, totalLotteryCodes, totalAdmins, totalLotteryRecords] = await Promise.all([
        Activity.count(),
        LotteryCode.count(),
        User.count({
          where: {
            role: {
              [Op.in]: ['admin', 'super_admin']
            }
          }
        }),
        LotteryRecord.count()
      ]);

      dashboardData = {
        totalActivities,
        totalLotteryCodes,
        totalAdmins,
        totalLotteryRecords
      };
    } else {
      // 管理员：返回此用户创建的活动总数、抽奖码总数、抽奖记录总数、和系统中用户总数
      const [userActivities, userLotteryCodes, userLotteryRecords, totalUsers] = await Promise.all([
        Activity.count({
          where: {
            created_by: user.id
          }
        }),
        LotteryCode.count({
          include: [{
            model: Activity,
            as: 'activity',
            where: {
              created_by: user.id
            }
          }]
        }),
        LotteryRecord.count({
          include: [{
            model: Activity,
            as: 'activity',
            where: {
              created_by: user.id
            }
          }]
        }),
        User.count()
      ]);

      dashboardData = {
        userActivities,
        userLotteryCodes,
        userLotteryRecords,
        totalUsers
      };
    }

    res.json({
      success: true,
      data: dashboardData,
      message: '仪表盘数据获取成功'
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;