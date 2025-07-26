const express = require('express');
const router = express.Router();

const { authenticateToken, requireAdmin } = require('../middleware/auth');

// 所有admin路由都需要认证和管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 子路由
router.use('/activities', require('./admin/activities'));
router.use('/prizes', require('./admin/prizes'));
router.use('/lottery-codes', require('./admin/lotteryCode'));
router.use('/lottery-records', require('./admin/lotteryRecord'));

module.exports = router; 