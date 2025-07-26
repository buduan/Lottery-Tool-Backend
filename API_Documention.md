# 抽奖系统后端API接口文档

## 概述

本文档描述了抽奖系统后端API的所有接口，包括认证、活动管理、参与者管理、抽奖功能、系统管理等模块。

### 基础信息

- **基础URL**: `http://localhost:3000/api`
- **认证方式**: JWT Token (Bearer Token)
- **数据格式**: JSON
- **字符编码**: UTF-8

### 通用响应格式

```json
{
  "success": true|false,
  "data": {},
  "message": "操作结果描述"
}
```

### 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "错误描述",
    "details": "详细错误信息"
  }
}
```

### 常见HTTP状态码

- `200` - 请求成功
- `201` - 创建成功
- `400` - 请求参数错误
- `401` - 未认证
- `403` - 权限不足
- `404` - 资源不存在
- `429` - 请求频率限制
- `500` - 服务器内部错误

---

## 1. 认证模块 (/api/auth)

### 1.1 用户登录

**接口**: `POST /api/auth/login`

**描述**: 用户登录获取访问令牌

**请求参数**:
```json
{
  "username": "admin",
  "password": "password123"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "super_admin",
      "status": "active"
    }
  },
  "message": "登录成功"
}
```

### 1.2 用户注册

**接口**: `POST /api/auth/register`

**描述**: 创建新管理员账户（仅超级管理员可操作）

**认证**: 需要超级管理员权限

**请求参数**:
```json
{
  "username": "newadmin",
  "email": "newadmin@example.com",
  "password": "password123",
  "role": "admin"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 2,
      "username": "newadmin",
      "email": "newadmin@example.com",
      "role": "admin",
      "status": "active"
    }
  },
  "message": "用户创建成功"
}
```

### 1.3 获取当前用户信息

**接口**: `GET /api/auth/me`

**描述**: 获取当前登录用户的信息

**认证**: 需要有效的JWT Token

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "email": "admin@example.com",
      "role": "super_admin",
      "status": "active",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### 1.4 修改密码

**接口**: `PUT /api/auth/password`

**描述**: 修改当前用户密码

**认证**: 需要有效的JWT Token

**请求参数**:
```json
{
  "old_password": "oldpassword123",
  "new_password": "newpassword123"
}
```

**响应示例**:
```json
{
  "success": true,
  "message": "密码修改成功"
}
```

### 1.5 用户登出

**接口**: `POST /api/auth/logout`

**描述**: 用户登出

**认证**: 需要有效的JWT Token

**响应示例**:
```json
{
  "success": true,
  "message": "登出成功"
}
```

---

## 2. 管理员模块 (/api/admin)

### 2.1 活动管理

#### 2.1.1 获取活动列表

**接口**: `GET /api/admin/activities`

**描述**: 获取活动列表

**认证**: 需要管理员权限

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认10
- `search` (可选): 搜索关键词
- `status` (可选): 活动状态 (draft/active/ended)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": 1,
        "name": "春节抽奖活动",
        "description": "新春佳节，好礼相送",
        "status": "active",
        "lottery_mode": "online",
        "start_time": "2024-02-01T00:00:00.000Z",
        "end_time": "2024-02-15T23:59:59.000Z",
        "created_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

#### 2.1.2 获取活动详情

**接口**: `GET /api/admin/activities/:id`

**描述**: 获取指定活动的详细信息

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activity": {
      "id": 1,
      "name": "春节抽奖活动",
      "description": "新春佳节，好礼相送",
      "status": "active",
      "lottery_mode": "online",
      "start_time": "2024-02-01T00:00:00.000Z",
      "end_time": "2024-02-15T23:59:59.000Z",
      "settings": {
        "max_lottery_codes": 1000,
        "lottery_code_format": "8_digit_number",
        "allow_duplicate_phone": false
      },
      "created_at": "2024-01-15T10:00:00.000Z",
      "prizes": [
        {
          "id": 1,
          "name": "一等奖",
          "description": "iPhone 15 Pro",
          "total_quantity": 1,
          "remaining_quantity": 1,
          "probability": 0.1
        }
      ],
      "lottery_codes_count": 150
    }
  }
}
```

