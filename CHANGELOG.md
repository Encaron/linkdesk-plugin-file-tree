# 更新日志

## v1.0.26（2026-10-05）

- **说明**：在文件上右键时，文件树现在会把「这是不是文件、扩展名是什么」公开给宿主——第三方插件的右键菜单项可以据此**只对某类文件出现**（例如一个 Markdown 插件只在 `.md` 上显示它的菜单项）。文件树自己的 18 项右键菜单行为、单击/双击打开方式均不变。

## v1.0.25（2026-10-04）

- **配置项行名短名**（配置项短名案）：设置页「资源管理器」组 18 条设置此前行名只能裸显英文配置键，现补声明式短名（如 `sortOrder` → 「排序方式」、`compactFolders` → 「紧凑文件夹」、`external.windowsExec` → 「外部终端」），中文原文即 i18n key，英文界面走本仓 i18n 译名。
- **枚举下拉不裸显英文值**：`sortOrder`（6 档）与 `incrementalNaming`（2 档）此前无 `enumDescriptions`，下拉直接显 `foldersNestsFiles` / `disabled` 这类英文值——现补对象形态显示名（「文件优先」「重名自动编号」等），并补英译。
- 第三方存量声明不受影响：无短名者照旧回退显配置键。

## v1.0.24（2026-10-03）

- **补刀：筛选输入框（「要包含的文件」／「要排除的文件」）对齐 `.ldk-input` 契约**——1.0.23 治了搜索/替换两行，这两个筛选框是同 section 的漏网之鱼：原先**连 `border-radius` 声明都没有**（恒直角，`app.surfaceRadius` 调多大都不动）。补 `--radius-sm`（跟主题圆角走）＋ 底色 `--bg-card` → `--bg-input`（与搜索/替换字段同源）＋ 聚焦 accent 边＋2px 焦点环。仅 CSS，零逻辑、零结构改动。
- **读数**：`npm run verify` 八段全绿 · `vitest run` 16 文件 149 例全绿 · `npm run build` 4/4 表面。

## v1.0.23（2026-10-03）

- **侧栏「搜索」section UI 重设计（案A · 零件版）**——病灶是 SearchView 全部自绘、不吃主题 token：「输入框不随圆角变化」「替换钮没有按钮边缘、看着不像按钮」。设计档案住壳仓 `docs/05-插件更新/文件树-搜索重设计/`（2026-10-03 拍板：案A ＋ 四项细化）。
  - **「全部替换」换共享 `Button`**（`@linkdesk/ui`，实心 accent——按钮双轨约定「做什么用实心钮」）：四态齐了（禁用 / 可用 / hover / 替换中进度文案），本地 `.file-tree-search-replace-btn` 样式整块退休。
  - **输入壳契约对齐壳侧 `.ldk-input`**：`--bg-input` / `--border` / `--radius-sm` / 聚焦 accent 边＋2px accent 环——圆角跟主题走了。高度改内容驱动（竖 padding 4px 与 `.ldk-input` 同），与共享 Button 同一条自然高公式 ⇒ 同行等高，--ui-scale 由字号 token 自带（原 28px 死值退休）。
  - **Aa/ab/.* 选项钮收进输入框内右端**（VS Code 同款）：ghost 态＋激活 accent 淡底，~80px 还给输入框，170px 最小侧栏宽下仍可用。
  - **替换字段幽灵降级**：常显但透明底无框、聚焦才现框——治「两框贴在一起」（拍板 D6＝常显＋幽灵降级）。
  - **行距 4px→8px**（触点间距 ≥8px 节奏）＋ 结果行匹配段高亮（`<mark>` accent 淡底，切片用 wire 契约自带的 `matchStart/matchEnd` 列区间——纯视图，零搜索逻辑）。
  - ⛔ 搜索纯逻辑（useSearch / useReplaceAll / searchCommands 等）零接触；⛔ 壳仓与 `@linkdesk/ui` 零改动。
- **读数**：`npx tsc --noEmit` 零错误 · `npm run verify` 八段全绿 · `vitest run` 16 文件 149 例全绿 · `npm run build` 4/4 表面 46.5 KB。

## v1.0.22（2026-10-01）

- **安装包瘦身**：包内更新日志只带最近 5 版（更早的更新记录仍在本插件仓库里）——由 SDK 自动施加，用户无需任何操作。

