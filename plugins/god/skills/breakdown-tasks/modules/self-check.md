# 自检清单

> 本文档由 SKILL.md Step 6 引用。每个迭代完成后执行迭代内自检，所有迭代完成后执行跨迭代自检。

## 迭代内自检

### 格式合规检查

1. 读取每个任务详情文档，检查 YAML frontmatter（`---` 包裹的头部）是否存在且所有字段已填充实际内容（不允许残留模板占位符）
2. 读取 `${CLAUDE_PLUGIN_ROOT}/templates/task/` 下每个模板文件，提取所有 `<!-- REQUIRED:xxx -->` 标记名（任务详情模板的"基本信息"已迁移至 frontmatter）
3. 逐一读取已产出的文档，检查每个 REQUIRED 区块是否存在且已填充实际内容
4. 发现残留的 `<!-- REQUIRED -->` 或 `<!-- REQUIRED_END -->` 标记，立即补全后重新检查

**占位符扫描**：所有任务详情中不存在 `{request-body}`、`{请求体}`、`/api_url`、`{接口路径}`、"类似TaskN"、"同上"、"参考XX" 等占位符或模糊引用。

### JSON 合法性检查

| 检查项 | 验证规则 |
|--------|---------|
| 重复 key 检查 | task-list.json 中每个 JSON 对象不得包含重复的 key（如 phase 对象内不能出现两个 `selfTest`）。使用 JSON Schema 或逐字段扫描验证 |
| phase 状态一致性 | 同一任务的 phase 字段中，`dev` 非 `done` 时 `selfTest` 不得为 `done`；`dev` 为 `done` 时 `selfTest` 不得同时出现 `done` 和 `-` 两个值 |

### 结构检查

| 检查项 | 验证规则 |
|--------|---------|
| 粒度检查 | Agent 单 session 可完成（不超出 context window），且充分利用 session 容量（不允许仅含单一简单接口的极小任务，除非满足拆分条件的例外） |
| 过小任务检查 | 不存在以下模式：① 只被一个 BE 任务使用的 Entity/DTO 定义独立成 INFRA 任务；② 同一实体的 CRUD 接口拆成多个 BE 任务且无拆分条件满足；③ 只被一个页面使用的公共组件独立成 FE 任务 |
| 依赖检查 | 依赖关系构成有向无环图（无循环依赖） |
| 完整性检查 | 当前迭代范围内每个接口/页面/验收标准都有对应任务 |
| 验收标准检查 | 每个任务的验收标准按 4 个阶段（开发/自测/联调/QA）组织，每阶段至少 1 条可测标准 |
| 依赖标注检查 | 每个任务详情文档的"依赖任务"字段已填写（无依赖填"无"，不允许留空） |
| 迭代字段检查 | 每个任务详情文档的 YAML frontmatter 中包含 `iteration` 字段 |
| task-list 路径检查 | task-list.json 中 techDesignPath 和 uiDesignPath 为基于 process-docs 的相对路径，不允许占位符或绝对路径 |
| 功能点溯源检查 | task-list.json 中 features 数组非空，每个功能点的 techDesignRef、prdRef、acRef 已填充实际锚点（不允许占位符），uiRef 为实际路径或 null |
| 功能点覆盖检查 | tech-design.md 中所有用户可感知的功能点都在 features 数组中有对应条目，无遗漏 |
| 功能点任务关联检查 | features 中每个功能点的 relatedTasks 数组非空，且引用的任务 ID 在 tasks 数组中存在 |
| phases 拓扑分层检查 | phases 数组按拓扑排序分层，同层无依赖的任务在同一个 phase 中可并行执行。不同层有依赖关系的任务分属不同 phase。每个任务恰好出现在一个 phase 中 |
| phases 覆盖检查 | phases 数组中所有 tasks 引用的 ID 必须在 tasks 数组中存在，且每个 task 必须被分配到恰好一个 phase，不允许遗漏或重复 |

### AC 覆盖检查

1. 读取 AC 文件（优先 `$WORK_DIR/design/ac.md`，次选 `$WORK_DIR/requirement/ac.md`），提取所有 AC 编号（GOAL-XX、AC-XX、UI-XX）
2. 汇总当前迭代所有任务 frontmatter 的 `acceptance-criteria` 字段
3. 检查每个 AC-XX 和 UI-XX 至少被一个任务引用（GOAL 类作为全局上下文，不要求逐条分配）
4. 未覆盖的 AC 列出清单，要求补充任务或扩展已有任务的 acceptance-criteria
5. **反向检查**：每个任务的 `acceptance-criteria` 字段非空（至少包含一个 AC-XX 或 UI-XX 引用）。无 AC 可分配的任务（如纯基础设施类）也必须在正文中说明原因，并从最相关的 AC 中分配至少一条