#### 2.1.3 创建活动

**接口**: `POST /api/admin/activities`

**描述**: 创建新的抽奖活动

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "name": "春节抽奖活动",
  "description": "新春佳节，好礼相送",
  "lottery_mode": "online",
  "start_time": "2024-02-01T00:00:00.000Z",
  "end_time": "2024-02-15T23:59:59.000Z",
  "settings": {
    "max_lottery_codes": 1000,
    "lottery_code_format": "8_digit_number",
    "allow_duplicate_phone": false
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activity": {
      "id": 1,
      "name": "春节抽奖活动",
      "description": "新春佳节，好礼相送",
      "status": "draft",
      "lottery_mode": "online",
      "start_time": "2024-02-01T00:00:00.000Z",
      "end_time": "2024-02-15T23:59:59.000Z",
      "settings": {
        "max_lottery_codes": 1000,
        "lottery_code_format": "8_digit_number",
        "allow_duplicate_phone": false
      },
      "created_at": "2024-01-15T10:00:00.000Z"
    }
  },
  "message": "活动创建成功"
}
```

**抽奖码格式说明**:
- `4_digit_number`: 4位纯数字（例如：1234）
- `8_digit_number`: 8位纯数字（例如：12345678）
- `8_digit_alphanumeric`: 8位数字+小写字母（例如：12a34b56）
- `12_digit_number`: 12位纯数字（例如：123456789012）
- `12_digit_alphanumeric`: 12位数字+字母（例如：12a34B56c78D）

#### 2.1.4 更新活动

**接口**: `PUT /api/admin/activities/:id`

**描述**: 更新活动信息

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "name": "春节抽奖活动（更新）",
  "description": "新春佳节，好礼相送",
  "status": "active"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activity": {
      "id": 1,
      "name": "春节抽奖活动（更新）",
      "description": "新春佳节，好礼相送",
      "status": "active"
    }
  },
  "message": "活动更新成功"
}
```

#### 2.1.5 删除活动

**接口**: `DELETE /api/admin/activities/:id`

**描述**: 删除活动

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "message": "活动删除成功"
}
```

### 2.2 奖品管理

#### 2.2.1 获取活动奖品列表

**接口**: `GET /api/admin/activities/:id/prizes`

**描述**: 获取指定活动的奖品列表

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "prizes": [
      {
        "id": 1,
        "name": "一等奖",
        "description": "iPhone 15 Pro",
        "total_quantity": 1,
        "remaining_quantity": 1,
        "probability": 0.1,
        "sort_order": 1,
        "created_at": "2024-01-15T10:00:00.000Z"
      }
    ]
  }
}
```

#### 2.2.2 添加奖品

**接口**: `POST /api/admin/activities/:id/prizes`

**描述**: 为活动添加奖品

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "name": "一等奖",
  "description": "iPhone 15 Pro",
  "total_quantity": 1,
  "probability": 0.1,
  "sort_order": 1
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "prize": {
      "id": 1,
      "name": "一等奖",
      "description": "iPhone 15 Pro",
      "total_quantity": 1,
      "remaining_quantity": 1,
      "probability": 0.1,
      "sort_order": 1
    }
  },
  "message": "奖品添加成功"
}
```

#### 2.2.3 更新奖品

**接口**: `PUT /api/admin/prizes/:id`

**描述**: 更新奖品信息

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "name": "特等奖",
  "description": "iPhone 15 Pro Max",
  "total_quantity": 2
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "prize": {
      "id": 1,
      "name": "特等奖",
      "description": "iPhone 15 Pro Max",
      "total_quantity": 2,
      "remaining_quantity": 2
    }
  },
  "message": "奖品更新成功"
}
```

#### 2.2.4 删除奖品

**接口**: `DELETE /api/admin/prizes/:id`