## v1.0.21（2026-09-30）

- **自有翻译归位（E6#161「谁的仓谁译文」）**：本仓 6 条可渲染文案的英文译名住进**本仓字典** `i18n/en.json`（新增 6 条） ＋ `contributes.i18n` 声明——不再依赖 `lang-defaults` 代管：文案在本仓声明、译名却在别的仓的字典里，本仓加一条声明那只仓无从跟上（跨仓追不上）。译名取值：池里现成的照抄（同键同值 ⇒ 按 E6#161「同值覆盖不出声」规则运行时零变化），池里没有的 3 条新写。
- **判据随 SDK 下发**：`@linkdesk/plugin-sdk` ^0.1.56 → **^0.1.61**——`npm run verify` 第 ⑧ 段「自有字典覆盖度」（manifest 渲染串缺口 🔴 / 源码 `t()` 缺口 ⚠️）由 `@linkdesk/plugin-sdk/own-dict-coverage` 判定（判据本体在 SDK，⛔ 不在本仓复制）。

## v1.0.20（2026-09-29）

- **修：侧栏「打开文件夹」section 的悬停/按下态落到 `unset`——悬停时主按钮把底丢掉、最近项零反馈。** 起因是 FT#4 的 216px 视觉走查：`OpenFolderView.css` 的 `:hover`/`:active` 用了 `var(--tree-bg-hover)` / `var(--tree-bg-selected)`，而这两个 token 定义在 `.file-tree-root`（`file-tree-shell.css` §设计 Token）——本 section 挂在 `ldk-sidebar-section-body` 下，**祖先链里没有 `.file-tree-root`**（实测链：`file-tree-open-folder-btn → file-tree-open-folder → ldk-sidebar-section-body → …`）。`var()` 在这种作用域取到空串 ⇒ 该声明在**计算值期**非法 ⇒ 落 `unset`。
  - **实测（`CSS.forcePseudoState` 强制 `:hover`，非目测）**：主按钮 `background-color` `rgb(45,45,45)`（`--bg-card`）→ **`rgba(0,0,0,0)`**，即不是「叠一层悬停底色」而是**把底清空**；最近项背景恒 `rgba(0,0,0,0)` ⇒ **悬停毫无反馈**。`border-color: var(--accent)` 不受影响（`--accent` 全局定义）⇒ 悬停时只剩边框变色、底反被抹掉。
  - **修法**：三处声明带 fallback（`var(--tree-bg-hover, color-mix(in srgb, var(--text-primary) 6%, transparent))`、selected 为 15% accent）——与同仓 `SearchView.css` 四处**既有写法一致**。⛔ 不动 token 定义位置（那是树节点的作用域）、不动骨架与类名。
  - **读数**：`npx tsc --noEmit` 零错误 · `npm run verify` 六段全绿（lint 严格腿 75 文件零偏离）· `vitest run` 16 文件 **149 例** · `npm run build` **4/4 表面 / 74.9 KB**。

## v1.0.19（2026-09-29）

