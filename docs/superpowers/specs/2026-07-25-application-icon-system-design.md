# 应用功能图标系统设计

## 目标

使用 `src/ui/icons/svg/` 中的本地 SVG，统一替换应用外壳内目前以文字、Unicode 字符或临时内联图形表达的功能图标，使工具栏、窗口控件、菜单、侧栏、页签、属性面板和状态栏具有一致的视觉语言，并正确支持禁用态、选中态、深色主题与无障碍名称。

## 范围

覆盖以下界面：

- 标题栏的应用标志、最小化、最大化、还原和关闭。
- 菜单项勾选状态与子菜单箭头。
- 紧凑工具栏的历史、剪贴板、格式刷、文字样式和对齐操作。
- 图元库的搜索、展开/折叠、更多形状和帮助控件。
- 页签的新增与关闭。
- 右侧面板的展开/折叠、关闭和帮助控件。
- 属性面板的分组箭头、字体、字号、颜色、文字样式和对齐控件。
- 页面设置中的无箭头、单向箭头和双向箭头。
- 状态栏的适应屏幕、网格和吸附状态。
- 对话框及帮助层中通用的帮助和关闭控件。

不在本次范围内：

- 图元缩略图。它们继续由现有形状注册表和缩略图渲染逻辑生成。
- 原型中本来就以文字表达的菜单命令、表单提交、取消等操作。
- 删除重复或当前未使用的 SVG；资源清理另行处理。
- 新增产品功能或改变现有命令语义。

## 验收映射

业务语义必须通过注册表映射到以下资源；同一语义不得由业务组件自行选择其他文件：

| 区域 | 语义名称与资源 |
|------|----------------|
| 标题栏 | `appGraph -> app-graph.svg`、`minimize -> minimize.svg`、`maximize -> maximize.svg`、`restore -> restore.svg`、`close -> close.svg` |
| 菜单 | `check -> check.svg`、`chevronRight -> chevron_right.svg` |
| 工具栏 | `undo -> history_undo.svg`、`redo -> history_redo.svg`、`copy -> content_copy.svg`、`cut -> content_cut.svg`、`paste -> content_paste.svg`、`formatPaint -> format_paint.svg` |
| 文字样式 | `bold -> format_bold.svg`、`italic -> format_italic.svg`、`underline -> format_underlined.svg`、`strikethrough -> format_strikethrough.svg`、`font -> format_font.svg`、`fontSize -> format_size.svg`、`textColor -> format_color_text.svg`、`fillColor -> format_color_fill.svg` |
| 对齐 | `alignLeft/Center/Right -> format_align_left/center/right.svg`、`alignTop/Middle/Bottom -> align_vertical_top/center/bottom.svg` |
| 外壳控制 | `chevronLeft/Right/Down/Up -> chevron_left/right/down.svg、chevron-top.svg`、`add -> add.svg`、`search -> search.svg`、`help -> help.svg`、`delete -> delete.svg` |
| 页面与视口 | `minus -> minus.svg`、`arrowRight -> arrow-right.svg`、`arrowLeftRight -> arrow_left_right.svg`、`fitToScreen -> fit_to_screen.svg`、`gridOn/Off -> grid_on/off.svg`、`magnet -> magnet.svg` |

组件验收必须覆盖每个当前以 `↩`、`↪`、`B/I/U/S`、`⬒/⬍/⬓`、`⇤/⇹/⇥`、`✓`、`›`、`«/»`、`▾/▸`、`+`、`?`、`×`、`−`、`□` 或对应纯文字临时代替图标的在范围控件，确保没有遗漏。

状态与复用规则：

