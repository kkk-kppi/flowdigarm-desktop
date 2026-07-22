# 决策记录

## 初始化时观察到的关键决策

| 决策 | 来源 | 说明 |
|------|------|------|
| 技术栈选型 | `docs/README.md` | Tauri 2 + Vue 3 + TypeScript strict + Pinia + AntV X6 |
| 架构分层 | `docs/README.md` | `ui -> application -> domain`，`infrastructure` 实现端口 |
| 单位系统 | `docs/README.md` | 内部唯一逻辑长度单位为 pt，页面单位切换仅影响显示 |
| 文件格式 | `docs/README.md` | `.flowdiagram` 扩展名，UTF-8 JSON，顶层 `DiagramDocument` |
| 权限最小化 | `src-tauri/tauri.conf.json` | CSP 仅允许 `self` 与 `data:` 图片 |
| 平台支持 | `docs/README.md` | Windows 10/11 x64、macOS Intel/Apple Silicon；无 Linux |
