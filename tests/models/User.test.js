const bcrypt = require('bcryptjs');
const { User } = require('../../src/models');
const TestUtils = require('../helpers/testUtils');

describe('User模型测试', () => {
  afterEach(async () => {
    // 清理测试数据
    await User.destroy({
      where: {
        username: {
          [require('sequelize').Op.like]: 'test%'
        }
      }
    });
  });

  describe('用户创建', () => {
    it('应该成功创建用户', async () => {
      const userData = {
        username: 'testuser1',
        email: 'testuser1@example.com',
        password: 'password123',
        role: 'admin',
        status: 'active'
      };

      const user = await User.create(userData);

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.username).toBe(userData.username);
      expect(user.email).toBe(userData.email);
      expect(user.role).toBe(userData.role);
      expect(user.status).toBe(userData.status);
      expect(user.created_at).toBeDefined();
      expect(user.updated_at).toBeDefined();

      // 验证密码已加密
      expect(user.password).not.toBe(userData.password);
      const isPasswordValid = await bcrypt.compare(userData.password, user.password);
      expect(isPasswordValid).toBe(true);
    });

    it('应该验证必需字段', async () => {
      await expect(User.create({})).rejects.toThrow();
    });

    it('应该验证用户名唯一性', async () => {
      const userData = {
        username: 'testuser2',
        email: 'testuser2@example.com',
        password: 'password123',
        role: 'admin'
      };

      await User.create(userData);

      // 尝试创建相同用户名的用户
      await expect(User.create(userData)).rejects.toThrow();
    });

    it('应该验证邮箱唯一性', async () => {
      const userData1 = {
        username: 'testuser3',
        email: 'testuser3@example.com',
        password: 'password123',
        role: 'admin'
      };

      const userData2 = {
        username: 'testuser4',
        email: 'testuser3@example.com', // 相同邮箱
        password: 'password123',
        role: 'admin'
      };

      await User.create(userData1);

      // 尝试创建相同邮箱的用户
      await expect(User.create(userData2)).rejects.toThrow();
    });

    it('应该验证邮箱格式', async () => {
      const userData = {
        username: 'testuser5',
        email: 'invalid-email',
        password: 'password123',
        role: 'admin'
      };

      await expect(User.create(userData)).rejects.toThrow();
    });
  });

  describe('用户查询', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser6',
        email: 'testuser6@example.com',
        password: 'password123',
        role: 'admin',
        status: 'active'
      });
    });

    it('应该通过ID查找用户', async () => {
      const foundUser = await User.findByPk(testUser.id);

      expect(foundUser).toBeDefined();
      expect(foundUser.id).toBe(testUser.id);
      expect(foundUser.username).toBe(testUser.username);
    });

    it('应该通过用户名查找用户', async () => {
      const foundUser = await User.findOne({
        where: { username: testUser.username }
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.username).toBe(testUser.username);
    });

    it('应该通过邮箱查找用户', async () => {
      const foundUser = await User.findOne({
        where: { email: testUser.email }
      });

      expect(foundUser).toBeDefined();
      expect(foundUser.email).toBe(testUser.email);
    });

    it('应该返回所有用户', async () => {
      const users = await User.findAll();

      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    it('应该支持条件查询', async () => {
      const adminUsers = await User.findAll({
        where: { role: 'admin' }
      });

      expect(Array.isArray(adminUsers)).toBe(true);
      adminUsers.forEach(user => {
        expect(user.role).toBe('admin');
      });
    });
  });

  describe('用户更新', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser7',
        email: 'testuser7@example.com',
        password: 'password123',
        role: 'admin',
        status: 'active'
      });
    });

    it('应该成功更新用户信息', async () => {
      const updateData = {
        email: 'updated@example.com',
        status: 'inactive'
      };

      await testUser.update(updateData);

      expect(testUser.email).toBe(updateData.email);
      expect(testUser.status).toBe(updateData.status);
      expect(testUser.updated_at).toBeDefined();
    });

    it('应该成功更新密码', async () => {
      const newPassword = 'newpassword123';
      await testUser.update({ password: newPassword });

      // 验证新密码已加密
      expect(testUser.password).not.toBe(newPassword);
      const isPasswordValid = await bcrypt.compare(newPassword, testUser.password);
      expect(isPasswordValid).toBe(true);
    });

    it('应该验证更新后的邮箱唯一性', async () => {
      // 创建另一个用户
      await User.create({
        username: 'testuser8',
        email: 'testuser8@example.com',
        password: 'password123',
        role: 'admin'
      });

      // 尝试更新为已存在的邮箱
      await expect(testUser.update({
        email: 'testuser8@example.com'
      })).rejects.toThrow();
    });
  });

  describe('用户删除', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser9',
        email: 'testuser9@example.com',
        password: 'password123',
        role: 'admin'
      });
    });

    it('应该成功删除用户', async () => {
      const userId = testUser.id;
      await testUser.destroy();

      // 验证用户已被删除
      const deletedUser = await User.findByPk(userId);
      expect(deletedUser).toBeNull();
    });

    it('应该支持批量删除', async () => {
      // 创建多个测试用户
      await User.create({
        username: 'testuser10',
        email: 'testuser10@example.com',
        password: 'password123',
        role: 'admin'
      });

      await User.create({
        username: 'testuser11',
        email: 'testuser11@example.com',
        password: 'password123',
        role: 'admin'
      });

      // 批量删除
      const deletedCount = await User.destroy({
        where: {
          username: {
            [require('sequelize').Op.like]: 'testuser1%'
          }
        }
      });

      expect(deletedCount).toBeGreaterThan(0);
    });
  });

  describe('用户实例方法', () => {
    let testUser;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser12',
        email: 'testuser12@example.com',
        password: 'password123',
        role: 'admin'
      });
    });

    it('应该验证密码', async () => {
      const isValid = await testUser.validatePassword('password123');
      expect(isValid).toBe(true);

      const isInvalid = await testUser.validatePassword('wrongpassword');
      expect(isInvalid).toBe(false);
    });

    it('应该返回用户公开信息', () => {
      const publicInfo = testUser.toJSON();

      expect(publicInfo).toHaveProperty('id');
      expect(publicInfo).toHaveProperty('username');
      expect(publicInfo).toHaveProperty('email');
      expect(publicInfo).toHaveProperty('role');
      expect(publicInfo).toHaveProperty('status');
      expect(publicInfo).toHaveProperty('created_at');
      expect(publicInfo).toHaveProperty('updated_at');
      expect(publicInfo).not.toHaveProperty('password');
    });
  });

  describe('用户关联', () => {
    it('应该支持与其他模型的关联', async () => {
      const user = await User.create({
        username: 'testuser13',
        email: 'testuser13@example.com',
        password: 'password123',
        role: 'admin'
      });

      // 这里可以测试与其他模型的关联
      // 例如：user.getOperationLogs(), user.getLotteryRecords() 等
      expect(user).toBeDefined();
    });
  });
}); 