- **修：文件菜单里的 5 项 file-tree 贡献「从来没有过」**（用户 2026-08-11 起就发现菜单项不见了，一直以为是自己误删——**不是**）。真因可指认到具体一行：`af2ef5712`（E5.6#11.5 Path B 池核心隔离）为切断插件对 `@src/core` 的 import，把 `MenuId` 内联成字符串字面量时，**把枚举的「成员名」当成了「值」**——写成 `MenuId = { FileContext: "FileContext", MenuBar: "MenuBar" }`，而壳侧 `MENU_SLOTS.MenuBar` 的值当时已经是 `"menuBar"`（小驼峰）。壳的菜单表是精确字符串键、零归一化，只按 `MENU_SLOTS.*` 的值取 ⇒ 贡献落进**另一个键**，无消费者、无报错、无日志，界面表现就是「这条菜单不存在」。历次重构只把这两处死键原样搬家，因为**没有一条判据看菜单槽位 id 的大小写**。
- **修法：菜单项改声明式**。删掉 `src/components/FileTreeContextMenu/commands/menuItems.ts`（命令式 `menu.registerItems(...)` 的唯一内容），改由 `plugin.json` 的 `contributes.menus` 承载：`menuBar` = 5 项（新建文件 / 新建文件夹 / 打开文件夹… / 关闭所有编辑器 / 关闭文件夹）＋ 一个「编辑」子菜单（`command: ""` ＋ `children`，`group` 由 `edit` 改 `file`，并进「文件」组渲染成 `文件 ▸ […, 编辑 ▸]`，**顶级菜单集合一个不增**）；`fileContext` = 原 18 项原样搬（各 `when` / `label` / `group` 一字未动）。消费端 `Menu.tsx` 的 `menuId={"FileContext"}` 同笔改 `"fileContext"`——两处原先靠**读写同一个错键**自洽，只改一边会弄坏右键菜单。`file-tree.closeAllEditors` 补进 `contributes.commands`（它原先只运行时注册，不在声明面）。
- **修：「装了就显示」的另一半——点了要真能动**。菜单声明面由加载器在**插件装载时**注册（与视图是否 mount 无关，卸载由加载器 disposer 回收）；但命令 **handler** 原先只在 `FoldersView` mount 时注册 ⇒ 在**从没打开过文件树视图**的会话里，那 5 项是「点得着、点了没反应」。本版把 `activateFileTreeContextMenu()` 提到入口顶层（`src/index.tsx`）——与既有的 `registerSearchCommands()` 同一时机，走池的 on-command 激活契约（命令 miss ⇒ 池 `import()` 入口 ⇒ 顶层副作用注册 handler ⇒ 重试即命中）。`FoldersView` 那处调用**保留不动**（它是 dev-host / 纯浏览器预览里唯一的注册路径），函数自带 `_registered` 幂等闸。
- **新增：侧栏 explorer 容器的常驻 section「打开文件夹」**（`order 2`，排在搜索下方）。起因是**唯一 UI 入口原在欢迎页**——而欢迎页是可关闭的标签页保底，关掉它、或把文件树目录清空之后，全软件再没有一处 UI 能打开文件夹。section 内容 = 主按钮「打开文件夹…」＋ 最近 5 条（点最近项走 `workspace.addFolder`，**添加**语义，与欢迎页同一个 API）。主按钮打 `file-tree.openFolder` 命令——与文件菜单、命令面板**同一条链**，不写第二份逻辑。
  - **只有数据是借来的**：最近列表**只读**消费欢迎页写在 `pluginState("app","recentFolders")` 的那份（形如 `{ path, name }[]`，上限 10）。不写回——两个写方各写一份必然互相覆盖。订阅走 `pluginState.onChange`（回调**直接带新值**）而不是 `onDidChangeFolders`：后者是「广播在前、落盘在后」，在同一条广播里重读读到的是上一版，表现为「刚打开的目录不在最近里」。
- **`FoldersView` 空态补一行 muted 占位**（原来无工作区根时是**纯空白**，连占位都没有）。只做**组件内部条件渲染**，组件本体（含 `onDidChangeFolders` 订阅）始终挂载——`registerViewEmptyContent` 那种「外部替换整个组件」的形态 2026-08-03 造成过死锁（视图被替换 ⇒ 订阅随 unmount 注销 ⇒ 点「打开文件夹」后无人听广播 ⇒ 永久空白，见 `docs/05-插件更新/文件树/01-打开文件夹入口-设计.md` §二·五），本版不碰那条路。不带按钮——按钮职责归上面的常驻 section。
- **删孤儿 `src/views/WelcomeView.tsx`**（119 行，自 2026-08-03 `231257d16` 起无人 import 的死代码；其最近列表素材已折进常驻 section）＋ `file-tree-node.css` 里只为它存在的 12 条规则（`.file-tree-welcome*` / `.file-tree-recent*` / `.file-tree-dragover-hint`）＋ 1 个孤儿字典键（`释放以打开文件夹`）。
- **`i18n/en.json` 净 +1 键（73 → 74）**：新增 `最近` → `Recent`、`打开文件夹` → `Open Folder`（后者是侧栏 section 标题——`contributes.views[].title` 是原样下发的、加载器不翻，运行时注册那一笔才补译文），删 1 个孤儿键。
- **读数**：`npm run verify` 六段全绿（lint 严格腿 75 文件零偏离；声明自洽「3 个视图的 render 全部兑现」；字典 74 键；纯逻辑单元 14 个全部有测试）；`npx tsc --noEmit` 零错误；`vitest run` 16 文件 149 例全绿；`npm run build` 产出 4/4 表面（新增 `views/OpenFolderView.bundle.js`）。
- **配套的机械门禁在 SDK 里**（本版 devDependency 起 `@linkdesk/plugin-sdk` 0.1.56 新增腿 `linkdesk/no-menu-slot-case`）：菜单槽位 id 与宿主 `MENU_SLOTS` 的某个值**仅大小写不同** ⇒ 判红。这条判据刚好能判死本版的病根（`"MenuBar"` / `"FileContext"`），而 `MenuId` 是开放字符串、第三方可自造注册点 ⇒「未知 id」不判——所以它既严格又零假红。本仓 `npm run verify` 的 lint 严格腿自动吃这条。

