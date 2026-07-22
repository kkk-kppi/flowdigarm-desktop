# 复用模式

## 代码组织

- **分层架构**：`ui` → `application`（controllers/use-cases/commands） → `domain`；`infrastructure` 实现 application/domain 定义的端口。
- **控制器模式**：Vue 组件通过 `CanvasInteractionController`、`PropertyController` 等应用层控制器表达意图，避免直接依赖命令、领域换算或平台模块。
- **适配器模式**：X6 仅作为渲染与交互适配器，业务真源保持在领域模型与命令中。

## 命令模式

- 应用层使用命令对象封装可撤销操作；撤销历史由领域模型和命令维护，不依赖 X6 History 插件作为真源。

## 单位换算

- 内部统一使用 pt；换算常量固定：`1in=72pt`、`1cm=72/2.54pt`、`1mm=72/25.4pt`、`1px=72/96pt`。

## 持久化

- 图文件：JSON + 完整校验边界。
- 元数据：SQLite（首选项、最近文件、恢复快照、形状统计、窗口状态、用户模板元数据）。
- 恢复快照：脏文档最后变化约 2 秒后写入；恢复后文档仍为未保存状态。
