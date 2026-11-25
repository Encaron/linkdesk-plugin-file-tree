/**
 * clipboard 命令组——剪切 / 复制 / 粘贴 / 复制路径（E6#87a 二次拆分）。
 */
import { dirname, normalizePath } from "../../../utils/hostPath";
import { fileTreeClipboard } from "../../../services/FileTreeClipboard";
import { executeSafeDrop } from "../../../services/FileTreeDnD";
import { bumpTreeStateVersion, treeStateVersion } from "../../../services/FileTreeState";
import { fileTreeError, FILETREE_ERROR_CODES } from "../../../services/fileTreeErrors";
import { h } from "../host-bridge";
import { refreshDirSafe, type FileMenuContext } from "./shared";

const lk = window.linkdesk;

/**
 * E5#108c：写路径到系统剪贴板——原生 CF_HDROP 优先 + 纯文本 fallback。
 * E5.8#24.8.6：纯文本 fallback 从废弃 document.execCommand("copy") → linkdesk.clipboard.writeText——
 * Electron clipboard 多格式共存（writeText 只写 text/plain，不影响 CF_HDROP）；await 双写消除
 * 「text 先写、CF_HDROP 后到」的理论竞态；失败 console.error 出声（#24.6 静默链文化）。零新机制。
 */
async function writeSystemClipboard(uris: string[]): Promise<void> {
  try {
    // 原生：Windows 资源管理器可粘贴（CF_HDROP）
    await window.linkdesk?.clipboard?.writeFileList?.(uris);
    // 纯文本：编辑器/终端可粘贴
    await window.linkdesk?.clipboard?.writeText?.(uris.join("\n"));
  } catch (e) {
    console.error("[file-tree] 写系统剪贴板失败:", e);
  }
}

/** 解析命令的 uri 列表——选中集优先，其次右键目标，最后 focused */
function resolveUris(ctx: FileMenuContext | undefined): string[] {
  const hd = h(); if (!hd) return [];
  const selection = hd.getSelection();
  const focused = hd.getFocusedUri();
  return selection.length > 0 ? selection : ctx ? [ctx.uri] : focused ? [focused] : [];
}