## v1.0.18（2026-09-28）

- **新增命令 `file-tree.openSearchResult`（打开搜索结果）**——把「打开一条搜索匹配」这条**原本只有鼠标**的动作接进命令面：界面上它只能靠**双击结果行**（`SearchResults.tsx` 的 `onDoubleClick`），F4 那条键盘路要先让搜索框拿到焦点、且本身不是命令 ⇒ AI、快捷键、命令面板都够不着它。判定目标这一半（`searchSession.ts` 解析规则）与开标签页那一半（走与双击**同一个** `openMatch`，不另写第二份 `tabs.create`）都是纯逻辑/复用，故无并行实现。
- **目标从哪来**：搜索结果本体住在 `useSearch` 的 React state 里，命令 handler 不在 React 上下文——现在搜索/导航变化时把 `(matches, index)` 投影进模块级快照，命令缺省打开**当前高亮那一条**，也可按 `filePath`（可再带 `lineNumber`）点名要哪条。视图卸载即清空 ⇒ 命令如实回「没有搜索结果」，⛔ 不给一个界面上早已不存在的陈旧目标。
  - 注册点在**入口顶层**（`src/index.tsx`）而非视图 `useEffect`：无视图时 AI 经 `exec` 打进来靠池的 on-command 激活 `import()` 入口，顶层的副作用才是唯一注册时机。右键菜单那批既有命令仍由 `FoldersView` mount 时注册——本笔**只加不减**。
- **补齐 21 条既有命令的说明（`description`）**：本仓命令只声明了 `title`，命令索引里一行说明都没有。检查命令清单的使用者（AI、未来的命令面板检索）只能看到名字。21 条按各自 handler 的**真实行为**逐条写（含「占位、未接实现」两条与「与『打开』走同一条链路」这类**如实**读数），并给新命令补 `params`。
- **说明与参数只写在声明面**：`title` / `description` / `params` 一律只进 `plugin.json` 的 `contributes.commands[]`；运行时 `registerCommand` **不带 meta**（本仓既有惯例——两处各写一份文案迟早分叉）。壳加载器会把声明面的说明与参数注册进命令索引，池侧不带这两项时不会抹掉声明面那份。
- **新命令不进运行时 meta 面**，命令面板的可见性由 `when` 管；本命令不设 `when`（无门）。若面板列出它而当前没有搜索结果，如实在面板里报「没有搜索结果」，不静默。
- **`i18n/en.json` 补 1 键**（`打开搜索结果` → `Open Search Result`，字典 72 → 73）。其余 21 条标题的英文键此前已在。
- **测试**：新增 `src/__tests__/searchSession.test.ts`（16 例）——解析规则 9 例（空会话／缺省高亮／索引 `-1` 与越界的兜底／反斜杠与正斜杠等价／同行号唯一确定／点名不存在的文件为 `null`／卸载即清空）＋ 命令面 7 例（注册 1 条且 id 正确／`commands` 面缺失时返回 0 而不抛／缺省打开的是高亮那条并回报 `index`+`total`／点名优先于高亮／两条负控「不存在的文件」「扩展名没有属主插件」都必须**不碰** `tabs.create`）。
- **既有读数**：`vitest run` 16 文件 149 例全绿；`npm run verify` 六段全绿（声明面 22 名 / 运行时面 25 名，命令归属零偏离；字典 73 键；纯逻辑单元 14 个全部有测试）。`npx tsc --noEmit` 零错误。无用户可见的既有行为变化。

