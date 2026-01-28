---
name: agile-product-analyze
description: 产品经理技能：分析原始需求，通过 AskUserQuestion 澄清问题，编写 AI 友好的用户故事（user-story-{id}.md），定义验收标准，更新 backlog-order.json，提取业务术语到 knowledge-base/domain-concepts.md
version: 1.0.0
---

# Agile Product Analyze - 产品经理技能

## 🎯 核心任务

分析用户提供的原始需求，通过结构化的澄清提问理解真实需求，生成符合 AI 友好格式的用户故事文档。

---

## 📋 执行流程

### 第一步：需求澄清

**使用 `AskUserQuestion` 工具进行需求澄清**

如果用户需求不够清晰，必须提出以下问题：

```markdown
## 需求澄清

请回答以下问题，帮助我准确理解需求：

1. **目标用户**：谁将使用这个功能？
2. **核心价值**：这个功能解决什么问题？带来什么价值？
3. **使用场景**：描述一个典型的使用场景
4. **优先级**：这个需求的紧急程度？（P0-紧急/P1-高/P2-中/P3-低）
5. **技术约束**：是否有技术栈、性能、安全等方面的约束？
6. **依赖关系**：是否依赖其他功能或系统？
```

**等待用户回答后再继续。**

---

### 第二步：分析需求并提取关键信息

从用户回答中提取：

1. **用户角色**（User Role）
2. **行动/功能**（Action/Feature）
3. **价值/目标**（Value/Goal）
4. **验收标准**（Acceptance Criteria）
5. **业务术语**（Domain Concepts）
6. **技术约束**（Technical Constraints）

---

### 第三步：生成用户故事编号

```bash
# 读取 backlog 序列号
if [ -f "projects/active/backlog/.sequence" ]; then
    next_id=$(cat projects/active/backlog/.sequence)
else
    next_id=1
fi

# 生成故事 ID
story_id="story-$(printf '%03d' $next_id)"

# 更新序列号
echo $((next_id + 1)) > projects/active/backlog/.sequence
```

---

### 第四步：创建用户故事文档

**基于模板** `.claude-plugin/templates/user-story.md`

**文件路径**: `projects/active/backlog/user-story-${id}.md`

**填写内容**：
- ✅ YAML frontmatter（结构化元数据）
- ✅ 用户故事（As a...I want...So that...）
- ✅ 验收标准（列表形式，4-7项）
- ✅ 技术说明（API、数据模型）
- ✅ 依赖关系
- ✅ 验收测试计划

**示例**：

```markdown
---
id: "story-001"
title: "用户登录功能"
priority: "high"
status: "backlog"
acceptance_criteria_count: 5
complexity: "medium"
points: 5
tags: ["feature", "authentication"]
created_at: "2026-01-28T00:00:00Z"
updated_at: "2026-01-28T00:00:00Z"
---

# User Story: 用户登录功能

## 用户故事

As a **注册用户**,
I want to **使用邮箱和密码登录系统**,
So that **我可以访问我的个人账户和使用系统功能**.

## 验收标准

1. 用户可以输入邮箱和密码
2. 系统验证邮箱格式是否正确
3. 系统验证邮箱和密码是否匹配
4. 登录成功后跳转到仪表盘
5. 登录失败时显示错误提示

## 技术说明

### 技术约束
- 使用 JWT token 进行身份验证
- 密码使用 bcrypt 加密存储
- Session 有效期 24 小时

### API 接口
```
POST /api/auth/login
Request: { "email": "user@example.com", "password": "password123" }
Response: { "success": true, "token": "jwt_token", "user": {...} }
```

### 数据模型
```typescript
interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  user?: UserProfile;
  error?: string;
}
```

## 依赖关系

### 依赖的故事
无

### 阻塞因素
无

## 相关任务

（任务将在技术设计阶段生成）

## 验收测试计划

### 单元测试
- [ ] 邮箱格式验证
- [ ] 密码强度验证
- [ ] JWT token 生成

### E2E 测试
- [ ] 成功登录流程
- [ ] 邮箱错误提示
- [ ] 密码错误提示
```

---

### 第五步：更新 backlog-order.json

**文件路径**: `projects/active/backlog/backlog-order.json`

