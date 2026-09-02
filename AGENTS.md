# AGENTS.md — AI 编码规范（Vue 3 + Vite）

本文件适用于 Claude Code、OpenAI Codex、OpenCode 等 AI 编码 Agent。  
所有 AI 生成代码必须严格遵守以下规范，不得以任何理由绕过。

---

## 0. 核心原则（最高优先级）

1. **单文件逻辑行硬上限：800 行**
   仅计 JS/TS/HTML 逻辑行，不计纯注释行与空行。
2. **单函数 / 方法逻辑行上限：80 行**
   超出必须拆为多个有意义的小函数再组合，不允许以“逻辑连贯”为由保留大函数。
3. **单组件职责单一**
   一个 `.vue` 文件只负责一件事。
4. **先拆后写**
   预估生成逻辑行超过 400 行时，先输出拆分方案并等待用户确认，再写代码。

### 豁免文件类型

以下文件性质为静态配置，不含运行时逻辑，不受 Vue 组件拆分阈值限制，但仍须保持整洁、分类注释：

- `*.types.ts`：纯类型声明文件
- `*.constants.ts`：纯常量文件
- `router/routes.ts`：纯路由配置文件
- `*.mock.ts`：Mock 数据文件

---

## 1. 项目结构与职责边界

本项目采用标准 Vite 根目录结构，前端源码根目录是仓库根目录下的 `src/`，入口 HTML 是根目录 `index.html`。

```text
src/
├── api/                    # HTTP 客户端、接口函数、协议适配与请求类型
├── app/                    # 应用启动、导航、环境适配与全局装配
├── components/
│   ├── common/             # 跨业务复用的纯展示或基础交互组件
│   └── [domain]/           # 业务域组件，可组合 composable，但不得直接发请求
├── composables/
│   ├── useXxx.ts           # 跨组件复用的组合式逻辑（Vue 语境中的 hooks）
│   └── [domain]/           # 复杂业务域按域分组
├── router/
│   ├── guards.ts           # 路由守卫装配
│   ├── routes.ts           # 路由配置
│   └── index.ts            # 创建并导出 Router
├── services/               # 不直接关心 UI 的业务流程与外部能力编排
├── stores/                 # Pinia 跨页面状态与 action 入口
├── styles/                 # 全局样式、主题、设计变量与组件库覆盖
├── types/                  # 仅存放跨业务共享的 TypeScript 类型
├── utils/                  # 无 Vue/Pinia/API 依赖的纯函数
├── views/                  # 路由页面，只负责页面级编排
├── App.vue
├── env.d.ts
└── main.ts
```

### 1.1 `hooks` 与 `composables` 的统一口径

- Vue 3 中复用 Composition API 状态与副作用的标准名称是 **composable**，本项目统一放在 `composables/`，文件名使用 `useXxx.ts`。
- 不新增与 `composables/` 含义重复的 `hooks/` 目录。需求中提到“hook”时，默认实现为 composable。
- `onMounted`、`onUnmounted`、`onBeforeRouteLeave` 等属于 Vue 或 Vue Router 的生命周期钩子，直接在组件或 composable 中使用，不单独建立目录。
- 只有不依赖 Vue 响应式系统的逻辑才放入 `utils/`；使用了 `ref`、`computed`、`watch`、生命周期或依赖注入的逻辑必须放入 `composables/`。

### 1.2 分层调用规则

推荐依赖方向：

```text
views / components
        ↓
composables / stores
        ↓
services
        ↓
api
```

- `views/` 只做路由参数接入、页面布局、子组件装配与页面级事件转发；数据获取和业务流程下沉到 composable 或 store。
- `components/common/` 不依赖具体业务域；`components/[domain]/` 可以包含领域交互，但不得直接调用 `api/`。
- `composables/` 负责响应式状态、UI 交互流程和生命周期管理，可以调用 `services/`；简单 CRUD 场景允许直接调用 `api/`，但不得复制业务编排。
- `stores/` 只保存需要跨页面或跨组件共享的状态。组件局部状态不得为了“统一管理”而放入 store。
- `services/` 负责校验、参数构建、多接口编排、结果转换和错误恢复；不得依赖 Vue 组件实例或 DOM。
- `api/` 是唯一允许创建 HTTP 请求、处理传输协议和访问令牌的目录；统一复用 `api/client.ts`，不得同时再建一套 `services/http.ts`。
- `utils/` 必须是无副作用的通用纯函数，不得导入 Vue、Pinia、组件、store 或具体 API。