## v1.0.17（2026-09-27）

- **悬停提示收编（04「悬停提示系统」件 4）**：本仓 **15 处**小写标签上的原生 `title=` 全部换成壳的 `data-hint` 属性式提示（14 处说明类 ＋ 1 处揭示类另加 `data-hint-delay="0"`）；其中 **8 枚图标钮**（子代只有一枚 codicon 字形）同笔补 `aria-label`——它们原本唯一的名字来源就是那个 `title`，只换属性会让按钮变成「没名字的按钮」。
- **为什么换**：原生 tooltip 是 Chromium 的系统 UI，壳的 CSS 碰不到——不跟主题、不跟字号；`data-hint` 走壳自绘的提示条，并自动带出该命令的快捷键（与右键菜单同一份映射）。DOM 结构、类名、可见文字零变化。
- **`minAppVersion` 0.2.13 → 0.2.20**：提示条本体（`HintTipRenderer`）由壳提供，0.2.20 起才有——在旧壳上 `data-hint` 是惰性属性，那批按钮会**没有任何提示**（比原生 tooltip 更糟），故此版起要求应用 ≥0.2.20。
- **`@linkdesk/plugin-sdk` ^0.1.41 → ^0.1.49**：新腿 `check-native-title` 判红原生 `title=`（本仓现为 **0 处**）——本仓的 `ci-verify` 严格档自动吃这条腿。

## v1.0.16（2026-09-26）

- **修：刷新目录时同一个文件夹被并发读两遍盘**（E6#149 补测读出的真 bug）。`refreshDirSafe` 原写法调用 `model.refresh(dir)` **没写 `await`**，紧接着又按「子项缓存是空的」补了一次 `getChildren`——而 `refresh` 在它前面刚把该目录的子项清空并起了读盘，于是同一目录**同时读两遍**，两份结果写同一个字段、并多触发一轮界面刷新。`refresh` 对**已展开**目录本来就会重读子项并触发变更（折叠目录不需要子项）⇒ 那次补读是纯重复劳动，已删；`await` 顺带让刷新失败（含异步拒绝）真正落进失败通知出口，而不是变成无人接的拒绝。
- 用户可见差异：右键对已展开目录做删除 / 粘贴这类会刷新目录的操作时，**少一次磁盘读、少一轮重绘**；目录内容显示不变。大目录或慢盘上更容易察觉。
- 无新能力、无接口变化。

## v1.0.15（2026-09-19）

- **重打可复现**：@linkdesk/plugin-sdk 0.1.42 起 zip 目录条目时间戳钉死，同一份源码重打逐字节一致。插件内容零变化（仅 plugin.json 版本号随包更新）。

## v1.0.14（2026-09-19）

- **删 5 处「有规则、无渲染方」的 CSS 死类**（E6#113）：`.file-tree-sidebar`／`.file-tree-header`／`.file-tree-breadcrumb`／`.file-tree-breadcrumb-icon`／`.file-tree-breadcrumb-path`——旧 `sidebar.tsx` 的容器／头部／面包屑（E36#10 拆除后侧栏外壳由壳的 `SidePanel`／`SidebarSection` 接管，插件侧 JSX 不再画那些节点，当年为其写的 CSS 未同笔删）。删前实机 CDP 普查：三仓视图真开状态下候选类名在 DOM **零存在** ⇒ 删除像素级零视觉变化；删后仓内 src 零残留、`verify`／`test` 全绿。无功能变化。

## v1.0.13（2026-09-19）

- **声明最低壳版本 `minAppVersion: "0.2.13"`**（E6#128 · L9 收尾补正）：本仓自上一版起改由**壳池集中供给** `@linkdesk/ui`（构建时 external、运行时向壳要同一份实例）⇒ 需要 **≥ 0.2.13** 的壳（该版本起池里才有 `@linkdesk/ui` 这件货）。此前本清单**没写这个字段** ⇒ 市场与加载期都拦不住「新插件 × 旧壳」的组合（旧壳上插件视图打不开，壳被 ErrorBoundary 兜住、不崩）。本版**只加这一行清单字段 + 版本 PATCH**，源码与产物行为零变化。

## v1.0.12（2026-09-19）

