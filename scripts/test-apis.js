const axios = require('axios');
const path = require('path');
const fs = require('fs');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

console.log('=== 抽奖系统API测试 ===\n');

// 测试状态
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

// 测试工具函数
const test = (name, fn) => {
  return fn().then(() => {
    console.log(`✅ ${name}`);
    testResults.passed++;
    testResults.tests.push({ name, status: 'PASSED' });
  }).catch(error => {
    console.log(`❌ ${name}`);
    console.log(`   错误: ${error.message}`);
    testResults.failed++;
    testResults.tests.push({ name, status: 'FAILED', error: error.message });
  });
};

// 存储认证信息
let authToken = null;
let testActivity = null;
let testPrize = null;
let testLotteryCode = null;

// 测试用例
const tests = [
  // 1. 健康检查
  () => test('健康检查', async () => {
    const response = await axios.get(`${BASE_URL}/health`);
    if (response.status !== 200 || !response.data.success) {
      throw new Error('健康检查失败');
    }
  }),

  // 2. 用户登录
  () => test('管理员登录', async () => {
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username: 'admin',
        password: 'password123'
      });
      
      if (response.status !== 200 || !response.data.success) {
        throw new Error('登录失败');
      }
      
      authToken = response.data.data.token;
      if (!authToken) {
        throw new Error('未获取到token');
      }
    } catch (error) {
      if (error.response && error.response.status === 401) {
        throw new Error('用户名或密码错误 - 请确保已运行安装脚本');
      }
      throw error;
    }
  }),

  // 3. 获取用户信息
  () => test('获取当前用户信息', async () => {
    const response = await axios.get(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取用户信息失败');
    }
    
    if (!response.data.data.user.username) {
      throw new Error('用户信息不完整');
    }
  }),

  // 4. 创建测试活动
  () => test('创建测试活动', async () => {
    const response = await axios.post(`${API_BASE}/admin/activities`, {
      name: '测试抽奖活动',
      description: '这是一个API测试活动',
      lottery_mode: 'online',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      settings: {
        max_lottery_codes: 100,
        lottery_code_format: '8_digit_number',
        allow_duplicate_phone: false
      }
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 201 || !response.data.success) {
      throw new Error('创建活动失败');
    }
    
    testActivity = response.data.data.activity;
    if (!testActivity.id) {
      throw new Error('活动创建后缺少ID');
    }
  }),

  // 5. 获取活动列表
  () => test('获取活动列表', async () => {
    const response = await axios.get(`${API_BASE}/admin/activities`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取活动列表失败');
    }
    
    if (!response.data.data.activities || !Array.isArray(response.data.data.activities)) {
      throw new Error('活动列表格式错误');
    }
  }),

  // 6. 获取活动详情
  () => test('获取活动详情', async () => {
    const response = await axios.get(`${API_BASE}/admin/activities/${testActivity.id}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取活动详情失败');
    }
    
    if (response.data.data.activity.id !== testActivity.id) {
      throw new Error('活动详情ID不匹配');
    }
  }),

  // 7. 批量创建抽奖码
  () => test('批量创建抽奖码', async () => {
    const response = await axios.post(`${API_BASE}/admin/activities/${testActivity.id}/lottery-codes/batch`, {
      count: 5
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 201 || !response.data.success) {
      throw new Error('批量创建抽奖码失败');
    }
    
    if (response.data.data.created_count !== 5) {
      throw new Error('创建的抽奖码数量不正确');
    }
    
    testLotteryCode = response.data.data.lottery_codes[0];
  }),

  // 8. 获取抽奖码列表
  () => test('获取抽奖码列表', async () => {
    const response = await axios.get(`${API_BASE}/admin/activities/${testActivity.id}/lottery-codes`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取抽奖码列表失败');
    }
    
    if (!response.data.data.lottery_codes || response.data.data.lottery_codes.length === 0) {
      throw new Error('抽奖码列表为空');
    }
  }),

  // 9. 获取Webhook信息
  () => test('获取Webhook信息', async () => {
    const response = await axios.get(`${API_BASE}/admin/activities/${testActivity.id}/webhook-info`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取Webhook信息失败');
    }
    
    if (!response.data.data.webhook_url || !response.data.data.webhook_token) {
      throw new Error('Webhook信息不完整');
    }
  }),

  // 10. 获取活动公开信息
  () => test('获取活动公开信息', async () => {
    const response = await axios.get(`${API_BASE}/lottery/activities/${testActivity.id}`);
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取活动公开信息失败');
    }
    
    if (!response.data.data.activity || !response.data.data.prizes) {
      throw new Error('活动公开信息不完整');
    }
  }),

  // 11. 线上抽奖测试
  () => test('线上抽奖', async () => {
    if (!testLotteryCode) {
      throw new Error('没有可用的测试抽奖码');
    }
    
    const response = await axios.post(`${API_BASE}/lottery/activities/${testActivity.id}/draw`, {
      lottery_code: testLotteryCode.code
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('线上抽奖失败');
    }
    
    if (typeof response.data.data.is_winner !== 'boolean') {
      throw new Error('抽奖结果格式错误');
    }
  }),

  // 12. 清理测试数据
  () => test('清理测试数据', async () => {
    if (testActivity && testActivity.id) {
      // 先将活动状态改为draft才能删除
      await axios.put(`${API_BASE}/admin/activities/${testActivity.id}`, {
        status: 'draft'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      // 删除测试活动
      const response = await axios.delete(`${API_BASE}/admin/activities/${testActivity.id}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (response.status !== 200 || !response.data.success) {
        throw new Error('删除测试活动失败');
      }
    }
  }),

  // ==================== 新增系统管理API测试 ====================

  // 系统概览
  () => test('获取系统概览信息', async () => {
    const response = await axios.get(`${API_BASE}/system/overview`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取系统概览失败');
    }
    
    const data = response.data.data;
    if (!data.users || !data.activities || !data.lottery_records) {
      throw new Error('系统概览数据不完整');
    }
  }),

  // 系统健康状态
  () => test('获取系统健康状态', async () => {
    const response = await axios.get(`${API_BASE}/system/health`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取系统健康状态失败');
    }
    
    const data = response.data.data;
    if (!data.services || !data.metrics) {
      throw new Error('系统健康状态数据不完整');
    }
  }),

  // 系统配置
  () => test('获取系统配置', async () => {
    const response = await axios.get(`${API_BASE}/system/config`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取系统配置失败');
    }
    
    const data = response.data.data;
    if (!data.lottery_code_formats || !data.prize_types) {
      throw new Error('系统配置数据不完整');
    }
  }),

  // 用户管理 - 获取用户列表
  () => test('获取用户列表', async () => {
    const response = await axios.get(`${API_BASE}/system/users`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取用户列表失败');
    }
    
    const data = response.data.data;
    if (!data.users || !data.pagination) {
      throw new Error('用户列表数据不完整');
    }
  }),

  // 用户管理 - 创建用户
  () => test('创建测试用户', async () => {
    const response = await axios.post(`${API_BASE}/system/users`, {
      username: 'testuser',
      email: 'testuser@example.com',
      password: 'password123',
      role: 'participant'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 201 || !response.data.success) {
      throw new Error('创建用户失败');
    }
    
    const user = response.data.data;
    if (!user.id || user.username !== 'testuser') {
      throw new Error('创建的用户数据不正确');
    }
  }),

  // 用户管理 - 获取用户详情
  () => test('获取用户详情', async () => {
    const response = await axios.get(`${API_BASE}/system/users/2`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取用户详情失败');
    }
    
    const user = response.data.data;
    if (!user.id || !user.username) {
      throw new Error('用户详情数据不完整');
    }
  }),

  // 操作日志 - 获取日志列表
  () => test('获取操作日志列表', async () => {
    const response = await axios.get(`${API_BASE}/system/logs`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取操作日志失败');
    }
    
    const data = response.data.data;
    if (!data.logs || !data.pagination) {
      throw new Error('操作日志数据不完整');
    }
  }),

  // ==================== 新增抽奖记录管理API测试 ====================

  // 抽奖记录统计
  () => test('获取抽奖记录统计', async () => {
    const response = await axios.get(`${API_BASE}/admin/lottery-records/stats/overview`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取抽奖记录统计失败');
    }
    
    const data = response.data.data;
    if (typeof data.total_records !== 'number') {
      throw new Error('抽奖记录统计数据不完整');
    }
  }),

  // 抽奖记录列表
  () => test('获取抽奖记录列表', async () => {
    const response = await axios.get(`${API_BASE}/admin/lottery-records`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取抽奖记录列表失败');
    }
    
    const data = response.data.data;
    if (!data.records || !data.pagination) {
      throw new Error('抽奖记录列表数据不完整');
    }
  }),

  // 用户管理 - 删除测试用户
  () => test('删除测试用户', async () => {
    const response = await axios.delete(`${API_BASE}/system/users/2`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('删除用户失败');
    }
  }),

  // ==================== 新增前台抽奖码API测试 ====================

  // 抽奖码统计
  () => test('获取活动抽奖码统计', async () => {
    if (!testActivity) {
      throw new Error('需要先创建测试活动');
    }

    const response = await axios.get(`${API_BASE}/lottery-codes/stats/${testActivity.id}`);
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('获取抽奖码统计失败');
    }
    
    const data = response.data.data;
    if (typeof data.total_codes !== 'number') {
      throw new Error('抽奖码统计数据不完整');
    }
  }),

  // 抽奖码验证
  () => test('验证抽奖码', async () => {
    if (!testLotteryCode) {
      throw new Error('需要先创建测试抽奖码');
    }

    const response = await axios.get(`${API_BASE}/lottery-codes/validate/${testLotteryCode.code}?activity_id=${testActivity.id}`);
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('验证抽奖码失败');
    }
    
    const data = response.data.data;
    if (typeof data.valid !== 'boolean') {
      throw new Error('抽奖码验证结果不完整');
    }
  }),

  // 抽奖码查询
  () => test('查询抽奖码信息', async () => {
    if (!testLotteryCode) {
      throw new Error('需要先创建测试抽奖码');
    }

    const response = await axios.get(`${API_BASE}/lottery-codes/query?code=${testLotteryCode.code}&activity_id=${testActivity.id}`);
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('查询抽奖码信息失败');
    }
    
    const data = response.data.data;
    if (!data.lottery_code || !data.activity) {
      throw new Error('抽奖码查询结果不完整');
    }
  }),

  // 批量验证抽奖码
  () => test('批量验证抽奖码', async () => {
    if (!testLotteryCode) {
      throw new Error('需要先创建测试抽奖码');
    }

    const response = await axios.post(`${API_BASE}/lottery-codes/batch-validate`, {
      codes: [testLotteryCode.code, 'INVALID_CODE_123'],
      activity_id: testActivity.id
    });
    
    if (response.status !== 200 || !response.data.success) {
      throw new Error('批量验证抽奖码失败');
    }
    
    const data = response.data.data;
    if (!data.results || !data.summary) {
      throw new Error('批量验证结果不完整');
    }
  })
];

// 运行测试
const runTests = async () => {
  console.log('开始API测试...\n');
  
  for (const testFn of tests) {
    await testFn();
  }
  
  console.log('\n=== 测试结果 ===');
  console.log(`总计: ${testResults.passed + testResults.failed}`);
  console.log(`通过: ${testResults.passed}`);
  console.log(`失败: ${testResults.failed}`);
  
  if (testResults.failed > 0) {
    console.log('\n失败的测试:');
    testResults.tests
      .filter(t => t.status === 'FAILED')
      .forEach(t => console.log(`  - ${t.name}: ${t.error}`));
  }
  
  console.log('\n测试完成!');
  process.exit(testResults.failed > 0 ? 1 : 0);
};

// 检查系统是否已安装
const checkSystemInstalled = () => {
  const configPath = path.join(__dirname, '../config/system.json');
  if (!fs.existsSync(configPath)) {
    console.log('❌ 系统未安装，请先运行: npm run install-system');
    process.exit(1);
  }
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (!config.installed) {
    console.log('❌ 系统安装未完成，请先运行: npm run install-system');
    process.exit(1);
  }
};

// 启动测试
checkSystemInstalled();
runTests().catch(error => {
  console.error('测试运行出错:', error);
  process.exit(1);
}); 