### 1.3 按业务域组织

- 优先在现有业务域目录中扩展，例如 `components/flow/`、`composables/pbr/`，避免所有文件平铺在顶层。
- 仅被一个复杂组件使用的 composable 可以与组件同域就近放置；被多个业务域复用后，再提升到顶层 `composables/`。
- 业务域内部允许建立 `components/`、`composables/`、`types/` 等子目录，但不得为了形式完整创建空目录或单文件壳目录。
- 新建文件前必须搜索相同职责的 composable、service、API 或 util，优先扩展已有实现。
- `public/` 仅存放需要保持原文件名、原路径直接发布的资源；独立演示和测试媒体放在仓库根目录 `examples/`。
- 业务专用常量、配置和类型就近放在对应业务域；不新增顶层 `config/`、`constants/`、`icons/`、`plugins/` 或 `theme/`。
- 组件私有样式使用 `<style scoped>` 或同名样式文件；跨组件样式、变量和 mixin 放入 `styles/`，主题相关内容放入 `styles/theme/`。

---

## 2. Vue 组件规范

### 2.1 拆分阈值（强制）

| 触发条件 | 必须执行的操作 |
|---|---|
| 单个 `.vue` 文件逻辑行超过 **600 行** | 立即拆分子组件或提取 composable |
| `<template>` 超过 **120 行** | 提取子组件 |
| `<script setup>` 超过 **180 行** | 提取 composable |
| `<style scoped>` 超过 **120 行** | 提取到同名独立样式文件，组件内 `@import` 引入 |

> `template`、`script setup`、`style` 三段的行数独立计算，各自触发各自的拆分动作。  
> 单个区块未超标，不代表整个文件合规，整体逻辑行仍须符合 600 行上限。

### 2.2 组件文件内部顺序

```vue
<script setup lang="ts">
// 1. 类型导入
// 2. 第三方库导入
// 3. 内部模块导入（stores / composables / services / utils）
// 4. Props / Emits 定义
// 5. 响应式状态（ref / reactive / computed）
// 6. 方法定义
// 7. 生命周期钩子
</script>

<template>
  <!-- 根节点唯一；复杂条件分支拆为子组件 -->
</template>

<style scoped>
/* 超过 80 行提取到独立 .scss 文件 */
</style>
```

### 2.3 禁止事项

- 禁止单个组件内写超过 **5 个** `watch`，超出移入 composable，简单值同步优先用 `computed` 替代。
- 禁止在模板中写三元表达式以外的 JS 逻辑，复杂逻辑用 `computed`。
- 禁止在组件内直接写 `fetch` / `axios`，必须通过 `services/` 层。
- 单个 `<script setup>` 中方法超过 **8 个** 时，提取 composable；8 个以内若职责单一可保留。

---

## 3. Composable 规范

- 文件名格式：`use[功能名].ts`，例如 `useUserProfile.ts`
- 每个文件**只导出一个** composable 函数
- 必须声明明确的返回值类型
- 单文件逻辑行超过 **200 行** 时，拆分为多个 composable 并按依赖关系组合

```ts
export function useXxx(): UseXxxReturn {
  return { ... }
}
```

禁止一个文件导出多个 composable：

```ts
export function useAaa() {}
export function useBbb() {}
```

### 3.1 禁止前向引用（TDZ 违规）

`const` / `let` 声明的变量在声明语句执行前处于"暂时性死区"（Temporal Dead Zone），
任何读取都会抛出 `ReferenceError: Cannot access 'xxx' before initialization`。

**强制规则：**

1. **使用先于声明 = 必定报错**：变量、函数、composable 的使用必须出现在其声明/赋值之后
2. **`Object.assign` 不是提升**：先 `const deps = {}` 再 `Object.assign(deps, { fn: composable.fn })`，如果 `composable` 尚未声明，赋值阶段就会报错
3. **Vue `<script setup>` 模板绑定必须解构到顶层**：composable 返回的对象必须先 `const { x, y } = composable()` 解构，模板才能访问 `x`、`y`；直接在模板中写 `composable.x` 不可靠

