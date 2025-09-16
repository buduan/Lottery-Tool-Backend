const { DataTypes, Op } = require('sequelize');
const { sequelize } = require('../config/database');

const Prize = sequelize.define('Prize', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      len: [1, 100],
      notEmpty: true
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  total_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'total_quantity',
    validate: {
      min: 0
    }
  },
  remaining_quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'remaining_quantity',
    validate: {
      min: 0
    }
  },
  probability: {
    type: DataTypes.DECIMAL(5, 4),
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0,
      max: 1
    }
  },
  sort_order: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: 0,
    field: 'sort_order'
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
  tableName: 'prizes',
  timestamps: false,
  hooks: {
    beforeCreate: async (prize, options) => {
      // 如果没有设置剩余数量，默认等于总数量
      if (prize.remaining_quantity === undefined || prize.remaining_quantity === null) {
        prize.remaining_quantity = prize.total_quantity;
      }
      
      // 验证单个奖品概率不超过1
      const currentProbability = parseFloat(prize.probability || 0);
      if (currentProbability > 1) {
        throw new Error('奖品概率不能超过1');
      }
      
      // 验证活动中所有奖品概率总和不超过1
      const existingPrizes = await Prize.findAll({
        where: { activity_id: prize.activity_id },
        transaction: options.transaction
      });
      
      const totalProbability = existingPrizes.reduce((sum, existingPrize) => {
        const p = parseFloat(existingPrize.probability || 0);
        return sum + (isNaN(p) ? 0 : p);
      }, 0) + (isNaN(currentProbability) ? 0 : currentProbability);
      
      if (totalProbability > 1) {
        throw new Error(`添加此奖品后，活动概率总和将超过1（当前总和：${totalProbability.toFixed(4)}）`);
      }
    },
    beforeUpdate: async (prize, options) => {
      prize.updated_at = new Date();
      
      // 确保剩余数量不超过总数量
      if (prize.remaining_quantity > prize.total_quantity) {
        prize.remaining_quantity = prize.total_quantity;
      }
      
      // 如果概率发生变化，进行验证
      if (prize.changed('probability')) {
        // 验证单个奖品概率不超过1
        const currentProbability = parseFloat(prize.probability || 0);
        if (currentProbability > 1) {
          throw new Error('奖品概率不能超过1');
        }
        
        // 验证活动中所有奖品概率总和不超过1
        const existingPrizes = await Prize.findAll({
          where: { 
            activity_id: prize.activity_id,
            id: { [Op.ne]: prize.id }
          },
          transaction: options.transaction
        });
        
        const totalProbability = existingPrizes.reduce((sum, existingPrize) => {
          const p = parseFloat(existingPrize.probability || 0);
          return sum + (isNaN(p) ? 0 : p);
        }, 0) + (isNaN(currentProbability) ? 0 : currentProbability);
        
        if (totalProbability > 1) {
          throw new Error(`修改此奖品概率后，活动概率总和将超过1（当前总和：${totalProbability.toFixed(4)}）`);
        }
      }
    }
  }
});

// 实例方法：检查是否有库存
Prize.prototype.hasStock = function() {
  return this.remaining_quantity > 0;
};

// 实例方法：扣减库存
Prize.prototype.deductStock = async function(quantity = 1, options = {}) {
  if (this.remaining_quantity < quantity) {
    throw new Error('库存不足');
  }
  
  this.remaining_quantity -= quantity;
  await this.save({ transaction: options.transaction });
  
  return this.remaining_quantity;
};

// 实例方法：恢复库存
Prize.prototype.restoreStock = async function(quantity = 1, options = {}) {
  const newQuantity = this.remaining_quantity + quantity;
  
  if (newQuantity > this.total_quantity) {
    throw new Error('恢复库存不能超过总数量');
  }
  
  this.remaining_quantity = newQuantity;
  await this.save({ transaction: options.transaction });
  
  return this.remaining_quantity;
};

// 实例方法：获取中奖率
Prize.prototype.getAwardRate = function() {
  const awardedCount = this.total_quantity - this.remaining_quantity;
  return this.total_quantity > 0 ? (awardedCount / this.total_quantity) : 0;
};