export function registerClipboardCommands(): void {
  // ── E4V#17: copyPath + copyRelativePath ──
  lk.commands.registerCommand("file-tree.copyPath", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (!ctx) return;
    await navigator.clipboard.writeText(ctx.uri);
  });
  lk.commands.registerCommand("file-tree.copyRelativePath", async (...args) => {
    const ctx = args[0] as FileMenuContext | undefined;
    if (!ctx) return;
    const folders = await lk.workspace.getFolders();
    const root = folders.find((f: { uri: string }) => ctx.uri.startsWith(normalizePath(f.uri)));
    if (!root) { await navigator.clipboard.writeText(ctx.uri); return; }
    const relative = ctx.uri.slice(normalizePath(root.uri).length).replace(/^[/\\]/, "");
    await navigator.clipboard.writeText(relative || ctx.uri);
  });

  // ── E4V#25: cut + copy（含系统剪贴板写入——桌面粘贴需要）──
  lk.commands.registerCommand("file-tree.cut", async (...args) => {
    const hd = h(); if (!hd) return;
    const uris = resolveUris(args[0] as FileMenuContext | undefined);
    if (uris.length === 0) return;
    fileTreeClipboard.cut(uris);
    await writeSystemClipboard(uris);
    hd.rerender();
  });
  lk.commands.registerCommand("file-tree.copy", async (...args) => {
    const uris = resolveUris(args[0] as FileMenuContext | undefined);
    if (uris.length === 0) return;
    fileTreeClipboard.copy(uris);
    await writeSystemClipboard(uris);
  });

  // ── E4V#26: paste ──
  lk.commands.registerCommand("file-tree.paste", async (...args) => {
    const a0 = args[0];
    let sources: Array<{ path: string; name: string }> | null = null;
    let targetDir = "";
    let mode: "copy" | "move" = "copy";
    let skipConfirm = false;
    const normalizeSources = (list: unknown[]): Array<{ path: string; name: string }> => list
      .map((x) => {
        if (typeof x === "string" && x) return { path: x, name: x.split("/").pop() ?? "unnamed" };
        if (x && typeof x === "object" && typeof (x as { path?: unknown }).path === "string") {
          const p = (x as { path: string; name?: unknown }).path;
          return { path: p, name: typeof (x as { name?: unknown }).name === "string" ? (x as { name: string }).name : p.split("/").pop() ?? "unnamed" };
        }
        return null;
      })
      .filter((x): x is { path: string; name: string } => x !== null);

    if (Array.isArray(a0)) {
      // 逐位形 (sources, targetDir, mode?, confirm?)
      sources = normalizeSources(a0);
      targetDir = typeof args[1] === "string" ? args[1] : "";
      mode = args[2] === "move" ? "move" : "copy";
      skipConfirm = args[3] === true;
    } else if (a0 && typeof a0 === "object" && !("isDirectory" in (a0 as Record<string, unknown>))) {
      // 具名形 { sources, targetDir, mode?, confirm? }
      const o = a0 as { sources?: unknown; targetDir?: unknown; mode?: unknown; confirm?: unknown };
      sources = Array.isArray(o.sources) ? normalizeSources(o.sources) : null;
      targetDir = typeof o.targetDir === "string" ? o.targetDir : "";
      mode = o.mode === "move" ? "move" : "copy";
      skipConfirm = o.confirm === true;
    }

    if (sources !== null) {
      // 程序化路径（无视图也可用）
      if (sources.length === 0 || !targetDir) {
        return fileTreeError(
          FILETREE_ERROR_CODES.EBADARGS,
          `paste 参数不全：sources 必须非空、targetDir 必须给（收到 sources=${sources.length} 条 targetDir=${JSON.stringify(targetDir)}）`,
          '例：{"sources":["C:/proj/a.txt"],"targetDir":"C:/proj/out","mode":"copy"}',
          { sources: sources.length, targetDir: targetDir || null },
        );
      }
    } else {
      // UI 路径：靶子从右键 context / focused / 根推导，源来自插件剪贴板
      const hd = h();
      if (!hd) {
        return fileTreeError(
          FILETREE_ERROR_CODES.ENOVIEW,
          "无 file-tree 视图且未给 sources——无法确定粘贴内容与位置",
          "程序化请传 sources＋targetDir；或先 open-tab file-tree 并在树内复制后再调用",
        );
      }
      const model = hd.getModel();
      const ctx = args[0] as FileMenuContext | undefined;
      targetDir = ctx?.isDirectory ? ctx.uri : ctx ? dirname(ctx.uri) : "";
      if (!targetDir) {
        const focusedUri = hd.getFocusedUri();
        if (focusedUri) {
          const focused = model.findClosest(focusedUri);
          targetDir = focused?.isDirectory ? focused.uri : dirname(focusedUri);
        }
      }
      if (!targetDir) targetDir = model.roots[0]?.uri ?? "";
      if (!targetDir) {
        return fileTreeError(
          FILETREE_ERROR_CODES.ENOVIEW,
          "没有可粘贴的目标目录",
          "先在树里选中一个目录（或传 targetDir）",
        );
      }
      const pulled = fileTreeClipboard.pull();
      mode = pulled.isCut ? "move" : "copy";
      sources = normalizeSources(pulled.uris);
      if (sources.length === 0) {
        return fileTreeError(
          FILETREE_ERROR_CODES.EBADARGS,
          "剪贴板里没有可粘贴的内容——先在树里复制/剪切",
          "传 sources 走程序化粘贴，或先 file-tree.copy / file-tree.cut",
        );
      }
    }

    const outcome = await executeSafeDrop(sources, targetDir, mode, { skipConfirm });
    const stateVersion = outcome.done > 0 ? bumpTreeStateVersion() : treeStateVersion();
    const hd = h();
    if (hd) {
      hd.rerender();
      if (outcome.done > 0) await refreshDirSafe(hd.getModel(), targetDir);
    }
    // 后置状态：粘贴了几条/失败几条/是否取消，AI 可回读判读（⛔ 只回 true）
    return {
      pasted: outcome.done > 0, done: outcome.done, failed: outcome.failed,
      cancelled: outcome.cancelled, mode, targetDir, stateVersion,
      ...(outcome.disabled ? { reason: "disabled" } : outcome.cancelled ? { reason: "cancelled" } : {}),
    };
  });
}
