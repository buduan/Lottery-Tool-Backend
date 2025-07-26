const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50],
      notEmpty: true
    }
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash'
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'admin'),
    allowNull: false,
    defaultValue: 'admin'
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    allowNull: false,
    defaultValue: 'active'
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
  tableName: 'users',
  timestamps: false, // 我们手动管理时间戳字段
  hooks: {
    beforeUpdate: (user, options) => {
      user.updated_at = new Date();
    }
  }
});

// 实例方法：验证密码
User.prototype.validatePassword = async function(password) {
  return await bcrypt.compare(password, this.password_hash);
};

// 实例方法：设置密码
User.prototype.setPassword = async function(password) {
  this.password_hash = await bcrypt.hash(password, 12);
};

// 实例方法：转换为安全的JSON对象（不包含密码）
User.prototype.toSafeJSON = function() {
  const user = this.toJSON();
  delete user.password_hash;
  return user;
};

// 类方法：通过用户名查找用户
User.findByUsername = async function(username) {
  return await this.findOne({
    where: { username }
  });
};

// 类方法：创建用户
User.createUser = async function(userData) {
  const { username, email, password, role = 'admin' } = userData;
  
  const user = await this.create({
    username,
    email,
    role,
    status: 'active'
  });
  
  await user.setPassword(password);
  await user.save();
  
  return user;
};

module.exports = User; 