**描述**: 删除奖品

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "message": "奖品删除成功"
}
```

### 2.3 抽奖码管理

#### 2.3.1 获取活动抽奖码列表

**接口**: `GET /api/admin/activities/:id/lottery-codes`

**描述**: 获取指定活动的抽奖码列表

**认证**: 需要管理员权限

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认20
- `search` (可选): 搜索关键词（抽奖码、姓名、手机号、邮箱）
- `status` (可选): 抽奖码状态 (unused/used)
- `has_participant_info` (可选): 是否有参与者信息 (true/false)

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lottery_codes": [
      {
        "id": 1,
        "code": "12345678",
        "status": "unused",
        "participant_info": {
          "name": "张三",
          "phone": "13800138000",
          "email": "zhangsan@example.com"
        },
        "used_at": null,
        "created_at": "2024-01-20T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

#### 2.3.2 单个添加抽奖码

**接口**: `POST /api/admin/activities/:id/lottery-codes`

**描述**: 为活动添加单个抽奖码

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "code": "12345678",
  "participant_info": {
    "name": "张三",
    "phone": "13800138000", 
    "email": "zhangsan@example.com"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lottery_code": {
      "id": 1,
      "code": "12345678",
      "status": "unused",
      "participant_info": {
        "name": "张三",
        "phone": "13800138000",
        "email": "zhangsan@example.com"
      },
      "created_at": "2024-01-20T10:00:00.000Z"
    }
  },
  "message": "抽奖码添加成功"
}
```

#### 2.3.3 批量创建抽奖码

**接口**: `POST /api/admin/activities/:id/lottery-codes/batch`

**描述**: 批量创建抽奖码（自动生成）

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "count": 100,
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "created_count": 100,
    "lottery_codes": [
      {
        "id": 1,
        "code": "12345678",
        "status": "unused"
      }
    ]
  },
  "message": "成功创建 100 个抽奖码"
}
```

#### 2.3.4 批量导入抽奖码

**接口**: `POST /api/admin/activities/:id/lottery-codes/import`

**描述**: 通过Excel或CSV文件批量导入抽奖码

**认证**: 需要管理员权限

**请求类型**: `multipart/form-data`

**请求参数**:
- `file`: Excel文件(.xlsx, .xls)或CSV文件

**文件格式要求**:
- 支持列名：`抽奖码`/`code`、`姓名`/`name`、`手机号`/`phone`、`邮箱`/`email`
- 抽奖码为必填字段

**响应示例**:
```json
{
  "success": true,
  "data": {
    "imported_count": 100,
    "lottery_codes": [
      {
        "id": 1,
        "code": "12345678",
        "participant_info": {
          "name": "张三",
          "phone": "13800138000",
          "email": "zhangsan@example.com"
        }
      }
    ]
  },
  "message": "成功导入 100 个抽奖码"
}
```

#### 2.3.5 修改抽奖码参与者信息

**接口**: `PUT /api/admin/lottery-codes/:id/participant-info`

**描述**: 修改抽奖码对应的参与者信息

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "participant_info": {
    "name": "李四",
    "phone": "13900139000",
    "email": "lisi@example.com"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lottery_code": {
      "id": 1,
      "code": "12345678",
      "participant_info": {
        "name": "李四",
        "phone": "13900139000",
        "email": "lisi@example.com"
      }
    }
  },
  "message": "参与者信息更新成功",
}
```

#### 2.3.6 获取导入模板

**接口**: `GET /api/admin/lottery-codes/template`

**描述**: 下载抽奖码导入模板

**认证**: 需要管理员权限

**响应**: Excel文件下载

#### 2.3.7 获取活动Webhook接口信息

**接口**: `GET /api/admin/activities/:id/webhook-info`

