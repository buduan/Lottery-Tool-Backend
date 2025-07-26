const OperationLog = require('../models/OperationLog');
const logger = require('../utils/logger');

/**
 * 操作日志记录中间件
 * 自动记录用户的操作行为
 */
const logOperation = (operationType, getOperationDetail = null, getTargetInfo = null) => {
  return async (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // 只在操作成功时记录日志
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // 异步记录日志，不阻塞响应
        setImmediate(async () => {
          try {
            let operationDetail = operationType;
            let targetType = null;
            let targetId = null;
            
            // 如果提供了操作详情生成函数
            if (typeof getOperationDetail === 'function') {
              operationDetail = getOperationDetail(req, res, data);
            }
            
            // 如果提供了目标信息生成函数
            if (typeof getTargetInfo === 'function') {
              const targetInfo = getTargetInfo(req, res, data);
              targetType = targetInfo.type;
              targetId = targetInfo.id;
            }
            
            await OperationLog.log({
              user_id: req.user ? req.user.id : null,
              operation_type: operationType,
              operation_detail: operationDetail,
              target_type: targetType,
              target_id: targetId,
              ip_address: req.ip,
              user_agent: req.get('User-Agent')
            });
          } catch (error) {
            logger.error('记录操作日志失败:', error);
          }
        });
      }
      
      return originalSend.call(this, data);
    };
    
    next();
  };
};

/**
 * 记录认证操作日志
 */
const logAuthOperation = (operationType) => {
  return logOperation(
    operationType,
    (req, res, data) => {
      switch (operationType) {
        case OperationLog.OPERATION_TYPES.USER_LOGIN:
          return `用户登录: ${req.body.username}`;
        case OperationLog.OPERATION_TYPES.USER_LOGOUT:
          return '用户登出';
        case OperationLog.OPERATION_TYPES.PASSWORD_CHANGE:
          return '修改密码';
        default:
          return operationType;
      }
    }
  );
};

/**
 * 记录活动操作日志
 */
const logActivityOperation = (operationType) => {
  return logOperation(
    operationType,
    (req, res, data) => {
      const activityName = req.body.name || 
                          (data && JSON.parse(data).data && JSON.parse(data).data.activity && JSON.parse(data).data.activity.name) ||
                          '未知活动';
      
      switch (operationType) {
        case OperationLog.OPERATION_TYPES.CREATE_ACTIVITY:
          return `创建活动: ${activityName}`;
        case OperationLog.OPERATION_TYPES.UPDATE_ACTIVITY:
          return `更新活动: ${activityName}`;
        case OperationLog.OPERATION_TYPES.DELETE_ACTIVITY:
          return `删除活动: ${activityName}`;
        case OperationLog.OPERATION_TYPES.ACTIVATE_ACTIVITY:
          return `激活活动: ${activityName}`;
        case OperationLog.OPERATION_TYPES.END_ACTIVITY:
          return `结束活动: ${activityName}`;
        default:
          return operationType;
      }
    },
    (req, res, data) => {
      const activityId = req.params.id || 
                        (data && JSON.parse(data).data && JSON.parse(data).data.activity && JSON.parse(data).data.activity.id);
      return {
        type: 'ACTIVITY',
        id: activityId
      };
    }
  );
};

/**
 * 记录奖品操作日志
 */
const logPrizeOperation = (operationType) => {
  return logOperation(
    operationType,
    (req, res, data) => {
      const prizeName = req.body.name || 
                       (data && JSON.parse(data).data && JSON.parse(data).data.prize && JSON.parse(data).data.prize.name) ||
                       '未知奖品';
      
      switch (operationType) {
        case OperationLog.OPERATION_TYPES.CREATE_PRIZE:
          return `创建奖品: ${prizeName}`;
        case OperationLog.OPERATION_TYPES.UPDATE_PRIZE:
          return `更新奖品: ${prizeName}`;
        case OperationLog.OPERATION_TYPES.DELETE_PRIZE:
          return `删除奖品: ${prizeName}`;
        default:
          return operationType;
      }
    },
    (req, res, data) => {
      const prizeId = req.params.id || 
                     (data && JSON.parse(data).data && JSON.parse(data).data.prize && JSON.parse(data).data.prize.id);
      return {
        type: 'PRIZE',
        id: prizeId
      };
    }
  );
};

/**
 * 记录抽奖码操作日志
 */
const logLotteryCodeOperation = (operationType) => {
  return logOperation(
    operationType,
    (req, res, data) => {
      switch (operationType) {
        case OperationLog.OPERATION_TYPES.CREATE_LOTTERY_CODE:
          return `创建抽奖码: ${req.body.code}`;
        case OperationLog.OPERATION_TYPES.BATCH_CREATE_LOTTERY_CODE:
          const count = req.body.count || 0;
          return `批量创建抽奖码: ${count}个`;
        case OperationLog.OPERATION_TYPES.IMPORT_LOTTERY_CODE:
          return '导入抽奖码';
        case OperationLog.OPERATION_TYPES.UPDATE_LOTTERY_CODE:
          return '更新抽奖码信息';
        case OperationLog.OPERATION_TYPES.DELETE_LOTTERY_CODE:
          return '删除抽奖码';
        default:
          return operationType;
      }
    },
    (req, res, data) => {
      const activityId = req.params.id;
      return {
        type: 'ACTIVITY',
        id: activityId
      };
    }
  );
};

/**
 * 记录抽奖操作日志
 */
const logLotteryDraw = (operationType) => {
  return logOperation(
    operationType,
    (req, res, data) => {
      try {
        const responseData = JSON.parse(data);
        const isWinner = responseData.data && responseData.data.is_winner;
        const prizeName = responseData.data && responseData.data.prize && responseData.data.prize.name;
        
        if (isWinner && prizeName) {
          return `${operationType === OperationLog.OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖中奖: ${prizeName}`;
        } else {
          return `${operationType === OperationLog.OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖未中奖`;
        }
      } catch (error) {
        return `${operationType === OperationLog.OPERATION_TYPES.ONLINE_LOTTERY ? '线上' : '线下'}抽奖`;
      }
    },
    (req, res, data) => {
      const activityId = req.params.id;
      return {
        type: 'ACTIVITY',
        id: activityId
      };
    }
  );
};

/**
 * 记录用户管理操作日志
 */
const logUserOperation = (operationType) => {
  return logOperation(
    operationType,
    (req, res, data) => {
      const username = req.body.username || 
                      (data && JSON.parse(data).data && JSON.parse(data).data.user && JSON.parse(data).data.user.username) ||
                      '未知用户';
      
      switch (operationType) {
        case OperationLog.OPERATION_TYPES.CREATE_USER:
          return `创建用户: ${username}`;
        case OperationLog.OPERATION_TYPES.UPDATE_USER:
          return `更新用户: ${username}`;
        case OperationLog.OPERATION_TYPES.DELETE_USER:
          return `删除用户: ${username}`;
        default:
          return operationType;
      }
    },
    (req, res, data) => {
      const userId = req.params.id || 
                    (data && JSON.parse(data).data && JSON.parse(data).data.user && JSON.parse(data).data.user.id);
      return {
        type: 'USER',
        id: userId
      };
    }
  );
};

module.exports = {
  logOperation,
  logAuthOperation,
  logActivityOperation,
  logPrizeOperation,
  logLotteryCodeOperation,
  logLotteryDraw,
  logUserOperation
}; 