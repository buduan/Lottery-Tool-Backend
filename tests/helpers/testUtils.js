const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../../src/models');

// 测试工具函数
class TestUtils {
  // 生成测试JWT token
  static generateTestToken(userId = 1, role = 'super_admin') {
    return jwt.sign(
      { id: userId, role },
      process.env.JWT_SECRET || 'test-secret-key',
      { expiresIn: '1h' }
    );
  }

  // 创建测试用户
  static async createTestUser(userData = {}) {
    const defaultData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin',
      status: 'active'
    };

    const userDataToUse = { ...defaultData, ...userData };
    
    // 使用User模型的createUser方法
    return await User.createUser(userDataToUse);
  }

  // 清理测试用户
  static async cleanupTestUser(username) {
    await User.destroy({
      where: { username }
    });
  }

  // 生成随机字符串
  static generateRandomString(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 生成随机邮箱
  static generateRandomEmail() {
    return `test_${this.generateRandomString(8)}@example.com`;
  }

  // 生成随机手机号
  static generateRandomPhone() {
    return `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
  }

  // 等待指定时间
  static async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 验证响应格式
  static validateResponseFormat(response) {
    expect(response).toHaveProperty('success');
    expect(typeof response.success).toBe('boolean');
    
    if (response.success) {
      expect(response).toHaveProperty('data');
    } else {
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
    }
  }

  // 验证分页格式
  static validatePaginationFormat(pagination) {
    expect(pagination).toHaveProperty('total');
    expect(pagination).toHaveProperty('page');
    expect(pagination).toHaveProperty('limit');
    expect(pagination).toHaveProperty('totalPages');
    
    expect(typeof pagination.total).toBe('number');
    expect(typeof pagination.page).toBe('number');
    expect(typeof pagination.limit).toBe('number');
    expect(typeof pagination.totalPages).toBe('number');
  }
}

module.exports = TestUtils; 