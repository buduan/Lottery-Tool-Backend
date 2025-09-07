const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const LotteryCode = sequelize.define('LotteryCode', {
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
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      len: [1, 50],
      notEmpty: true
    }
  },
  status: {
    type: DataTypes.ENUM('unused', 'used', 'invalid'),
    allowNull: false,
    defaultValue: 'unused'
  },
  participant_info: {
    type: DataTypes.JSON,
    allowNull: true,
    field: 'participant_info',
    comment: '参与者信息：name, phone, email等'
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'used_at'
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'created_at'
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'updated_at'
  }
}, {
  tableName: 'lottery_codes',
  timestamps: false,
  indexes: [
    {
      unique: true,
      fields: ['activity_id', 'code'],
      name: 'unique_activity_code'
    }
  ],
  hooks: {
    beforeUpdate: (lotteryCode, options) => {
      lotteryCode.updated_at = new Date();
      
      // 如果状态从unused变为used，设置使用时间
      if (lotteryCode.changed('status') && lotteryCode.status === 'used' && !lotteryCode.used_at) {
        lotteryCode.used_at = new Date();
      }
    }
  }
});

// 实例方法：检查是否已使用
LotteryCode.prototype.isUsed = function() {
  return this.status === 'used';
};

// 实例方法：标记为已使用
LotteryCode.prototype.markAsUsed = async function(options = {}) {
  if (this.status === 'used') {
    throw new Error('抽奖码已经使用过了');
  }
  
  this.status = 'used';
  this.used_at = new Date();
  await this.save({ transaction: options.transaction });
  
  return this;
};

// 实例方法：重置为未使用
LotteryCode.prototype.markAsUnused = async function() {
  this.status = 'unused';
  this.used_at = null;
  await this.save();
  
  return this;
};

// 实例方法：标记为作废
LotteryCode.prototype.markAsInvalid = async function() {
  if (this.status === 'invalid') {
    throw new Error('抽奖码已经作废了');
  }
  
  this.status = 'invalid';
  await this.save();
  
  return this;
};

// 实例方法：更新参与者信息
LotteryCode.prototype.updateParticipantInfo = async function(participantInfo) {
  this.participant_info = participantInfo;
  await this.save();
  
  return this;
};

// 实例方法：获取参与者信息
LotteryCode.prototype.getParticipantInfo = function() {
  return this.participant_info || {};
};

// 类方法：通过活动ID和抽奖码查找
LotteryCode.findByActivityAndCode = async function(activityId, code) {
  return await this.findOne({
    where: {
      activity_id: activityId,
      code: code
    }
  });
};

// 类方法：获取活动的抽奖码列表
LotteryCode.findByActivity = async function(activityId, options = {}) {
  const { 
    page = 1, 
    limit = 20, 
    search, 
    status, 
    has_participant_info 
  } = options;
  
  const offset = (page - 1) * limit;
  const whereClause = { activity_id: activityId };
  
  if (status) {
    whereClause.status = status;
  }
  
  if (has_participant_info !== undefined) {
    if (has_participant_info) {
      whereClause.participant_info = { [Op.ne]: null };
    } else {
      whereClause.participant_info = { [Op.is]: null };
    }
  }
  
  if (search) {
    whereClause[Op.or] = [
      { code: { [Op.like]: `%${search}%` } },
      sequelize.literal(`JSON_EXTRACT(participant_info, '$.name') LIKE '%${search}%'`),
      sequelize.literal(`JSON_EXTRACT(participant_info, '$.phone') LIKE '%${search}%'`),
      sequelize.literal(`JSON_EXTRACT(participant_info, '$.email') LIKE '%${search}%'`)
    ];
  }
  
  const { count, rows } = await this.findAndCountAll({
    where: whereClause,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
  
  return {
    lottery_codes: rows,
    pagination: {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    }
  };
};

// 类方法：批量创建抽奖码
LotteryCode.createBatch = async function(activityId, codes, participantInfoList = []) {
  const lotteryCodeData = codes.map((code, index) => ({
    activity_id: activityId,
    code: code,
    participant_info: participantInfoList[index] || null,
    status: 'unused'
  }));
  
  return await this.bulkCreate(lotteryCodeData, {
    validate: true,
    ignoreDuplicates: false
  });
};

// 类方法：检查抽奖码是否已存在
LotteryCode.checkDuplicates = async function(activityId, codes) {
  const existingCodes = await this.findAll({
    where: {
      activity_id: activityId,
      code: { [Op.in]: codes }
    },
    attributes: ['code']
  });
  
  return existingCodes.map(item => item.code);
};

// 类方法：获取活动的已使用抽奖码
LotteryCode.getUsedCodes = async function(activityId) {
  return await this.findAll({
    where: {
      activity_id: activityId,
      status: 'used'
    },
    order: [['used_at', 'DESC']]
  });
};

// 类方法：获取活动抽奖码统计
LotteryCode.getStatistics = async function(activityId) {
  const [totalCount, usedCount] = await Promise.all([
    this.count({ where: { activity_id: activityId } }),
    this.count({ where: { activity_id: activityId, status: 'used' } })
  ]);
  
  const unusedCount = totalCount - usedCount;
  const usageRate = totalCount > 0 ? ((usedCount / totalCount) * 100).toFixed(2) : '0.00';
  
  return {
    total_count: totalCount,
    used_count: usedCount,
    unused_count: unusedCount,
    usage_rate: usageRate
  };
};

// 类方法：获取活动的所有抽奖码（用于去重检查）
LotteryCode.getAllCodesForActivity = async function(activityId) {
  const codes = await this.findAll({
    where: { activity_id: activityId },
    attributes: ['code']
  });
  
  return codes.map(item => item.code);
};

module.exports = LotteryCode;