**格式**：

```json
{
  "version": "1.0.0",
  "updated_at": "2026-01-28T00:00:00Z",
  "stories": [
    {
      "id": "story-001",
      "title": "用户登录功能",
      "priority": "high",
      "status": "backlog",
      "points": 5,
      "complexity": "medium",
      "order": 1
    },
    {
      "id": "story-002",
      "title": "商品列表展示",
      "priority": "high",
      "status": "backlog",
      "points": 8,
      "complexity": "medium",
      "order": 2
    }
  ]
}
```

**排序规则**：
1. 优先级（P0 > P1 > P2 > P3）
2. 复杂度（低 > 中 > 高）
3. 依赖关系（被依赖的优先）

---

### 第六步：提取业务术语

**文件路径**: `projects/active/knowledge-base/domain-concepts.md`

**追加内容**：

```markdown
## 业务术语词典

### 用户认证相关

#### User（用户）
- **定义**: 系统的注册使用者，通过邮箱和密码进行身份验证
- **属性**: email, password, name, created_at
- **关系**: 一个用户可以拥有多个订单

#### Authentication（身份验证）
- **定义**: 验证用户身份的过程，通过邮箱和密码确认用户合法性
- **实现**: JWT token
- **有效期**: 24 小时

#### Session（会话）
- **定义**: 用户登录后的活跃状态
- **存储**: JWT token
- **有效期**: 24 小时

### 其他术语
（从需求中提取的其他业务术语）
```

---

### 第七步：更新项目摘要

**文件路径**: `projects/active/iterations/{current_iteration}/summary.md`

**添加到 "Product Backlog" 部分**：

```markdown
## Product Backlog

### 待开发功能

1. **story-001: 用户登录功能** (Priority: High, Points: 5)
   - 用户可以使用邮箱和密码登录
   - JWT token 身份验证
   - 登录状态保持 24 小时

2. **story-002: 商品列表展示** (Priority: High, Points: 8)
   - 显示商品列表
   - 支持分页
   - 支持搜索和排序
```

---

## 📤 输出结果

### 成功输出示例

```markdown
✅ 用户故事已创建

**故事 ID**: story-001
**标题**: 用户登录功能
**优先级**: High
**复杂度**: Medium
**故事点**: 5

**文档位置**:
- 用户故事: projects/active/backlog/user-story-001.md
- Backlog 排序: projects/active/backlog/backlog-order.json
- 业务术语: projects/active/knowledge-base/domain-concepts.md

**下一步建议**:
1. 使用 /agile-tech-design story-001 进行技术设计和任务拆解
2. 或继续添加更多用户故事
```

---

## ⚠️ 错误处理

### 错误 1：项目未初始化

```bash
if [ ! -f "projects/active/config.json" ]; then
    echo "❌ 项目未初始化"
    echo "请先运行: /agile-start"
    exit 1
fi
```

### 错误 2：需求不清晰

如果用户无法回答澄清问题，暂停并提示：

```markdown
⚠️ 需求不够清晰，无法生成用户故事

建议：
1. 提供更详细的需求描述
2. 说明使用场景
3. 列出验收标准
4. 如有参考系统，提供链接

准备好后请重新运行此命令。
```

---

## 🔍 质量检查清单

创建用户故事后，验证：

- [ ] YAML frontmatter 完整且格式正确
- [ ] 用户故事符合 "As a...I want...So that..." 格式
- [ ] 验收标准 4-7 项，明确可测
- [ ] 技术说明包含 API 接口和数据模型
- [ ] backlog-order.json 已更新
- [ ] domain-concepts.md 已提取业务术语
- [ ] summary.md 已更新

---

## 💡 最佳实践

1. **用户故事应该独立**: 每个故事可以独立开发和验收
2. **验收标准可测试**: 每个标准都应该可以明确测试
3. **故事点估算**: 基于复杂度而非工作量
4. **优先级明确**: 使用 MoSCoW 方法（Must/Should/Could/Won't）
5. **业务术语提取**: 及时沉淀领域知识

---

## 📚 相关技能

- `/agile-tech-design` - 技术设计和任务拆解
- `/agile-dashboard` - 生成进度看板
- `/agile-start` - 启动项目
