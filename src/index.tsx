/**
 * 文件树插件入口。
 * E4a #91：主区无视图——文件树仅在侧栏渲染（通过 ViewContainerService）。
 * E36#10：旧 sidebar.tsx 已删除——改为导出 FoldersView。
 *
 * 🔴 作者契约（E6#62e on-command 激活）：无视图时 AI 经 `exec` 打一条池内没注册的命令 ⇒ 池 preload
 *    会 `import()` 本入口 ⇒ **入口顶层的副作用**才是唯一注册时机。⛔ 别把这些行挪进组件的 useEffect
 *    （那要视图 mount 才注册，「没开文件树时点文件菜单」就永远够不着）。
 *
 * 入口顶层两笔注册（2026-09-29 起）：
 *   ① `registerSearchCommands()`——M2 `AI#24` 补（搜索命令）。
 *   ② `activateFileTreeContextMenu()`——FT# 批次补。原本只在 `FoldersView` mount 时注册
 *      ⇒ **没打开过文件树视图**的会话里，`plugin.json` 声明的那 5 条「文件」菜单项**点得着、
 *      点了没反应**（菜单声明面由加载器注册，与视图无关；handler 却在视图里）。用户要的语义是
 *      「**装上插件就显示**」（2026-09-29 原话），显示与可用必须同一时机。
 *      `activateFileTreeContextMenu` 自带 `_registered` 幂等闸，`FoldersView` 那处调用**保留不动**
 *      （它是 dev-host / 纯浏览器预览里唯一的注册路径——那边没有池 preload 的激活钩）。
 */

import { registerSearchCommands } from "./views/SearchView/searchCommands";
import { activateFileTreeContextMenu } from "./components/FileTreeContextMenu";

registerSearchCommands();
activateFileTreeContextMenu();

export { default } from "./views/FoldersView";