- 格式刷始终使用 `formatPaint`；单次、连续、关闭和禁用由按钮的背景、边框、颜色、`aria-pressed` 与 `disabled` 表达，不用斜线图标替代状态。
- 网格开启使用 `gridOn`，关闭使用 `gridOff`；吸附始终使用 `magnet`，开启/关闭由 `aria-pressed` 和按钮状态表达。
- 页签关闭、面板关闭、对话框关闭和帮助层关闭统一使用 `close`；真正删除确认使用 `delete`。
- 菜单栏、上下文菜单和属性分组需要表示下一级时统一使用 `chevronRight`；展开状态使用 `chevronDown`。
- 状态栏从缩放原生选择框中移除“适应屏幕”选项，在选择框旁提供具有 `fitToScreen` 的独立按钮，继续发送现有 `setZoom('fit')`，避免尝试在原生 `<option>` 内渲染 Vue 组件。

## 图标组件

新增 `src/ui/icons/AppIcon.vue` 和集中式图标注册表。业务组件只传入语义名称，不直接引用 SVG 文件路径。

组件接口：

- `name: IconName`：类型安全的语义图标名称，如 `undo`、`maximize`、`fitToScreen`。
- `size?: number | string`：图标视觉尺寸，默认 16px。
- 图标本身始终设置 `aria-hidden="true"`，无障碍名称由所属按钮的 `aria-label` 或可见文字提供，避免屏幕阅读器重复朗读。

注册表使用显式映射，例如 `undo -> history_undo.svg`、`arrowRight -> arrow-right.svg`。文件名差异被隔离在注册表内，不泄漏到业务组件。未知名称应在类型检查阶段失败。注册表使用静态资源导入，资源不存在时必须使类型检查、测试或 Vite 构建失败；不为损坏的安装包提供静默空白或近似图标回退。

## 渲染方式

SVG 通过 Vite URL 导入，并由 `AppIcon` 使用 CSS Mask 渲染：

- `mask-image` 和 `-webkit-mask-image` 指向本地 SVG URL。
- `mask-position: center`、`mask-repeat: no-repeat`、`mask-size: contain`。
- 图标实体使用 `background-color: currentColor`。

该方式不执行 SVG 内容，不使用 `v-html`，同时绕开现有资源中的固定 `fill`。按钮可以继续通过 `color` 控制正常、悬停、选中、禁用和深色主题状态。所有功能图标按单色轮廓/实体处理；本次没有需要保留多色填充的资源。

## 视觉规则

- 默认图标尺寸为 16px；紧凑辅助控件可使用 14px，应用标志或强调控件可使用 18px。
- 图标在按钮中居中，不改变现有按钮点击区域、工具栏高度和侧栏宽度。
- 核心历史与剪贴板操作保留当前可见文字，采用“图标 + 文字”，避免只靠图形识别。
- 文字样式、对齐、展开/折叠、窗口控制等高频紧凑操作使用纯图标，同时保留现有 `title` 和 `aria-label`。
- 每个纯图标按钮必须具有非空 `aria-label`；若图标或状态变化，`aria-label` 与 tooltip 必须同步变化。`title` 不能作为唯一可访问名称。
- 选中态继续由按钮背景、边框和 `aria-pressed` 表达；图标颜色继承按钮状态，不单独硬编码。
- 禁用态保持足够可辨识度，并由现有 `disabled` 语义阻止交互。

## 窗口状态

标题栏最大化按钮必须显示真实窗口状态：

- 普通窗口显示 `maximize.svg`。
- 最大化窗口显示 `restore.svg`。
- 普通状态按钮使用“最大化窗口”作为 `aria-label` 和 tooltip；最大化状态使用“还原窗口”，不能只切换图形。
- `fullscreen.svg` 不用于最大化或还原。
- `fit_to_screen.svg` 只用于调整图表视口，不表示桌面窗口状态。

现有 `WindowController` 仅提供无返回值的 `toggleMaximize()`，无法驱动准确图标。实现时新增 `watchMaximized(handler): Promise<() => void>`：适配器必须先注册原生窗口尺寸变化监听，再读取一次当前 `isMaximized()` 并立即调用 handler；后续每次尺寸变化重新读取状态，仅在布尔值变化时通知。返回的清理函数必须在 `AppShell` 卸载时调用。

