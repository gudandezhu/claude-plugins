---
name: frontend-coding-standard
user-invocable: false
description: 前端编程规范。当用户进行前端开发、代码审查、命名文件/变量/组件时使用。确保代码符合企业规范。
---

# 前端编程规范

## 组件使用优先级（强制规范）

### 新增组件前置检查（强制）

**在创建任何新组件或引入新依赖之前，必须先执行以下检查：**

1. **搜索项目本地组件**：检查 `src/components/` 目录，确认是否已有功能相似的组件可复用
2. **确认无可复用组件后**，才允许引入开源组件库或新建组件

> 禁止在项目中已有同类组件的情况下重复创建，避免样式不一致和维护成本增加。

### 样式一致性（强制）

### 组件选择顺序

按以下优先级选择和使用组件：

| 优先级 | 来源         | 命名特征         | 示例                       |
| ------ | ------------ | ---------------- | -------------------------- |
| **1**  | 项目本地组件 | `@/components/*` | `@/components/page-header` |
| **2**  | 集团内部组件 | `@jlc/*`         | `@jlc/vue3`, `@jlc/utils`  |
| **3**  | 开源组件库   | 第三方包         | `element-plus`, `antd`     |

### 组件引入规范

代码中按以下顺序组织 import：

```javascript
// 1. 项目本地组件（优先）
import PageHeader from "@/components/page-header/index.vue";
import { useUserStore } from "@/stores/user";

// 2. 集团内部组件（其次）
import { JlcTable, JlcForm, JlcDialog } from "@jlc/vue3";
import { xssFilter, big } from "@jlc/utils";

// 3. 开源组件库（最后）
import { ElButton, ElInput } from "element-plus";

// 4. 其他第三方库
import { ref, computed } from "vue";
import dayjs from "dayjs";
```

### 常用集团内部组件库

| 组件库       | 用途          | 说明                                    |
| ------------ | ------------- | --------------------------------------- |
| `@jlc/vue3`  | Vue3 业务组件 | JlcTable, JlcForm, JlcDialog, JlcFilter |
| `@jlc/utils` | 工具函数      | xssFilter, big, 日期处理等              |

---

## 命名风格（强制规范）

### 文件与目录命名

| 类型                         | 规范       | 示例                                          |
| ---------------------------- | ---------- | --------------------------------------------- |
| 项目                         | kebab-case | `mall-management-system`                      |
| 目录                         | kebab-case | `demo-scripts`, `imgs`, `docs`                |
| JS/CSS/SCSS/HTML/TS/静态文件 | kebab-case | `render-dom.js`, `signup.css`                 |
| 仅包含类的 JS/TS 文件        | PascalCase | `User.js`, `UserInfo.ts`                      |
| Vue 组件文件                 | PascalCase | `PageLoading.vue` 或 `page-loading/index.vue` |
| React 组件文件               | PascalCase | `PageLoading.tsx` 或 `page-loading/index.tsx` |

### 变量与函数命名

| 类型            | 规范             | 示例                                               |
| --------------- | ---------------- | -------------------------------------------------- |
| 变量/函数/参数  | camelCase        | `loadingModules`, `stringFormat(source, typeName)` |
| 常量(基础类型)  | UPPER_SNAKE_CASE | `HTML_ENTITY`, `COUNT`                             |
| 常量(对象/数组) | camelCase        | `typeObject`                                       |
| 类/构造函数     | PascalCase       | `class User {}`, `function Animal() {}`            |

### Vue/React 组件命名

```javascript
// 【强制】组件名定义 - PascalCase
export default {
  name: 'JlcTop'  // 正确
}

// 【强制】样式类名 - kebab-case
.jlc-ft-topbar { }  /* 正确 */
```

---

## 安全规范（强制）

### XSS 防护

```javascript
import { xssFilter } from "@jlc/utils";
// <div v-html="xssFilter(htmlContent)"></div>
```

### 浮点数精度

```javascript
import { big } from "@jlc/utils";
let result = new Big(0.1).plus(new Big(0.2)); // 0.3
```

### 定时器清理

```javascript
export default {
  data() {
    return { timeoutTask: null };
  },
  mounted() {
    this.timeoutTask = setTimeout(() => {}, 1000);
  },
  destroyed() {
    clearTimeout(this.timeoutTask); // 必须
  },
};
```

---

## API 接口定义规范（强制）

### 【最高优先级】响应类型约束