// 类方法：获取活动的奖品列表
Prize.findByActivity = async function(activityId, options = {}) {
  const { includeEmpty = true } = options;
  
  const whereClause = { activity_id: activityId };
  
  if (!includeEmpty) {
    whereClause.remaining_quantity = { [Op.gt]: 0 };
  }
  
  return await this.findAll({
    where: whereClause,
    order: [['sort_order', 'ASC'], ['created_at', 'ASC']]
  });
};

// 类方法：根据概率随机选择奖品
Prize.selectByProbability = async function(activityId, activity = null) {
  // 如果没有传入activity对象，则查询获取
  if (!activity) {
    const Activity = require('./Activity');
    activity = await Activity.findByPk(activityId);
    if (!activity) {
      throw new Error('活动不存在');
    }
  }
  
  // 获取有库存的奖品
  const prizes = await this.findAll({
    where: {
      activity_id: activityId,
      remaining_quantity: { [Op.gt]: 0 }
    },
    order: [['sort_order', 'ASC']]
  });
  
  if (prizes.length === 0) {
    return null; // 没有可用奖品
  }
  
  // 获取抽奖策略
  const lotteryStrategy = activity.settings?.lottery_strategy || 'probability';
  
  if (lotteryStrategy === 'guaranteed') {
    // 100%中奖模式：根据奖品数量分配可能性
    const totalQuantity = prizes.reduce((sum, prize) => sum + prize.remaining_quantity, 0);
    
    if (totalQuantity === 0) {
      return null; // 没有库存
    }
    
    // 生成随机数
    const random = Math.random() * totalQuantity;
    
    // 根据数量权重选择奖品
    let currentWeight = 0;
    for (const prize of prizes) {
      currentWeight += prize.remaining_quantity;
      if (random <= currentWeight) {
        return prize;
      }
    }
    
    // 如果没有选中任何奖品，返回最后一个
    return prizes[prizes.length - 1];
  } else {
    // 概率模式：根据设置的概率选择奖品
    // 先计算已设置的总概率与未设置（为0）的奖品
    const explicitPrizes = [];
    const zeroPrizes = [];
    let explicitTotal = 0;
    for (const prize of prizes) {
      const p = parseFloat(prize.probability || 0);
      if (p > 0) {
      explicitPrizes.push({ prize, probability: p });
      explicitTotal += p;
      } else {
      zeroPrizes.push(prize);
      }
    }

    // 如果总概率大于1，直接报错
    if (explicitTotal > 1) {
      throw new Error('活动奖品概率总和超过1');
    }

    let effectiveEntries = [];
    const remainder = 1 - explicitTotal;

    if (zeroPrizes.length > 0 && remainder > 0) {
      // 平分剩余概率时，按剩余库存权重分配
      const totalStock = zeroPrizes.reduce((sum, prize) => sum + prize.remaining_quantity, 0);
      if (totalStock > 0) {
      for (const prize of zeroPrizes) {
        const weight = prize.remaining_quantity / totalStock;
        effectiveEntries.push({ prize, probability: remainder * weight });
      }
      } else {
      // 所有零概率奖品都无库存，理论不会出现
      }
    }
    effectiveEntries = effectiveEntries.concat(explicitPrizes);

    // 计算累积概率（基于0-1的随机数）
    let cumulative = 0;
    const cumulativeProbabilities = effectiveEntries.map(item => {
      cumulative += item.probability;
      return { prize: item.prize, cumulativeProbability: cumulative };
    });

    const totalEffective = cumulative;

    // 生成[0,1)的随机数
    const random = Math.random();

    // 如果随机数超过总有效概率，判定为未中奖
    if (random > totalEffective) {
      return null;
    }

    // 根据随机数选择奖品
    for (const item of cumulativeProbabilities) {
      if (random <= item.cumulativeProbability) {
      return item.prize;
      }
    }

    return null;
  }
};

// 类方法：验证活动奖品概率总和
Prize.validateProbabilities = async function(activityId) {
  const prizes = await this.findAll({
    where: { activity_id: activityId }
  });
  
  const totalProbability = prizes.reduce((sum, prize) => {
    return sum + parseFloat(prize.probability);
  }, 0);
  
  return {
    isValid: totalProbability <= 1,
    totalProbability: parseFloat(totalProbability.toFixed(4)),
    prizes: prizes.length
  };
};

module.exports = Prize;