- **换轨到「壳池集中供给」（E6#125 · L9 第 9.4 轮）**：`@linkdesk/ui` 不再编译进本插件 bundle——构建时 external，运行时由壳池供给同一份实例。本仓源码 `import` 一行未改，只把依赖从 `^0.3.0` 换到重锚号 `^0.2.13`（`@linkdesk/ui` 自此与壳同号锁步）＋ `@linkdesk/plugin-sdk` `^0.1.19 → ^0.1.41`，重新构建发布。
- **读数（产物前后对照）**：包 **345,169 → 66,744 字节（−80.7%）**；根 bundle JS **622,881 → 83,967 字节**。产物里组件实现痕迹（`data-overlay-wrapper` / `overlay-root` / `ldk-*` 类名）grep **零命中**，只剩 `from "@linkdesk/ui"` 裸 specifier 交给壳解析。
- **行为零变化**：组件与样式改由壳统一供给 ⇒ 以后壳改共享件样式，本插件**自动跟随**，不必为此重发。

## v1.0.11（2026-09-17）

- **命名空间归一（E6#111n-1）**：本仓所有贡献点名字收进 `file-tree.` 前缀——**21 条声明命令 id ＋ 25 处运行时注册 ＋ 18 个设置键 ＋ 11 个上下文旗子**，共 75 项。旧名（`explorer.*` / 裸名旗子）一律去掉第一段换成 `file-tree`，**词干一个字母没动**（`explorer.newFile → file-tree.newFile`、`explorerFocus → file-tree.focus`），改名形状经机械证明：把工作区内容按逆映射还原回旧名，与改名前的 git blob **逐字节相等**（93 文件比对，差异全部有据）。
- **还回两处借用的名字**：`editor.selectForCompare` / `editor.compareWithSelected` 由本仓注册却占着 `editor.*` 命名空间——卸载本仓时它们永不被清理、卸载 `editor` 时反被误删，本版还回 `file-tree.*`；旗子 `inputFocus`（共享组件的名字）同样还回 `file-tree.inputFocus`。
- **快捷键的 `when` 条件同笔跟改**：`plugin.json` 里 6 条键位是**双重命中区**——同一行既有命令 id 又有旗子名（`Enter` → `file-tree.openFocused`，`when: file-tree.focus && !file-tree.inputFocus`）。这类字符串**没有编译期检查**，改漏只会静默失效，逐条核过。
- **上位约束 = 操作体验零变化**：设置项取值、快捷键行为、右键菜单逐项显隐**全部逐条实测比对，与升级前一致**（设置项 18/18 取值不变；键位 6 条默认 ＋ 3 条自定义全部照旧生效、零冲突；右键菜单在文件/文件夹/根节点/空白 4 种场景下条目数与顺序、快捷键提示、禁用态逐字节相同）。
- **无功能变化、无视觉变化**。宿主侧配套发布 1.42，老用户的设置键与自定义快捷键**由宿主自动搬家**，无需手工处理。

## v1.0.10（2026-09-16）

- **适配宿主 E6#109l-b 的共享组件类名归一（`@linkdesk/ui` 0.3.0）**：共享组件余下的 52 个类名一律收进 `ldk-` 前缀——`colorpicker-*` / `ctx-*` / `form-row` / `inline-input*` / `number-input*` / `segmented-radio*` / `sidebar-section*` / `theme-picker*` / `theme-card` / `theme-preview` / `.tbadge` / `.tname` / `.pv-*`，外加关键帧 `selectbox-in → ldk-selectbox-in`。至此**宿主与共享组件自己定义的类名 100% 是 `ldk-` 开头**（258 ＋ 89 个独立定义，零例外），规则只剩一句、不再有任何登记表。
- **本仓源码零改动**：本仓自己的 CSS 与 TSX 对这批共享组件类名的引用逐条核过 = **0 处**（本仓用组件本身，没有用后代选择器去微调它们）。
- **依赖**：`@linkdesk/ui` `^0.2.0 → ^0.3.0`（**必须手动放宽区间**——0.x 的 caret 只在上界之内挑版本，`^0.2.0` 永远够不到 0.3.0）＋ 随包 `@linkdesk/plugin-sdk` `0.1.23 → 0.1.25`。
- **解包复核（真产物）**：解开本版的 `file-tree.linkdesk-plugin` ⇒ 本仓自己的 CSS/JS **旧名 0 命中**；随包 `@linkdesk/ui` 的 CSS 里新名有命中。
- 无功能变化、无视觉变化。

