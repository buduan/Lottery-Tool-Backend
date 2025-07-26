# 抽奖系统后端测试文档

## 概述

本项目使用Jest作为测试框架，提供了完整的单元测试、集成测试和API测试覆盖。

## 测试结构

```
tests/
├── setup.js                    # Jest全局设置
├── helpers/
│   └── testUtils.js           # 测试工具函数
├── routes/                     # 路由测试
│   ├── auth.test.js           # 认证模块测试
│   └── admin/
│       └── activities.test.js # 活动管理测试
├── models/                     # 模型测试
│   └── User.test.js           # 用户模型测试
├── middleware/                 # 中间件测试
│   └── auth.test.js           # 认证中间件测试
├── utils/                      # 工具函数测试
│   └── lotteryCodeGenerator.test.js # 抽奖码生成器测试
├── integration/                # 集成测试
│   └── app.test.js            # 应用集成测试
└── README.md                   # 测试文档
```

## 运行测试

### 安装依赖

```bash
npm install
```

### 运行所有测试

```bash
npm test
```

### 运行特定测试

```bash
# 运行认证模块测试
npm test -- tests/routes/auth.test.js

# 运行活动管理测试
npm test -- tests/routes/admin/activities.test.js

# 运行用户模型测试
npm test -- tests/models/User.test.js
```

### 监听模式

```bash
npm run test:watch
```

### 生成覆盖率报告

```bash
npm run test:coverage
```

### 运行API测试（原有测试脚本）

```bash
npm run test:api
```

## 测试配置

### Jest配置

Jest配置在`package.json`中定义：

```json
{
  "jest": {
    "testEnvironment": "node",
    "testMatch": [
      "**/__tests__/**/*.js",
      "**/?(*.)+(spec|test).js"
    ],
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/app.js",
      "!src/config/database.js",
      "!**/node_modules/**"
    ],
    "coverageDirectory": "coverage",
    "coverageReporters": [
      "text",
      "lcov",
      "html"
    ],
    "setupFilesAfterEnv": [
      "<rootDir>/tests/setup.js"
    ],
    "testTimeout": 30000
  }
}
```

### 环境变量

测试环境使用以下环境变量：

- `NODE_ENV=test`
- `DB_NAME=lottery_system_test` (测试数据库)
- `JWT_SECRET=test-secret-key`

## 测试类型

### 1. 单元测试

测试单个函数或模块的功能：

- **模型测试**: 测试数据模型的CRUD操作、验证规则等
- **工具函数测试**: 测试工具函数的输入输出和边界情况
- **中间件测试**: 测试中间件的逻辑和错误处理

### 2. 集成测试

测试多个模块之间的交互：

- **路由测试**: 测试API端点的完整功能
- **数据库集成**: 测试与数据库的交互
- **认证流程**: 测试完整的认证和授权流程

### 3. API测试

使用supertest测试HTTP API：

- **请求响应**: 测试API的请求和响应格式
- **状态码**: 验证正确的HTTP状态码
- **数据验证**: 测试输入验证和错误处理
- **权限控制**: 测试不同角色的访问权限

## 测试工具

### TestUtils

`tests/helpers/testUtils.js`提供了常用的测试工具函数：

```javascript
// 生成测试JWT token
const token = TestUtils.generateTestToken(userId, role);

// 创建测试用户
const user = await TestUtils.createTestUser(userData);

// 清理测试用户
await TestUtils.cleanupTestUser(username);

// 生成随机数据
const email = TestUtils.generateRandomEmail();
const phone = TestUtils.generateRandomPhone();

// 验证响应格式
TestUtils.validateResponseFormat(response);

// 验证分页格式
TestUtils.validatePaginationFormat(pagination);
```

### 模拟对象

使用Jest的模拟功能：

```javascript
// 模拟模块
jest.mock('../../src/app');

// 模拟函数
const mockFn = jest.fn();

// 模拟请求和响应
const req = createMockRequest(headers);
const res = createMockResponse();
const next = createMockNext();
```

## 测试最佳实践

### 1. 测试命名

使用描述性的测试名称：

```javascript
describe('用户认证', () => {
  it('应该成功登录并返回token', async () => {
    // 测试代码
  });

  it('应该拒绝错误的密码', async () => {
    // 测试代码
  });
});
```

### 2. 测试结构

遵循AAA模式（Arrange-Act-Assert）：

```javascript
it('应该成功创建用户', async () => {
  // Arrange: 准备测试数据
  const userData = { username: 'test', email: 'test@example.com' };

  // Act: 执行被测试的操作
  const user = await User.create(userData);

  // Assert: 验证结果
  expect(user.username).toBe(userData.username);
});
```

### 3. 测试隔离

每个测试应该独立运行：

```javascript
beforeEach(async () => {
  // 设置测试环境
});

afterEach(async () => {
  // 清理测试数据
});
```

### 4. 错误测试

测试错误情况和边界条件：

```javascript
it('应该处理无效的输入', async () => {
  await expect(User.create({})).rejects.toThrow();
});
```

## 覆盖率目标

- **语句覆盖率**: > 80%
- **分支覆盖率**: > 70%
- **函数覆盖率**: > 85%
- **行覆盖率**: > 80%

## 持续集成

### GitHub Actions

在`.github/workflows/test.yml`中配置：

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
```

### 本地开发

在开发过程中运行测试：

```bash
# 开发时监听测试
npm run test:watch

# 提交前运行完整测试
npm test && npm run test:coverage
```

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 确保测试数据库已创建
   - 检查数据库连接配置

2. **测试超时**
   - 增加Jest超时时间
   - 检查异步操作是否正确处理

3. **模拟失败**
   - 确保模拟路径正确
   - 检查模块导入顺序

### 调试测试

```bash
# 运行单个测试并显示详细输出
npm test -- --verbose tests/routes/auth.test.js

# 调试模式
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 扩展测试

### 添加新测试

1. 在相应目录创建测试文件
2. 遵循现有的测试模式
3. 使用TestUtils工具函数
4. 添加适当的清理逻辑

### 测试新功能

```javascript
describe('新功能测试', () => {
  it('应该正确实现新功能', async () => {
    // 测试新功能的实现
  });

  it('应该处理错误情况', async () => {
    // 测试错误处理
  });
});
```

## 性能测试

### 基准测试

```javascript
it('应该能够快速处理请求', async () => {
  const startTime = Date.now();
  
  // 执行被测试的操作
  
  const endTime = Date.now();
  expect(endTime - startTime).toBeLessThan(1000);
});
```

### 负载测试

使用工具如Artillery或Apache Bench进行负载测试：

```bash
# 安装Artillery
npm install -g artillery

# 运行负载测试
artillery run load-test.yml
```

## 总结

本测试套件提供了全面的测试覆盖，确保代码质量和系统稳定性。通过遵循测试最佳实践，可以有效地维护和扩展测试代码。 