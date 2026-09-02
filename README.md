# AI-Comic-Director-Canvas

AI-Comic-Director 的画布创作模块，基于 Vue 3、Vite、TypeScript、Pinia 和 Element Plus 构建。

## 使用说明

本项目可用于 AI 漫画、短剧和多媒体创作工作流的画布编排。

## 项目说明

AI-Comic-Director-Canvas 提供节点画布、素材管理、生成任务编排、案例展示和模型配置等能力，可作为 AI-Comic-Director 体系下的独立画布前端。

## 开发

```bash
npm install
npm run dev
```

默认开发地址为 `http://localhost:6174`。

## 质量检查

```bash
npm run lint
npm run typecheck
```

项目检查不依赖构建命令。目录职责和代码约束见 `AGENTS.md`。

## 目录

- `src/api`：HTTP 请求和协议适配。
- `src/components`：界面组件。
- `src/composables`：可复用的 Vue 响应式逻辑。
- `src/services`：业务流程和多接口编排。
- `src/stores`：Pinia 跨页面状态。
- `src/views`：路由页面。
- `examples`：不参与生产构建的独立演示。