`watchMaximized` 内部为每次状态查询分配递增序号，只有最新序号的结果可以更新缓存和调用 handler；清理后所有未完成结果均被忽略。初始 UI 保守显示 `maximize`。监听注册失败时拒绝 Promise；初始查询失败时保留监听并等待下一次尺寸事件；后续单次查询失败时保留最后状态。`AppShell` 对一次监听故障只显示一次通知，并在卸载时调用已取得的清理函数。

`toggleMaximize()` 保持命令职责，不由 UI 乐观翻转状态；图标只响应 `watchMaximized` 返回的已确认值。Tauri 适配器使用原生 `onResized` 与 `isMaximized`；浏览器测试适配器维护确定性的本地布尔值并发送同样事件。

## 数据流

1. 业务组件按操作选择语义 `IconName`。
2. 图标注册表将语义名称解析到 Vite 资源 URL。
3. `AppIcon` 以 CSS Mask 渲染，并继承所属控件的 `currentColor`。
4. 控件继续调用原有 store、controller 或 emit，不改变命令和撤销语义。
5. `watchMaximized` 发送已确认状态，`AppShell` 更新 `TitleBar` 的 `maximized` 属性，从而同步图标、`aria-label` 和 tooltip。

## 错误与边界

- 图标资源由静态导入和构建验证保证完整；资源缺失属于构建失败，而不是运行时可恢复状态。这样纯图标按钮不会在可用安装包中变成不可见控件。
- 不允许从网络加载图标，所有资源必须随应用打包。
- SVG 只作为 Mask URL 使用，不解析或执行其中脚本。
- 深色模式通过 `currentColor` 继承现有主题。强制色模式只对 Mask 图标本体设置 `forced-color-adjust: none`，并显式使用 `CanvasText`；禁用控件内使用 `GrayText`，选中控件内使用 `Highlight`。按钮本身继续接受系统强制色调整，焦点轮廓继续使用现有 `Highlight` 规则。该行为必须以 Chromium 强制色仿真验证图标实际可见。
- 相同操作在不同界面复用同一语义名称和资源，避免局部自行选择近似图标。

## 测试与验证

- 单元测试验证所有公开 `IconName` 都映射到本地 SVG URL，关键功能不存在遗漏或重复语义。
- 组件测试验证 `AppIcon` 的 Mask 样式、尺寸和 `aria-hidden`，并验证缺失资源的开发期错误。
- 现有组件测试按“验收映射”逐项检查图标语义标记，同时继续验证可访问名称、动态 tooltip、键盘焦点、`aria-pressed`、`disabled`、选中态和点击行为。
- 窗口控制器测试覆盖监听后初始状态、标题按钮切换、外部最大化/还原事件、监听清理、查询失败保持旧状态，以及最大化/还原两种可访问名称。
- 主题测试验证图标继承浅色、深色、强制色和禁用控件颜色，不依赖 SVG 内部固定 `fill`。
- 浏览器 E2E 验证主要外壳图标可见，核心操作仍可触发；在 Tauri 支持的 960px 最小宽度以及 1024px、1280px、1440px 下，工具栏保持 48px 单行、所有当前控件可见、不可换行、不可裁剪且不产生水平滚动。
- 负向回归检查确认形状注册表、形状定义和图元缩略图绘制未被图标系统替换或修改。
- 运行完整 `pnpm test`、`pnpm build` 和聚焦 Playwright 套件。

## 资源约定

- 当前资源继续保存在 `src/ui/icons/svg/`。
- 新文件优先采用 `snake_case.svg`，但本次不为统一命名而批量重命名用户提供的资源。
- 注册表负责兼容现有的连字符文件名。
- `fit_screen.svg`/`fit_to_screen.svg`、`straight_line.svg`/`minimize.svg` 等重复资源不在本次删除；实现只引用语义准确且命名更清晰的一份。