**描述**: 获取活动的Webhook接口信息

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "webhook_url": "https://api.example.com/api/webhook/activities/abc123/lottery-codes",
    "webhook_token": "webhook_token_abc123",
    "activity_id": "abc123"
  }
}
```

#### 2.3.8 Webhook接口 - 添加抽奖码

**接口**: `POST /api/webhook/activities/:webhook_id/lottery-codes`

**描述**: 通过Webhook添加抽奖码（第三方系统调用）

**认证**: 需要Webhook Token

**请求头**:
```
Authorization: Bearer webhook_token_abc123
Content-Type: application/json
```

**请求参数**:
```json
{
  "code": "12345678",
  "participant_info": {
    "name": "王五",
    "phone": "13700137000",
    "email": "wangwu@example.com"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lottery_code": {
      "id": 1,
      "code": "12345678",
      "status": "unused",
      "participant_info": {
        "name": "王五",
        "phone": "13700137000",
        "email": "wangwu@example.com"
      }
    }
  },
  "message": "抽奖码添加成功"
}
```

### 2.4 抽奖记录管理

#### 2.4.1 获取抽奖记录列表

**接口**: `GET /api/admin/lottery-records`

**描述**: 获取抽奖记录列表

**认证**: 需要管理员权限

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认20
- `activity_id` (可选): 活动ID
- `winner_only` (可选): 仅显示中奖记录
- `start_date` (可选): 开始日期
- `end_date` (可选): 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 1,
        "is_winner": true,
        "created_at": "2024-02-01T10:00:00.000Z",
        "participant": {
          "id": 1,
          "name": "张三",
          "phone": "13800138000"
        },
        "prize": {
          "id": 1,
          "name": "一等奖",
          "description": "iPhone 15 Pro"
        },
        "activity": {
          "id": 1,
          "name": "春节抽奖活动"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

---

## 3. 抽奖码模块 (/api/lottery-codes)

### 3.1 获取抽奖码详情

**接口**: `GET /api/lottery-codes/:id`

**描述**: 获取抽奖码详细信息

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "lottery_code": {
      "id": 1,
      "code": "12345678",
      "status": "unused",
      "activity_id": 1,
      "participant_info": {
        "name": "张三",
        "phone": "13800138000",
        "email": "zhangsan@example.com"
      },
      "used_at": null,
      "created_at": "2024-01-20T10:00:00.000Z"
    }
  }
}
```

### 3.2 更新抽奖码

**接口**: `PUT /api/lottery-codes/:id`

**描述**: 更新抽奖码信息（仅限参与者信息）

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "participant_info": {
    "name": "李四",
    "phone": "13900139000",
    "email": "lisi@example.com"
  }
}
```

### 3.3 删除抽奖码

**接口**: `DELETE /api/lottery-codes/:id`

**描述**: 删除抽奖码

**认证**: 需要管理员权限

### 3.4 批量删除抽奖码

**接口**: `DELETE /api/admin/activities/:id/lottery-codes/batch`

**描述**: 批量删除抽奖码

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "lottery_code_ids": [1, 2, 3]
}
```

---

## 4. 抽奖模块 (/api/lottery)

### 4.1 获取活动抽奖信息

**接口**: `GET /api/lottery/activities/:id`

**描述**: 获取活动的抽奖信息（公开接口）

**认证**: 无需认证

**响应示例**:
```json
{
  "success": true,
  "data": {
    "activity": {
      "id": 1,
      "name": "春节抽奖活动",
      "description": "新春佳节，好礼相送",
      "status": "active",
      "lottery_mode": "online",
      "start_time": "2024-02-01T00:00:00.000Z",
      "end_time": "2024-02-15T23:59:59.000Z"
    },
    "prizes": [
      {
        "id": 1,
        "name": "一等奖",
        "description": "iPhone 15 Pro",
        "total_quantity": 1
      }
    ],
    "lottery_codes_count": 150
  }
}
```

### 4.2 用户线上抽奖

**接口**: `POST /api/lottery/activities/:id/draw`

**描述**: 用户使用抽奖码参与线上抽奖

**认证**: 无需认证（公开抽奖）

**请求参数**:
```json
{
  "lottery_code": "12345678"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "is_winner": true,
    "prize": {
      "id": 1,
      "name": "一等奖",
      "description": "iPhone 15 Pro"
    },
    "lottery_record": {
      "id": 1,
      "created_at": "2024-02-01T10:00:00.000Z"
    },
    "lottery_code": {
      "code": "12345678",
      "participant_info": {
        "name": "张三",
        "phone": "13800138000",
        "email": "zhangsan@example.com"
      }
    }
  },
  "message": "恭喜您中奖了！"
}
```

