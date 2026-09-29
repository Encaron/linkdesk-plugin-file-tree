/**
 * commands——文件树命令注册（门面，独立于 UI）。
 *
 * 对标 VS Code explorerViewer.ts 的 explorerContextMenu。
 * 设计文档：docs/02-Electron架构/E4_文件树与编辑器_暂定/02-E4b-文件树交互.md §二 #96
 *
 * 原 438 行单文件按命令组分件（E6#87a 二次拆分——`components/**` 档 150，不分扩展名）：
 *   - `shared.ts`     共用件（FileMenuContext / placeholder / refreshDirSafe）
 *   - `navigation.ts` 打开 / 定位 / 搜索 / 工作区
 *   - `clipboard.ts`  剪切 / 复制 / 粘贴 / 复制路径
 *   - `files.ts`      新建 / 刷新 / 重命名 / 删除
 *   - `compare.ts`    Diff 比较（🔴 `_selectedForCompare` 单一属主）
 *
 * ⚠️ **菜单项已不在此处注册**（2026-09-29，file-tree 1.0.19）：原来的 `menuItems.ts` 用
 * `menu.registerItems("FileContext" / "MenuBar", …)` 命令式注册，两处槽位 id 写成**枚举成员名**
 * （壳的槽位值是 `fileContext` / `menuBar`）⇒ 贡献落进死键、静默不可见（详见设计档
 * `docs/05-插件更新/文件树/01-打开文件夹入口-设计.md` §二·六）。现改为 `plugin.json` 的
 * **声明式 `contributes.menus`**：槽位键名由清单承载、加载器在插件装载时注册（与视图是否 mount
 * 无关——「装了就显示」），卸载由加载器 disposer 回收。
 * ⛔ 别在源码里再手写槽位字符串：`registerItems` 有大小写事故史，且 SDK 门禁腿
 * `linkdesk/no-menu-slot-case` 会判红。

 * 🔴 **模块级 mutable 单一属主**：`_registered` 全仓仅在本文件声明。
 */
import { registerClipboardCommands } from "./clipboard";
import { registerNavigationCommands } from "./navigation";
import { registerFileCommands } from "./files";
import { registerCompareCommands } from "./compare";

let _registered = false;

/** 注册文件树命令到 CommandRegistry。幂等。⚠️ 菜单项不在这里注册——见文件头注（声明式 `contributes.menus`）。 */
export function activateFileTreeContextMenu(): void {
  if (_registered) return;
  _registered = true;

  // ── 注册命令（占位 handler——后续任务逐步替换） ──
  // 新增命令（不在 plugin.json contributes.commands 中——此处是唯一注册点）
  registerClipboardCommands();
  registerNavigationCommands();
  registerFileCommands();
  registerCompareCommands();
}