**检查清单（每次写 composable 调用链时过一遍）：**

- [ ] 每个变量使用时，向上能找到它的 `const` / `let` / `function` 声明？
- [ ] `Object.assign(deps, { ... })` 中的每个值，来源变量已声明？
- [ ] 模板中用到的所有变量，都在 `<script setup>` 顶层解构/声明了？

### 3.2 循环依赖处理

当 composable A 需要 composable B 的输出，B 也需要 A 的输出时，会产生循环依赖。
**必须按以下优先级选择解决方案：**

**方案一（首选）：拆分共享状态为独立模块**

```ts
// useFlowCore.ts — 共享状态独立导出，不依赖任何 composable 函数
export const nodes = ref([])
export const edges = ref([])
export const activeTabId = ref('')

// useFlowTabs.ts — 导入共享状态，无需依赖 useFlowCore() 的返回值
import { nodes, edges, activeTabId } from './useFlowCore'
```

**方案二：延迟绑定代理（late-bound proxy）**

当共享状态不适合提取为独立模块时，使用 `late` 对象模式：

```ts
export function useFlowCanvas() {
  // 1. 声明 late 占位对象，所有方法默认抛异常或返回空值
  const late = {
    doSomething: () => { throw new Error('late.doSomething not bound') },
    getData: () => null,
  }

  // 2. 传给下游 composable 的 deps 用箭头函数包装，延迟求值
  const deps = {
    doSomething: (...args) => late.doSomething(...args),
    getData: (...args) => late.getData(...args),
  }

  // 3. 正常实例化下游 composable（此时 late 中的方法还是占位）
  const sub = useSubModule(deps)

  // 4. 真正实现方法后，绑定到 late
  const doSomething = () => { /* 真正的实现 */ }
  late.doSomething = doSomething

  // 5. 后续 composable 调用 late.doSomething 时，已经是真正的实现
}
```

**方案三：两阶段初始化**

当 `late` 模式也不够时，将初始化拆为"创建"和"装配"两个阶段：

```ts
// 阶段一：创建所有实例，不交叉引用
const a = useA()
const b = useB()

// 阶段二：装配交叉引用
a.setDependency(b.someMethod)
b.setDependency(a.someMethod)
```

**禁止的做法：**

- ❌ 假装依赖不存在，先写一个会崩溃的 `Object.assign` 再说
- ❌ 用 `// @ts-ignore` 或 `as any` 绕过类型检查来掩盖前向引用
- ❌ 在 `const` 声明前通过 `Object.assign` 提前赋值（TDZ 仍然会报错）

---

## 4. Pinia Store 规范

- 文件名格式：`[domain].store.ts`
- 使用 Setup 风格：`defineStore` + 函数体
- Store 只保留响应式状态、派生状态（`computed`）和 action 调用入口
- 业务实现逻辑委托给 `services/` 层
- 单个 store 文件逻辑行超过 **200 行** 时，将 action 实现提取到 `services/` 层
- 禁止跨 store 直接相互导入，通过 composable 组合

---

## 5. API 与 Service 层规范

- API 文件名优先使用业务资源名，例如 `users.ts`、`workflows.ts`；Service 文件名使用 `[domain].service.ts`。
- 所有 HTTP 请求统一由 `api/` 发出，基础请求实例统一复用 `api/client.ts`。
- `api/` 只处理 URL、请求参数、响应类型、协议适配和传输层错误，不承载 UI 状态或多步骤业务流程。
- `services/` 用于组合一个或多个 API、执行领域校验、参数转换、缓存或错误恢复；简单的一次性 CRUD 不强制增加 service 中转层。
- 组件不得直接调用 `api/`；store 和 composable 按复杂度调用 service 或 API。
- 单个 API 或 service 文件逻辑行超过 **200 行** 时按资源或子域拆分。

```ts
// api/users.ts
import { client } from './client'

export function getUser(userId: string): Promise<User> {
  return client.get(`/users/${userId}`)
}
```

---

## 6. TypeScript 规范