### 4.3 管理员线下抽奖

**接口**: `POST /api/lottery/activities/:id/offline-draw`

**描述**: 管理员使用抽奖码进行线下抽奖

**认证**: 需要管理员权限

**请求参数**:
```json
{
  "lottery_code": "12345678",
  "prize_id": 1
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "is_winner": true,
    "prize": {
      "id": 1,
      "name": "一等奖",
      "description": "iPhone 15 Pro"
    },
    "lottery_record": {
      "id": 1,
      "created_at": "2024-02-01T10:00:00.000Z"
    },
    "lottery_code": {
      "code": "12345678",
      "participant_info": {
        "name": "张三",
        "phone": "13800138000",
        "email": "zhangsan@example.com"
      }
    }
  },
  "message": "抽奖成功，参与者中奖！"
}
```

### 4.4 获取抽奖记录

**接口**: `GET /api/lottery/activities/:id/records`

**描述**: 获取活动的抽奖记录

**认证**: 可选（线下抽奖需要管理员权限）

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认20
- `winner_only` (可选): 仅显示中奖记录
- `participant_name` (可选): 参与者姓名搜索
- `lottery_code` (可选): 抽奖码搜索

**响应示例**:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "id": 1,
        "is_winner": true,
        "created_at": "2024-02-01T10:00:00.000Z",
        "lottery_code": {
          "code": "12345678",
          "participant_info": {
            "name": "张三",
            "phone": "13800138000",
            "email": "zhangsan@example.com"
          }
        },
        "prize": {
          "id": 1,
          "name": "一等奖",
          "description": "iPhone 15 Pro"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

### 4.5 获取抽奖统计信息

**接口**: `GET /api/lottery/activities/:id/statistics`

**描述**: 获取活动的抽奖统计信息

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "statistics": {
      "total_lottery_codes": 150,
      "total_lottery_records": 120,
      "total_winners": 15,
      "win_rate": "12.50",
      "prize_statistics": [
        {
          "id": 1,
          "name": "一等奖",
          "total_quantity": 1,
          "remaining_quantity": 0,
          "awarded_count": 1,
          "award_rate": "100.00"
        }
      ]
    }
  }
}
```

---

## 5. 系统管理模块 (/api/system)

### 5.1 用户管理

#### 5.1.1 获取用户列表

**接口**: `GET /api/system/users`

**描述**: 获取系统用户列表

**认证**: 需要超级管理员权限

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认10
- `search` (可选): 搜索关键词
- `role` (可选): 用户角色

**响应示例**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 1,
        "username": "admin",
        "email": "admin@example.com",
        "role": "super_admin",
        "status": "active",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 10,
      "totalPages": 1
    }
  }
}
```

#### 5.1.2 创建用户

**接口**: `POST /api/system/users`

**描述**: 创建新用户

**认证**: 需要超级管理员权限

**请求参数**:
```json
{
  "username": "newadmin",
  "email": "newadmin@example.com",
  "password": "password123",
  "role": "admin"
}
```

#### 5.1.3 更新用户

**接口**: `PUT /api/system/users/:id`

**描述**: 更新用户信息

**认证**: 需要超级管理员权限

#### 5.1.4 重置用户密码

**接口**: `POST /api/system/users/:id/reset-password`

**描述**: 重置用户密码

**认证**: 需要超级管理员权限

**请求参数**:
```json
{
  "new_password": "newpassword123"
}
```

#### 5.1.5 删除用户

**接口**: `DELETE /api/system/users/:id`

**描述**: 删除用户

**认证**: 需要超级管理员权限

### 5.2 操作日志管理

#### 5.2.1 获取操作日志列表

**接口**: `GET /api/system/operation-logs`

**描述**: 获取系统操作日志

**认证**: 需要管理员权限

**查询参数**:
- `page` (可选): 页码，默认1
- `limit` (可选): 每页数量，默认20
- `user_id` (可选): 用户ID
- `operation_type` (可选): 操作类型
- `target_type` (可选): 目标类型
- `start_date` (可选): 开始日期
- `end_date` (可选): 结束日期

