/**
 * navigation 命令组——打开 / 定位 / 搜索 / 工作区（E6#87a 二次拆分）。
 */
import { dirname, extension, normalizePath } from "../../../utils/pathUtils";
import { h, getOpenFileFn } from "../host-bridge";
import i18n from "i18next";
// 宿主命令面走 SDK **子路径**：根入口 `@linkdesk/plugin-sdk` 还 re-export 构建工具（vite.config → vite），
// 插件源码一旦从根入口取值，rollup 会把整条构建链打进 .linkdesk-plugin（Windows 上要解析 fsevents ⇒ build 红）。
import { openWith } from "@linkdesk/plugin-sdk/shell-commands";
import { placeholder, type FileMenuContext } from "./shared";

const lk = window.linkdesk;

export function registerNavigationCommands(): void {
  // ── E4V#18: revealInOS ──
  lk.commands.registerCommand("file-tree.revealInOS", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (!ctx) return;
    window.linkdesk?.shell?.showItemInFolder(ctx.uri);
  });

  // ── E4V#19 + E5#22: openInTerminal——从配置读取终端类型，不再硬编码 PowerShell ──
  lk.commands.registerCommand("file-tree.openInTerminal", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (!ctx) return;
    const targetPath = ctx.isDirectory ? ctx.uri : dirname(ctx.uri);
    // 插件走 linkdesk.configuration API——禁止直接 import ConfigurationService
    const cfg = window.linkdesk?.configuration;
    const terminalExe = (await cfg?.get<string>("file-tree.external.windowsExec")) || "powershell";
    const customCommand = (await cfg?.get<string>("file-tree.external.customCommand")) || "";
    window.linkdesk?.shell?.openInTerminal(targetPath, terminalExe, customCommand);
  });

  // ── E4V#30: file-tree.revealInExplorer——定位文件并展开目录链 ──
  lk.commands.registerCommand("file-tree.revealInExplorer", async (...args) => {
    const hd = h(); if (!hd) return;
    // 兼容多种 arg 格式：string | { filePath } | { uri } | FileMenuContext
    let targetUri: string | null = null;
    const arg = args[0];
    if (typeof arg === "string") {
      targetUri = normalizePath(arg);
    } else if (arg && typeof arg === "object") {
      const obj = arg as Record<string, unknown>;
      targetUri = normalizePath((obj.filePath ?? obj.uri ?? "") as string);
    }
    if (!targetUri) {
      // 无参数→回退到 focused item
      targetUri = hd.getFocusedUri();
    }
    if (!targetUri) return;
    await hd.reveal(targetUri);
  });
  // ── E4V#28: openFile —— 扩展名→FileAssociation→createTab ──
  lk.commands.registerCommand("file-tree.openFile", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (!ctx || ctx.isDirectory) return;
    const name = ctx.uri.split("/").pop() ?? ctx.uri;
    getOpenFileFn()?.(ctx.uri, name, "pin");
  });
  // ── E4V#29: openToSide —— 在侧边分屏打开文件 ──
  lk.commands.registerCommand("file-tree.openToSide", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (!ctx || ctx.isDirectory) return;
    const name = ctx.uri.split("/").pop() ?? ctx.uri;
    getOpenFileFn()?.(ctx.uri, name, "pin");
  });
  // ── F1（T2 · 第 3 波）：openWith 占位转正 = 打开方式选择器（面板已**转正到壳**）──
  // @deprecated since 1.0.28——本命令 id 只为**过渡期**保留：已装的老版本 editor/settings 仍在调它
  //   （它们届时传裸路径字符串）。新调用方一律走壳命令 `SHELL_COMMANDS.openWith`
  //   （`@linkdesk/plugin-sdk/shell-commands`——子路径，不是根入口，见本文件顶部 import 处的说明）。
  //   到期条件＝官方目录中所有插件的最低支持版本 ≥ 本版；届时整条注册删除（尾账记在主案 04-任务清单.md）。
  // 入参三形（老 editor 传裸 filePath 字符串；右键菜单传 FileMenuContext；老设置页无载荷）。
  // E17：无载荷且无活动文件（命令面板空调）⇒ no-op＋toast，不留死响应。
  // 数据组装（ext 归一 / 处理器表 / 图标）全在壳命令里——本插件只把入参**收敛成唯一形状**再转发。
  // 🔴 本版起**不再转发 `anchor`**：宿主面板自 2026-10-05 起一律居中＋遮罩（锚定态废止，
  //    `OpenWithRequest.anchor` 已标 `@deprecated`、宿主侧不再消费）⇒ 传它是死参，故本仓清掉。
  lk.commands.registerCommand("file-tree.openWith", async (...args) => {
    const arg = args[0];
    let uri: string | null = null;
    let ext: string | null = null;
    if (typeof arg === "string") {
      uri = normalizePath(arg);
    } else if (arg && typeof arg === "object") {
      const ctx = arg as FileMenuContext & { ext?: string; filePath?: string };
      uri = normalizePath(ctx.uri ?? ctx.filePath ?? "");
      ext = typeof ctx.ext === "string" ? ctx.ext : null;
    }
    if (!uri && !ext) {
      // 命令面板 / 老设置页入口——作用于聚焦项（若为文件）
      const focused = h()?.getFocusedUri() ?? null;
      if (!focused) {
        lk.notifications?.show?.(i18n.t("没有选中的文件——请先在文件树中选中一个文件"), { type: "info" });
        return;
      }
      uri = focused;
    }
    if (!uri) {
      // 按类型载荷（无文件）——直接转给壳命令；归一化由壳侧 `normalizeExt` 单一真相源负责
      openWith({ ext: ext ?? undefined });
      return;
    }
    const name = uri.split("/").pop() ?? uri;
    openWith({ uri, name, ext: ext ?? extension(name) });
  });
  lk.commands.registerCommand("file-tree.findInFolder", placeholder("file-tree.findInFolder"));
  // ── E4V#33: openFolder —— 打开工作区文件夹（MenuBar 文件菜单） ──
  lk.commands.registerCommand("file-tree.openFolder", async () => {
    await lk.workspace.openFolder();
  });
  // ── E4V#29: openFocused —— 目录→展开/折叠，文件→打开 ──
  lk.commands.registerCommand("file-tree.openFocused", async () => {
    const hd = h(); if (!hd) return;
    const focusedUri = hd.getFocusedUri();
    if (!focusedUri) return;
    const model = hd.getModel();
    const item = model.findClosest(focusedUri);
    if (!item) return;
    if (item.isDirectory) {
      if (model.isExpanded(item.uri)) {
        model.collapse(item.uri);
      } else {
        model.expand(item.uri);
        await model.getChildren(item).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
      }
    } else {
      getOpenFileFn()?.(item.uri, item.name, "pin");
    }
  });

  // ── E4V#xx: removeFolder——关闭文件夹（从工作区移除根目录） ──
  lk.commands.registerCommand("file-tree.removeFolder", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (ctx?.uri) {
      // 右键菜单调用——关闭指定文件夹
      lk.workspace.removeFolder(ctx.uri);
    } else {
      // MenuBar 调用——关闭所有工作区文件夹
      const folders = await lk.workspace.getFolders();
      for (const f of folders) lk.workspace.removeFolder(f.uri);
    }
  });

  // ── E4V#xx: closeAllEditors——关闭所有编辑器标签页（委托 core.closeAllEditors） ──
  lk.commands.registerCommand("file-tree.closeAllEditors", async () => {
    await lk.commands.executeCommand("core.closeAllEditors");
  });

  // ── E4V#38: search——聚焦搜索面板输入框 ──
  lk.commands.registerCommand("file-tree.search", async () => {
    // 搜索面板始终可见（collapsed: false），只需聚焦
    requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>(".file-tree-search-input");
      input?.focus();
    });
  });
}