- 禁止使用 `any`，优先用 `unknown` + 类型守卫替代
- 所有函数必须显式声明参数类型
- 无法稳定推断时，必须显式声明返回值类型
- 禁止在 `.vue` 的 `<script setup>` 中定义超过 **3 个** interface / type，超出后优先移到对应业务域；仅跨业务类型放入 `src/types/`
- 类型文件命名：`[domain].types.ts`
- **TS 为唯一源码时，禁止生成同名 `.js` 镜像文件**
  - 若目录中已存在 `foo.ts`，不得再生成 `foo.js`
  - 无后缀导入必须依赖 Vite/TS 解析 `.ts`，不得为了“兼容”额外复制一份 `.js`
  - 发现历史遗留同名 `.js` 时，优先删除 `.js`，只保留 `.ts`
  - 例外：项目明确只有 `.js` 实现且没有对应 `.ts` 文件时，可以保留 `.js`

---

## 7. 路由规范

- 路由配置统一放在 `router/routes.ts`；超过 200 逻辑行后再按业务域拆分
- `router/index.ts` 只做 `createRouter` 和全局守卫装配
- 所有 `views/` 页面组件必须使用动态 `import()` 懒加载

---

## 8. 存量文件改造规范

- **改动范围内合规**：本次修改涉及的函数 / 区块，必须符合当前规范，不得新增违规代码
- **渐进重构，不一刀切**：超标存量代码在本次不触及时，可标记 `// REFACTOR:` 并记录拆分建议
- **禁止带病扩张**：若一个文件已超过 800 行，禁止继续向其中追加代码，必须先拆分再新增

---

## 9. 命名规范

| 类型 | 格式 | 示例 |
|---|---|---|
| 组件文件 | PascalCase | `UserAvatar.vue` |
| 页面组件（views） | PascalCase，`View` 后缀 | `UserDetailView.vue` |
| Composable | camelCase，`use` 前缀 | `useUserProfile.ts` |
| Store | camelCase，`.store` 后缀 | `user.store.ts` |
| Service | camelCase，`.service` 后缀 | `user.service.ts` |
| API 模块 | camelCase 或资源复数名 | `userAccounts.ts` |
| 工具函数文件 | camelCase | `dateFormat.ts` |
| 类型文件 | camelCase，`.types` 后缀 | `user.types.ts` |
| 常量文件 | camelCase，`.constants` 后缀 | `user.constants.ts` |
| 常量值 | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| 路由配置文件 | camelCase | `routes.ts` |

---

## 10. 注释规范

- 导出函数必须有 JSDoc 注释，至少覆盖参数、返回值、异常情况
- 只写解释“为什么”的注释，禁止写解释“做什么”的注释
- 禁止保留注释掉的死代码，依赖 Git 追溯
- 存量代码待重构处使用 `// REFACTOR: [说明]`，不使用 `// TODO`

---

## 11. AI Agent 生成行为约束

### 11.1 生成前必须检查

开始写代码前，必须在回复中简要说明：

1. 本次生成预估逻辑行数，超过 200 行则先输出拆分方案等待确认
2. 修改已有文件后，该文件是否超过 300 逻辑行；超过则同步拆分
3. 是否已有可复用的 composable / service / util，避免重复实现

### 11.2 拆分优先级

1. 按职责：UI 展示 / 业务逻辑 / 数据请求三层分离
2. 按业务域：同域代码聚合，跨域不直接依赖
3. 按复用性：被多处使用的逻辑必须提取
4. 按变化频率：频繁变动部分与稳定基础代码隔离

### 11.3 禁止的生成模式

- 禁止把所有逻辑堆进一个 `.vue` 文件后附注“后续可拆分”
- 禁止生成超过 50 逻辑行的单个函数
- 禁止生成 `// TODO: 抽离` 注释而不抽离
- 禁止静默违规后附加“建议后续重构”
- 禁止以“该场景较复杂”为由自行跳过行数限制

### 11.4 违规处理流程

发现即将违反上述规范时，必须：

1. 停止生成
2. 明确告知用户“本次生成将违反 [规则编号]，原因是 ……”
3. 给出符合规范的替代方案，并在用户确认后继续

---

## 12. 执行口径补充

这一节用于把上面的规则从“原则”补成“可执行口径”。

