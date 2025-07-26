const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // 记录错误日志
  logger.error(`Error: ${error.message}`, {
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Sequelize 验证错误
  if (err.name === 'SequelizeValidationError') {
    const message = err.errors.map(val => val.message).join(', ');
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '数据验证失败',
        details: message
      }
    });
  }

  // Sequelize 唯一约束错误
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0].path;
    return res.status(400).json({
      success: false,
      error: {
        code: 'DUPLICATE_ERROR',
        message: `${field} 已存在`,
        details: '数据重复'
      }
    });
  }

  // Sequelize 外键约束错误
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_ERROR',
        message: '关联数据不存在',
        details: '外键约束失败'
      }
    });
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_002',
        message: 'Token无效',
        details: 'JWT验证失败'
      }
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_002',
        message: 'Token已过期',
        details: 'JWT已过期'
      }
    });
  }

  // 语法错误
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_002',
        message: '请求数据格式错误',
        details: 'JSON格式无效'
      }
    });
  }

  // 自定义错误
  if (err.isCustomError) {
    return res.status(err.statusCode || 400).json({
      success: false,
      error: {
        code: err.code || 'CUSTOM_ERROR',
        message: err.message,
        details: err.details
      }
    });
  }

  // 默认服务器错误
  res.status(500).json({
    success: false,
    error: {
      code: 'SYSTEM_003',
      message: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? error.message : '请联系管理员'
    }
  });
};

module.exports = errorHandler; 