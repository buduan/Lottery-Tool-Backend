const { sequelize } = require('../config/database');

// 导入所有模型
const User = require('./User');
const Activity = require('./Activity');
const Prize = require('./Prize');
const LotteryCode = require('./LotteryCode');
const LotteryRecord = require('./LotteryRecord');
const OperationLog = require('./OperationLog');

// 设置模型关联关系

// User 与 Activity 的关联
User.hasMany(Activity, {
  foreignKey: 'created_by',
  as: 'activities'
});
Activity.belongsTo(User, {
  foreignKey: 'created_by',
  as: 'creator'
});

// Activity 与 Prize 的关联
Activity.hasMany(Prize, {
  foreignKey: 'activity_id',
  as: 'prizes',
  onDelete: 'CASCADE'
});
Prize.belongsTo(Activity, {
  foreignKey: 'activity_id',
  as: 'activity'
});

// Activity 与 LotteryCode 的关联
Activity.hasMany(LotteryCode, {
  foreignKey: 'activity_id',
  as: 'lottery_codes',
  onDelete: 'CASCADE'
});
LotteryCode.belongsTo(Activity, {
  foreignKey: 'activity_id',
  as: 'activity'
});

// Activity 与 LotteryRecord 的关联
Activity.hasMany(LotteryRecord, {
  foreignKey: 'activity_id',
  as: 'lottery_records',
  onDelete: 'CASCADE'
});
LotteryRecord.belongsTo(Activity, {
  foreignKey: 'activity_id',
  as: 'activity'
});

// LotteryCode 与 LotteryRecord 的关联
LotteryCode.hasMany(LotteryRecord, {
  foreignKey: 'lottery_code_id',
  as: 'lottery_records',
  onDelete: 'CASCADE'
});
LotteryRecord.belongsTo(LotteryCode, {
  foreignKey: 'lottery_code_id',
  as: 'lotteryCode'
});

// Prize 与 LotteryRecord 的关联
Prize.hasMany(LotteryRecord, {
  foreignKey: 'prize_id',
  as: 'lottery_records',
  onDelete: 'SET NULL'
});
LotteryRecord.belongsTo(Prize, {
  foreignKey: 'prize_id',
  as: 'prize'
});

// User 与 LotteryRecord 的关联（操作员）
User.hasMany(LotteryRecord, {
  foreignKey: 'operator_id',
  as: 'operated_lottery_records',
  onDelete: 'SET NULL'
});
LotteryRecord.belongsTo(User, {
  foreignKey: 'operator_id',
  as: 'operator'
});

// User 与 OperationLog 的关联
User.hasMany(OperationLog, {
  foreignKey: 'user_id',
  as: 'operation_logs'
});
OperationLog.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user'
});

// 导出所有模型
const models = {
  User,
  Activity,
  Prize,
  LotteryCode,
  LotteryRecord,
  OperationLog,
  sequelize
};

// 同步数据库（开发环境）
if (process.env.NODE_ENV === 'development') {
  sequelize.sync({ alter: false }).then(() => {
    console.log('数据库模型同步完成');
  }).catch(err => {
    console.error('数据库模型同步失败:', err);
  });
}

module.exports = models; 