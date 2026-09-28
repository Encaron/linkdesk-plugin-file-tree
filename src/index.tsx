/**
 * 文件树插件入口。
 * E4a #91：主区无视图——文件树仅在侧栏渲染（通过 ViewContainerService）。
 * E36#10：旧 sidebar.tsx 已删除——改为导出 FoldersView。
 *
 * M2 `AI#24`：入口顶层补一次**搜索命令**注册（`searchCommands.registerSearchCommands`）。
 * 🔴 作者契约（E6#62e on-command 激活）：无视图时 AI 经 `exec` 打一条池内没注册的命令 ⇒ 池 preload
 *    会 `import()` 本入口 ⇒ **入口顶层的副作用**才是唯一注册时机。⛔ 别把这行挪进组件的 useEffect
 *    （那要视图 mount 才注册，「没开搜索面板时让 AI 打开搜索结果」就永远够不着）。
 *    注：右键菜单那批命令仍由 `FoldersView` mount 时 `activateFileTreeContextMenu()` 注册——
 *    本行**只加不减**，不动既有语义。
 */

import { registerSearchCommands } from "./views/SearchView/searchCommands";

registerSearchCommands();

export { default } from "./views/FoldersView";
