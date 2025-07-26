const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const LotteryRecord = sequelize.define('LotteryRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  activity_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'activity_id',
    references: {
      model: 'activities',
      key: 'id'
    }
  },
  lottery_code_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'lottery_code_id',
    references: {
      model: 'lottery_codes',
      key: 'id'
    }
  },
  prize_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'prize_id',
    references: {
      model: 'prizes',
      key: 'id'
    }
  },
  is_winner: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_winner'
  },
  operator_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'operator_id',
    references: {
      model: 'users',
      key: 'id'
    },
    comment: '线下抽奖时的操作员ID'
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
  tableName: 'lottery_records',
  timestamps: false
});

// 实例方法：检查是否中奖
LotteryRecord.prototype.isWinning = function() {
  return this.is_winner && this.prize_id;
};

// 实例方法：获取抽奖类型
LotteryRecord.prototype.getLotteryType = function() {
  return this.operator_id ? 'offline' : 'online';
};

// 类方法：创建抽奖记录
LotteryRecord.createRecord = async function(data) {
  const {
    activity_id,
    lottery_code_id,
    prize_id = null,
    is_winner = false,
    operator_id = null,
    ip_address = null,
    user_agent = null
  } = data;
  
  return await this.create({
    activity_id,
    lottery_code_id,
    prize_id,
    is_winner,
    operator_id,
    ip_address,
    user_agent
  });
};

// 类方法：获取活动的抽奖记录
LotteryRecord.findByActivity = async function(activityId, options = {}) {
  const {
    page = 1,
    limit = 20,
    winner_only = false,
    participant_name,
    lottery_code,
    start_date,
    end_date
  } = options;
  
  const offset = (page - 1) * limit;
  const whereClause = { activity_id: activityId };
  
  if (winner_only) {
    whereClause.is_winner = true;
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
  
  const include = [
    {
      model: require('./LotteryCode'),
      as: 'lotteryCode',
      required: true
    },
    {
      model: require('./Prize'),
      as: 'prize',
      required: false
    },
    {
      model: require('./Activity'),
      as: 'activity',
      required: true
    }
  ];
  
  // 如果有参与者姓名搜索，添加条件
  if (participant_name) {
    include[0].where = sequelize.literal(
      `JSON_EXTRACT(participant_info, '$.name') LIKE '%${participant_name}%'`
    );
  }
  
  // 如果有抽奖码搜索，添加条件
  if (lottery_code) {
    include[0].where = {
      ...(include[0].where || {}),
      code: { [Op.like]: `%${lottery_code}%` }
    };
  }
  
  const { count, rows } = await this.findAndCountAll({
    where: whereClause,
    include,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset),
    distinct: true
  });
  
  return {
    records: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

// 类方法：获取管理员的抽奖记录
LotteryRecord.findByOperator = async function(operatorId, options = {}) {
  const { page = 1, limit = 20, activity_id } = options;
  const offset = (page - 1) * limit;
  
  const whereClause = { operator_id: operatorId };
  
  if (activity_id) {
    whereClause.activity_id = activity_id;
  }
  
  const { count, rows } = await this.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: require('./LotteryCode'),
        as: 'lotteryCode',
        required: true
      },
      {
        model: require('./Prize'),
        as: 'prize',
        required: false
      },
      {
        model: require('./Activity'),
        as: 'activity',
        required: true
      }
    ],
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
  
  return {
    records: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

// 类方法：获取中奖记录统计
LotteryRecord.getWinningStatistics = async function(activityId, options = {}) {
  const { start_date, end_date } = options;
  
  const whereClause = {
    activity_id: activityId,
    is_winner: true
  };
  
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
  
  // 按奖品分组统计
  const prizeStats = await this.findAll({
    where: whereClause,
    include: [
      {
        model: require('./Prize'),
        as: 'prize',
        required: true
      }
    ],
    attributes: [
      'prize_id',
      [sequelize.fn('COUNT', sequelize.col('LotteryRecord.id')), 'count']
    ],
    group: ['prize_id', 'prize.id'],
    raw: false
  });
  
  // 按日期分组统计
  const dailyStats = await this.findAll({
    where: whereClause,
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: [sequelize.fn('DATE', sequelize.col('created_at'))],
    order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
    raw: true
  });
  
  const totalWinners = await this.count({ where: whereClause });
  
  return {
    total_winners: totalWinners,
    prize_statistics: prizeStats,
    daily_statistics: dailyStats
  };
};

// 类方法：获取抽奖记录总数
LotteryRecord.getTotalRecords = async function(activityId) {
  return await this.count({
    where: { activity_id: activityId }
  });
};

// 类方法：获取中奖记录总数
LotteryRecord.getTotalWinners = async function(activityId) {
  return await this.count({
    where: {
      activity_id: activityId,
      is_winner: true
    }
  });
};

// 类方法：检查抽奖码是否已抽奖
LotteryRecord.hasDrawn = async function(lotteryCodeId) {
  const record = await this.findOne({
    where: { lottery_code_id: lotteryCodeId }
  });
  
  return !!record;
};

module.exports = LotteryRecord; 