**响应示例**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": 1,
        "user_id": 1,
        "operation_type": "CREATE_ACTIVITY",
        "description": "创建活动: 春节抽奖活动",
        "target_type": "ACTIVITY",
        "target_id": 1,
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2024-01-15T10:00:00.000Z",
        "user": {
          "id": 1,
          "username": "admin"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

#### 5.2.2 获取操作类型统计

**接口**: `GET /api/system/operation-logs/statistics`

**描述**: 获取操作类型统计信息

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "statistics": [
      {
        "operation_type": "CREATE_ACTIVITY",
        "count": 10
      },
      {
        "operation_type": "ONLINE_LOTTERY",
        "count": 150
      }
    ]
  }
}
```

#### 5.2.3 清理操作日志

**接口**: `DELETE /api/system/operation-logs/cleanup`

**描述**: 清理指定天数前的操作日志

**认证**: 需要超级管理员权限

**请求参数**:
```json
{
  "days": 90
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "deleted_count": 1000
  },
  "message": "成功清理 1000 条操作日志"
}
```

### 5.3 系统信息

#### 5.3.1 获取系统概览

**接口**: `GET /api/system/overview`

**描述**: 获取系统概览信息

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_users": 5,
      "total_activities": 10,
      "total_lottery_codes": 1500,
      "total_lottery_records": 1200,
      "recent_activities": 3,
      "recent_lotteries": 50
    }
  }
}
```

#### 5.3.2 获取系统健康状态

**接口**: `GET /api/system/health`

**描述**: 获取系统健康状态

**认证**: 需要管理员权限

**响应示例**:
```json
{
  "success": true,
  "data": {
    "health": {
      "status": "healthy",
      "timestamp": "2024-02-01T10:00:00.000Z",
      "database": "connected",
      "uptime": 86400,
      "memory": {
        "rss": 50331648,
        "heapTotal": 20971520,
        "heapUsed": 15728640,
        "external": 1048576
      },
      "version": "1.0.0"
    }
  }
}
```

---

## 6. 错误码说明

### 6.1 认证相关错误

- `AUTH_001`: 用户名或密码错误
- `AUTH_002`: Token无效或已过期
- `AUTH_003`: 权限不足
- `AUTH_004`: 账户已被禁用

### 6.2 验证相关错误

- `VALIDATION_001`: 请求参数缺失
- `VALIDATION_002`: 参数格式错误
- `VALIDATION_003`: 参数值超出范围
- `VALIDATION_004`: 数据重复

### 6.3 业务相关错误

- `BUSINESS_001`: 活动不存在
- `BUSINESS_002`: 活动已结束
- `BUSINESS_003`: 活动未开始
- `BUSINESS_004`: 奖品库存不足
- `BUSINESS_005`: 参与者已存在
- `BUSINESS_006`: 抽奖次数已用完

### 6.4 系统相关错误

- `SYSTEM_001`: 数据库连接失败
- `SYSTEM_002`: 文件上传失败
- `SYSTEM_003`: 服务器内部错误
- `SYSTEM_004`: 请求频率过高

---

## 7. 数据模型

### 7.1 用户 (User)

```json
{
  "id": 1,
  "username": "admin",
  "email": "admin@example.com",
  "password": "加密后的密码",
  "role": "super_admin|admin",
  "status": "active|inactive",
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}
```

### 7.2 活动 (Activity)