## v1.0.9（2026-09-15）

- **CSS 类名带插件前缀**（E6#109h-b③ 件 2 落地）：搜索视图那 28 个裸类名（`.search-view` / `.search-input` / `.search-match`…）一律改成 `file-tree-` 前缀（`.file-tree-search-view` / `.file-tree-search-input`…）——CSS 定义点、TSX 渲染点、`querySelector` 一处不落。裸类名在「宿主 ＋ 共享组件 ＋ 所有已加载插件」同一张样式表里是**全局标识符**，跨插件撞名会静默改掉外观（不报错、只是长得不对）
- 顺带清掉一处**活体撞车**：`.search-input` 此前与 `serial-monitor` 的同类名**双方各定义一份、规则体还不一样**，级联合并后谁后加载谁赢一半——加前缀后该撞车自然消失
- **`@linkdesk/ui` 抬到 `^0.2.0`**（^0.1.4 → ^0.2.0）：旧版随包注入的 8 个共享组件裸类名（`badge` / `slider` / `toggle`…）仍在池样式表里占全局名；0.2.0 起这些名字已带 `ldk-` 前缀
- 无功能变化——类名是标识符，视觉**逐字节等价**（改名形状 = 只插入前缀，机械证明见交接档）

## v1.0.8（2026-09-15）

- **分发件补上 MIT LICENSE**：`LICENSE` 早就在本仓里（E6#108g 那批加的），但**已发布的那版产物比它早** ⇒ 用户手上那份 zip 里一直没有版权声明。MIT 要求「副本里带声明」，而 zip 才是用户真正拿到的那份
- **不再夹带仓库面文件**：`@linkdesk/plugin-sdk` 升到 0.1.19（^0.1.14 → ^0.1.19）——旧 SDK 的打包通道会把 `marketplace.json` / `scripts/ci-verify.mjs` / `AGENTS.md` 这类**仓库面文件**一起装进 zip（那是给仓库看的，不是给用户看的），0.1.19 的排除表已覆盖
- 无功能变化——本版只为让「用户拿到的产物」与仓库对齐

## v1.0.7（2026-09-14）

- 源码迁入独立仓（E6#99，L7 第 7.2 轮）——从壳仓 `Encaron/linkdesk` 抽出本插件子树，历史全保（hash 变）
- 随包 `plugin.json` 显式声明 `pluginId`（E6#98g）：插件身份不再靠目录名兜底，独立仓构建出的包名与身份稳定
- `$schema` 改指本仓 `node_modules/@linkdesk/plugin-sdk`（脱离壳仓后原相对路径指到仓外，编辑器补全/校验会失效）


## v1.0.6（2026-09-11）

- 更新记录迁入包内的 `CHANGELOG.md`（E6#92 元数据归一）——此前写在 `plugin.json` 的 `changelog` 字段里，市场详情页读不到

## v1.0.5（2026-09-11）

- 内部整理（E6#87a）：源码按体量阈值拆分重排——文件树 / 搜索 / 右键菜单 / 键盘导航 / 拖放各归其位，模块级状态单一属主。**功能与界面零变化**；因重打包后内容已变，按「内容变更必 bump」纪律更新版本号（E6#15n）

## v1.0.4（2026-09-11）

- 长任务失败不再一声不吭（E6#73m）：①拖放、粘贴、删除整个目录失败时——源文件被占用、没有权限、跨盘符——此前界面上什么都没有，树没刷新也没报错，看起来就像操作成功了；现在会明确告诉你是哪个文件、什么原因，一次操作只报一条、不刷屏；②「全部替换」进行期间按钮不能再点（此前连点两次会让同一批文件互相覆盖），按钮上会显示「到第几个了」；部分文件没替换成功时结果里会点名是哪几个（此前只写进开发者日志，用户看不到）

## v1.0.2（2026-09-09）

- 图标身份分工（E6#69 三图模型）：icon → resources/icon-bar.svg（Type-1 files 剪影，仅图标栏用）；marketIcon → resources/icon.svg（Type-2 彩色身份图）；整幅封面迁入 README
