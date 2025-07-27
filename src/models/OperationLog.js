const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const OperationLog = sequelize.define('OperationLog', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'user_id',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  operation_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'operation_type'
  },
  operation_detail: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'operation_detail'
  },
  target_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'target_type'
  },
  target_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'target_id'
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address'
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'user_agent'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  }
}, {
  tableName: 'operation_logs',
  timestamps: false
});

// 操作类型常量
const OPERATION_TYPES = {
  // 认证相关
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTER: 'USER_REGISTER',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // 活动管理
  CREATE_ACTIVITY: 'CREATE_ACTIVITY',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  DELETE_ACTIVITY: 'DELETE_ACTIVITY',
  ACTIVATE_ACTIVITY: 'ACTIVATE_ACTIVITY',
  END_ACTIVITY: 'END_ACTIVITY',

  // 奖品管理
  CREATE_PRIZE: 'CREATE_PRIZE',
  UPDATE_PRIZE: 'UPDATE_PRIZE',
  DELETE_PRIZE: 'DELETE_PRIZE',

  // 抽奖码管理
  CREATE_LOTTERY_CODE: 'CREATE_LOTTERY_CODE',
  BATCH_CREATE_LOTTERY_CODE: 'BATCH_CREATE_LOTTERY_CODE',
  IMPORT_LOTTERY_CODE: 'IMPORT_LOTTERY_CODE',
  UPDATE_LOTTERY_CODE: 'UPDATE_LOTTERY_CODE',
  DELETE_LOTTERY_CODE: 'DELETE_LOTTERY_CODE',
  INVALIDATE_LOTTERY_CODE: 'INVALIDATE_LOTTERY_CODE',
  BATCH_INVALIDATE_LOTTERY_CODE: 'BATCH_INVALIDATE_LOTTERY_CODE',

  // 抽奖操作
  ONLINE_LOTTERY: 'ONLINE_LOTTERY',
  OFFLINE_LOTTERY: 'OFFLINE_LOTTERY',

  // 系统管理
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  SYSTEM_BACKUP: 'SYSTEM_BACKUP',
  SYSTEM_RESTORE: 'SYSTEM_RESTORE',

  // Webhook操作
  WEBHOOK_CREATE_LOTTERY_CODE: 'WEBHOOK_CREATE_LOTTERY_CODE'
};

// 类方法：记录操作日志
OperationLog.log = async function(data) {
  const {
    user_id,
    operation_type,
    operation_detail,
    target_type = null,
    target_id = null,
    ip_address = null,
    user_agent = null
  } = data;

  return await this.create({
    user_id,
    operation_type,
    operation_detail,
    target_type,
    target_id,
    ip_address,
    user_agent
  });
};

// 类方法：记录用户登录
OperationLog.logUserLogin = async function(userId, ipAddress, userAgent) {
  return await this.log({
    user_id: userId,
    operation_type: OPERATION_TYPES.USER_LOGIN,
    operation_detail: '用户登录',
    ip_address: ipAddress,
    user_agent: userAgent
  });
};

// 类方法：记录用户登出
OperationLog.logUserLogout = async function(userId, ipAddress, userAgent) {
  return await this.log({
    user_id: userId,
    operation_type: OPERATION_TYPES.USER_LOGOUT,
    operation_detail: '用户登出',
    ip_address: ipAddress,
    user_agent: userAgent
  });
};

// 类方法：记录活动操作
OperationLog.logActivityOperation = async function(operationType, userId, activityId, activityName, ipAddress, userAgent) {
  const operationDetails = {
    [OPERATION_TYPES.CREATE_ACTIVITY]: `创建活动: ${activityName}`,
    [OPERATION_TYPES.UPDATE_ACTIVITY]: `更新活动: ${activityName}`,
    [OPERATION_TYPES.DELETE_ACTIVITY]: `删除活动: ${activityName}`,
    [OPERATION_TYPES.ACTIVATE_ACTIVITY]: `激活活动: ${activityName}`,
    [OPERATION_TYPES.END_ACTIVITY]: `结束活动: ${activityName}`
  };

  return await this.log({
    user_id: userId,
    operation_type: operationType,
    operation_detail: operationDetails[operationType],
    target_type: 'ACTIVITY',
    target_id: activityId,
    ip_address: ipAddress,
    user_agent: userAgent
  });
};

// 类方法：记录抽奖操作
OperationLog.logLotteryOperation = async function(operationType, userId, activityId, lotteryCodeId, prizeName, ipAddress, userAgent) {
  const isWinner = !!prizeName;
  const detail = isWinner ? 
    `${operationType === OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖中奖: ${prizeName}` :
    `${operationType === OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖未中奖`;

  return await this.log({
    user_id: userId,
    operation_type: operationType,
    operation_detail: detail,
    target_type: 'LOTTERY_RECORD',
    target_id: lotteryCodeId,
    ip_address: ipAddress,
    user_agent: userAgent
  });
};

// 类方法：获取操作日志列表
OperationLog.getList = async function(options = {}) {
  const {
    page = 1,
    limit = 20,
    user_id,
    operation_type,
    target_type,
    start_date,
    end_date
  } = options;

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (user_id) {
    whereClause.user_id = user_id;
  }

  if (operation_type) {
    whereClause.operation_type = operation_type;
  }

  if (target_type) {
    whereClause.target_type = target_type;
  }

  if (start_date) {
    whereClause.created_at = { [Op.gte]: new Date(start_date) };
  }

  if (end_date) {
    if (whereClause.created_at) {
      whereClause.created_at[Op.lte] = new Date(end_date);
    } else {
      whereClause.created_at = { [Op.lte]: new Date(end_date) };
    }
  }

  const { count, rows } = await this.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: require('./User'),
        as: 'user',
        required: false,
        attributes: ['id', 'username']
      }
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });

  return {
    logs: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

// 类方法：获取操作类型统计
OperationLog.getOperationTypeStatistics = async function() {
  const stats = await this.findAll({
    attributes: [
      'operation_type',
      [sequelize.fn('COUNT', sequelize.col('operation_type')), 'count']
    ],
    group: ['operation_type'],
    order: [[sequelize.fn('COUNT', sequelize.col('operation_type')), 'DESC']],
    raw: true
  });

  return stats;
};

// 类方法：清理指定天数前的日志
OperationLog.cleanup = async function(days) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const deletedCount = await this.destroy({
    where: {
      created_at: { [Op.lt]: cutoffDate }
    }
  });

  return deletedCount;
};

// 类方法：获取用户操作统计
OperationLog.getUserStatistics = async function(userId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await this.findAll({
    where: {
      user_id: userId,
      created_at: { [Op.gte]: startDate }
    },
    attributes: [
      'operation_type',
      [sequelize.fn('COUNT', sequelize.col('operation_type')), 'count'],
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date']
    ],
    group: ['operation_type', sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [['date', 'ASC']],
    raw: true
  });

  return stats;
};

// 设置关联关系
OperationLog.associate = function(models) {
  OperationLog.belongsTo(models.User, {
    foreignKey: 'user_id',
    as: 'user'
  });
};

// 导出操作类型常量
OperationLog.OPERATION_TYPES = OPERATION_TYPES;

module.exports = OperationLog;