> **绝对禁止写出没有响应泛型的 API 定义。** 每一个 `http.get/post/put/delete/patch` 调用都必须携带第二个泛型参数 `<P, T>` 中的 `T`（响应类型）。
>
> ```typescript
> // ❌ 绝对禁止 - 以下所有写法均违规
> export const getUser = http.get("/api/user");                        // 缺少全部泛型
> export const getUser = http.get<UserParams>("/api/user");            // 缺少响应泛型 T
> export const getUser = http.get<UserParams, any>("/api/user");       // 禁止用 any 代替响应类型
> export const getUser = http.get<UserParams, unknown>("/api/user");   // 禁止用 unknown 敷衍
> export const getUser = http.get<UserParams, object>("/api/user");    // 禁止用 object 敷衍
>
> // ✅ 正确 - 必须同时提供请求和响应泛型，且响应类型必须是具体 interface
> export const getUser = http.get<UserParams, UserRes>("/api/user");
> export const deleteUser = http.delete<{ id: number }, void>("/api/user"); // 无响应体时用 void
> ```

### 接口定义结构

每个 API 接口必须同时定义**请求参数 interface** 和**响应数据 interface**，并使用 `createHttp` 封装调用。文件结构如下：

```typescript
// api/xxx.ts

import { http } from "@/utils/http";

// ── Step 1: 定义请求参数 interface ──
export interface XxxParams {
  id: number;
  name?: string;
}

// ── Step 2: 定义响应数据 interface（必须定义） ──
export interface XxxRes {
  id: number;
  name: string;
  createdAt: string;
}

// ── Step 3: 列表响应（分页场景） ──
export interface XxxListRes {
  list: XxxRes[];
  total: number;
  page: number;
  pageSize: number;
}

// ── Step 4: 定义接口函数 - 泛型 <Params, Response> 必须填写 ──
export const getXxxDetail = http.get<XxxParams, XxxRes>("/api/xxx/detail");
export const getXxxList = http.get<XxxParams, XxxListRes>("/api/xxx/list");
export const createXxx = http.post<XxxParams, XxxRes>("/api/xxx/create");
export const updateXxx = http.put<XxxParams, XxxRes>("/api/xxx/update");
export const deleteXxx = http.delete<{ id: number }, void>("/api/xxx/delete");
```

### HTTP 封装使用规范

基于 `createHttp` 工厂函数封装，每个方法签名为：

```typescript
// createMethodRequest 泛型说明
// P = 请求参数类型
// T = 响应数据类型（接口实际返回的 data 字段类型）
http.get<P, T>(url, baseParams?, baseConfig?)
// 返回一个调用函数：(params?: P, config?) => Promise<T>
```

调用示例：

```typescript
import { getXxxDetail, getXxxList } from "@/api/xxx";

// 调用时享有完整类型推断
const detail = await getXxxDetail({ id: 1 }); // detail: XxxRes
const list = await getXxxList({ page: 1, pageSize: 20 }); // list: XxxListRes
```

### Interface 命名规范

| 场景         | 命名规则           | 示例             |
| ------------ | ------------------ | ---------------- |
| 请求参数     | `{模块}Params`     | `UserParams`     |
| 单条数据响应 | `{模块}Res`        | `UserRes`        |
| 列表响应     | `{模块}ListRes`    | `UserListRes`    |
| 分页参数     | `{模块}PageParams` | `UserPageParams` |

### 检查要点

- [ ] 每个 API 函数都有对应的**响应 interface**（`{模块}Res` / `{模块}ListRes`）
- [ ] 每个 `http.xxx` 调用都填写了 `<P, T>` 两个泛型参数，**第二个泛型 `T` 禁止省略**
- [ ] 响应 interface 字段与后端文档保持一致
- [ ] 泛型参数禁止使用 `any`
- [ ] interface 与 API 函数定义在同一文件中并 export

---

## 开发检查清单

### 组件使用

- [ ] 优先使用项目本地已有组件
- [ ] 使用集团内部组件库（@jlc/\*）
- [ ] import 按优先级顺序组织

### 命名规范

- [ ] 文件/目录命名符合 kebab-case
- [ ] Vue/React 组件使用 PascalCase
- [ ] 变量使用 camelCase

### 安全规范

- [ ] 富文本已做 XSS 处理
- [ ] 浮点数使用 big 处理
- [ ] 定时器已清理