### PRD 独立比对

1. 读取 PRD 文档（优先 `$WORK_DIR/design/`，次选 `$WORK_DIR/requirement/`）
2. 独立提取 PRD 中的验收标准/功能要求
3. 与 ac.md 逐条比对，发现 PRD 中有但 ac.md 中缺失的条目
4. 遗漏项要求补充到 ac.md（提示用户确认后追加）

---

## 内容质量检查

### 通用检查（所有角色）

- [ ] 任务名称具体描述了产出物（不允许：「用户模块开发」；应为：「用户管理 CRUD（含列表/新增/编辑/删除/详情）」或「用户注册接口 POST /api/v1/users/register」）
- [ ] 任务目标标注了来源章节，使用标准 md 锚点链接（如 `[tech-design.md#41-接口总览表](../../../design/tech-design.md#41-接口总览表)`）
- [ ] 依赖任务与 task-list.json 中的依赖关系一致
- [ ] 验收标准每条可被 Agent 自动判定通过/失败（不允许模糊描述如「功能正常」）

### 前端任务

- [ ] UI 设计稿路径为基于 process-docs 的相对路径且文件实际存在
- [ ] 页面元素表格覆盖了设计稿中所有可交互区域
- [ ] 每个页面元素描述包含：位置 + 样式（颜色/尺寸）+ 默认值/状态
- [ ] 每条交互操作包含具体的 HTTP 方法 + 完整接口路径 + 关键参数
- [ ] 每条交互操作的「期望数据」给出了具体字段结构示例
- [ ] 涉及状态变更的交互描述了局部更新还是整页刷新
- [ ] 每条交互操作标注了来源（PRD 章节 或 tech-design.md 章节）
- [ ] 覆盖了 PRD/tech-design.md 中提到的所有异常场景及对应的前端提示文案
- [ ] 涉及文件区块列出了所有需修改和新增的文件，包含文件路径和修改内容简述
- [ ] 调用接口表格列出了所有调用的接口，每条包含接口路径和调用说明
- [ ] 前置确认项（如有）独立列出，未与正常开发步骤混在一起

### 后端任务

- [ ] 包含"核心流程"段落，用自然语言+伪代码描述核心业务流程
- [ ] 核心流程中避免了具体的 Java 代码（禁止出现 Controller 方法、Service 接口签名等）
- [ ] 核心流程步骤与 tech-design.md 中的业务逻辑一致
- [ ] 若核心逻辑在 SQL 层（聚合/多表 JOIN），核心流程包含：关联路径（表名→关联字段）、聚合字段计算方式、CASE WHEN 判定条件骨架，而非仅引用 tech-design.md 章节
- [ ] 异常分支覆盖了 tech-design.md 中所有错误场景，且每条都有明确的 HTTP 状态码
- [ ] 异常分支标注了来源（tech-design.md 章节）
- [ ] curl 验证命令包含真实的接口路径和参数示例（不允许 `/api_url` 等占位符）
- [ ] 前置确认项（如有）从 tech-design.md 待办项/不确定项中提取，作为阻塞项独立列出，未与正常开发步骤混在一起
- [ ] **DDL 字段校验**：任务中所有 VO/BO 字段映射、WHERE 条件中引用的数据库字段，均在对应表的 DDL 中存在。不存在的字段已在"前置确认项"中标注为阻塞项

---

## 跨迭代自检

所有迭代处理完毕后执行：

| 检查项 | 验证规则 |
|--------|---------|
| 迭代覆盖检查 | tech-design.md 中所有页面/功能模块都归属到某个迭代，无遗漏 |
| 跨迭代依赖检查 | 各迭代 task-list.json 中标注的跨迭代依赖与实际迭代顺序一致 |
| task-list 完整性检查 | 每个 task-list.json 的 tasks 数组长度与实际任务详情文档数量一致 |
| task-list 路径检查 | 每个 task-list.json 中 techDesignPath 和 uiDesignPath 为基于 process-docs 的相对路径，不允许占位符或绝对路径 |
| 跨迭代功能点覆盖检查 | 所有迭代的 features 数组合并后，覆盖 tech-design.md 中全部用户可感知的功能点，无遗漏无重复 |
| AC 全覆盖检查 | 所有迭代的任务 acceptance-criteria 合并后，覆盖 ac.md 中全部 AC-XX 和 UI-XX，无遗漏 |
| 任务 AC 非空检查 | 每个任务的 frontmatter `acceptance-criteria` 字段至少包含一个 AC-XX 或 UI-XX 引用，无遗漏 |