```json
{
  "id": 1,
  "name": "春节抽奖活动",
  "description": "新春佳节，好礼相送",
  "status": "draft|active|ended",
  "lottery_mode": "online|offline",
  "start_time": "2024-02-01T00:00:00.000Z",
  "end_time": "2024-02-15T23:59:59.000Z",
  "settings": {
    "max_lottery_codes": 1000,
    "lottery_code_format": "8_digit_number",
    "allow_duplicate_phone": false
  },
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

### 7.3 奖品 (Prize)

```json
{
  "id": 1,
  "activity_id": 1,
  "name": "一等奖",
  "description": "iPhone 15 Pro",
  "total_quantity": 1,
  "remaining_quantity": 1,
  "probability": 0.1,
  "sort_order": 1,
  "created_at": "2024-01-15T10:00:00.000Z",
  "updated_at": "2024-01-15T10:00:00.000Z"
}
```

### 7.4 抽奖码 (LotteryCode)

```json
{
  "id": 1,
  "activity_id": 1,
  "code": "12345678",
  "status": "unused|used",
  "participant_info": {
    "name": "张三",
    "phone": "13800138000",
    "email": "zhangsan@example.com"
  },
  "used_at": "2024-02-01T10:00:00.000Z",
  "created_at": "2024-01-20T10:00:00.000Z",
  "updated_at": "2024-01-20T10:00:00.000Z"
}
```

### 7.5 抽奖记录 (LotteryRecord)

```json
{
  "id": 1,
  "activity_id": 1,
  "lottery_code_id": 1,
  "prize_id": 1,
  "is_winner": true,
  "operator_id": 1,
  "created_at": "2024-02-01T10:00:00.000Z"
}
```

### 7.6 操作日志 (OperationLog)

```json
{
  "id": 1,
  "user_id": 1,
  "operation_type": "CREATE_ACTIVITY",
  "description": "创建活动: 春节抽奖活动",
  "target_type": "ACTIVITY",
  "target_id": 1,
  "ip_address": "127.0.0.1",
  "user_agent": "Mozilla/5.0...",
  "created_at": "2024-01-15T10:00:00.000Z"
}
```

---

## 8. 使用示例

### 8.1 完整的抽奖流程示例

#### 步骤1: 管理员登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

#### 步骤2: 创建活动
```bash
curl -X POST http://localhost:3000/api/admin/activities \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "春节抽奖活动",
    "description": "新春佳节，好礼相送",
    "lottery_mode": "online",
    "start_time": "2024-02-01T00:00:00.000Z",
    "end_time": "2024-02-15T23:59:59.000Z"
  }'
```

#### 步骤3: 添加奖品
```bash
curl -X POST http://localhost:3000/api/admin/activities/1/prizes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "一等奖",
    "description": "iPhone 15 Pro",
    "total_quantity": 1,
    "probability": 0.1
  }'
```

#### 步骤4: 批量创建抽奖码
```bash
curl -X POST http://localhost:3000/api/admin/activities/1/lottery-codes/batch \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "count": 100
  }'
```

#### 步骤5: 用户使用抽奖码参与抽奖
```bash
curl -X POST http://localhost:3000/api/lottery/activities/1/draw \
  -H "Content-Type: application/json" \
  -d '{
    "lottery_code": "12345678"
  }'
```

### 8.2 批量导入抽奖码示例

```bash
curl -X POST http://localhost:3000/api/admin/activities/1/lottery-codes/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@lottery_codes.xlsx"
```

### 8.3 Webhook添加抽奖码示例

```bash
curl -X POST http://localhost:3000/api/webhook/activities/abc123/lottery-codes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer webhook_token_abc123" \
  -d '{
    "code": "87654321",
    "participant_info": {
      "name": "王五",
      "phone": "13700137000",
      "email": "wangwu@example.com"
    }
  }'
```

---

## 9. 部署说明

### 9.1 环境要求

- Node.js >= 16.0.0
- MySQL >= 8.0
- Redis >= 6.0 (可选，用于缓存)

### 9.2 环境变量配置

创建 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lottery_system
DB_USER=root
DB_PASSWORD=password

# JWT配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# 文件上传配置
UPLOAD_MAX_SIZE=5242880

# 日志配置
LOG_LEVEL=info
LOG_FILE=logs/app.log
```

### 9.3 启动命令

```bash
# 安装依赖
npm install

# 数据库初始化
npm run db:init

# 启动服务
npm start

# 开发模式
npm run dev
```

---

## 10. 更新日志

### v1.0.0 (2024-02-01)
- 初始版本发布
- 实现基础的抽奖功能
- 支持线上和线下抽奖模式
- 完整的管理后台功能
- 操作日志记录
- 用户权限管理

---

## 11. 联系方式

如有问题或建议，请联系开发团队。

---