### 12.1 逻辑行计算方式

默认按以下规则计算逻辑行：

- 计入：HTML 结构行、指令行、JS / TS 可执行语句、对象字面量属性行、数组项行
- 不计入：空行、纯注释行、仅有花括号的独立行、仅有标签结束符的独立行
- 多行链式调用按实际占用行数计算
- 多行对象 / 数组按实际占用行数计算
- `template`、`script`、`style` 分段分别统计，同时整体再统计一次

如果出现边界争议，默认按“从严不从宽”执行。

### 12.2 单函数 80 行的判断口径

- 以函数体内部逻辑行为准，不含函数签名、JSDoc、纯注释、空行
- `if / else`、`switch`、`try / catch`、循环体内逻辑全部计入
- 若函数承担“编排多个步骤”的职责，也不能豁免，必须拆成多个步骤函数
- 一个函数即使没超过 80 行，只要同时承担“校验 + 请求 + 状态更新 + UI 提示”四类职责，也应主动拆分

### 12.3 允许保留在 View 的内容

`views/` 禁止写业务逻辑，但允许保留以下“页面编排逻辑”：

- 路由参数读取与透传
- 页面级布局切换
- 页面级弹窗开关编排
- 多个子组件之间的装配与事件转发

只要出现数据获取、流程控制、状态恢复、复杂派生计算，就必须下沉到 `composables/`、`stores/` 或 `services/`。

### 12.4 允许的例外边界

以下情况允许短暂保留，但必须在本次回复中明确说明原因：

1. 第三方库接入代码必须贴近初始化位置，且拆开会降低可读性
2. 极短的适配层文件只做导出聚合
3. 受框架约束必须集中声明的代码，例如路由模块、纯类型、纯常量

注意：

- 这些例外只影响“放置位置”或“组织方式”
- **不豁免单函数 80 行和单文件 800 行硬限制**
- 如确实会违反硬限制，必须先停下并走 11.4 流程

### 12.5 存量改造优先级

修改老文件时，按下面顺序决定是否必须顺手重构：

1. 本次新增代码会让文件继续膨胀：必须先拆
2. 本次改到的函数本身已超 80 行：必须顺手拆
3. 本次改到的区块直接违反当前规则：必须在本次修正
4. 没改到但明显超标的历史区块：允许保留，并用 `// REFACTOR:` 标记

### 12.6 AI 执行步骤

AI 在开始写代码前，默认按以下顺序执行：

1. 判断本次是否会新增超过 200 逻辑行
2. 检查目标文件当前是否已超 800 行
3. 检查是否已有可复用 `composable / service / util / type`
4. 若会触发阈值，先输出拆分方案，不直接写实现
5. 若不触发阈值，也优先沿现有职责边界扩展，不新建无意义中转壳文件

### 12.7 禁止的规避方式

以下做法视为违规，即使名义上“拆了文件”也不算合规：

- 仅把原文件整体平移到 `Core`、`Impl`、`Base`、`Wrapper` 之类壳文件
- 创建一个新文件但不改变职责边界，只是复制粘贴搬运
- 用超长对象、超长匿名函数、超长回调规避“单函数 80 行”
- 在组件里把 API 调用藏进局部 helper，名义上不直接请求

### 12.8 推荐的拆分方式

优先采用以下真实拆分方式：

- Vue 组件：父组件编排 + 子组件展示 + composable 管逻辑
- Store：状态保留在 store，流程下沉到 service / composable
- 大型流程逻辑：按 `校验 / 构建参数 / 提交请求 / 同步结果 / 错误恢复` 拆函数
- 大型编辑器或画布：按 `交互 / 数据同步 / 浮层 / 快捷键 / 生命周期` 拆 composable

---

## 13. 建议执行策略

为了让这份规范长期可执行，建议按下面节奏落地：

1. **新代码严格执行**
   新增文件从第一天开始完全遵守。
2. **改到即治理**
   修改旧文件时，优先治理本次触达的超标函数和区块。
3. **大文件按批次清理**
   对历史超大文件按业务域分批治理，不要求一次性全仓收敛。
4. **避免机械碎片化**
   拆分是为了职责清晰，不是为了制造大量无意义文件。
