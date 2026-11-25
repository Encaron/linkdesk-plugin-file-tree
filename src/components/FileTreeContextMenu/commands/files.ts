/**
 * files 命令组——新建 / 刷新 / 重命名 / 删除（E6#87a 二次拆分）。
 */
import { basename, dirname, joinPath, normalizePath } from "../../../utils/hostPath";
import i18n from "i18next";
import { notifyFailure, errText, nameOf, type FailureItem } from "../../../services/FileTreeNotify";
import { fileTreeError, FILETREE_ERROR_CODES } from "../../../services/fileTreeErrors";
import { bumpTreeStateVersion, treeStateVersion } from "../../../services/FileTreeState";
import { h } from "../host-bridge";
import { refreshDirSafe, type FileMenuContext } from "./shared";

const lk = window.linkdesk;

/** E4V#34 fix: 无 context（MenuBar 调用）→回退到 focused item/根目录 */
function resolveDirUri(ctx?: FileMenuContext): string {
  const hd = h();
  if (!hd) return "";
  const model = hd.getModel();
  if (ctx?.isDirectory) return ctx.uri;
  if (ctx) return dirname(ctx.uri);
  // MenuBar 调用——无右键菜单 context→用 focused/selected item
  const focusedUri = hd.getFocusedUri();
  if (focusedUri) {
    const focused = model.findClosest(focusedUri);
    return focused?.isDirectory ? focused.uri : dirname(focusedUri);
  }
  return model.roots[0]?.uri ?? "";
}

/** E4V#34j: file-tree.incrementalNaming——"smart"=编号（默认），"disabled"=不编号 */
async function nextName(dirUri: string, base: string): Promise<string> {
  const naming = await lk.configuration.get("file-tree.incrementalNaming") ?? "smart";
  let name = base;
  if (naming === "disabled") return name;
  const probe = (n: string) => joinPath(dirUri, n);
  for (let i = 1; i < 100; i++) {
    if (!await lk.filesystem.exists(probe(name))) break;
    name = `${base}-${i}`;
  }
  return name;
}

/** ISO 时间戳——写命令后置状态随行 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * rename 的入参两形等价（与壳 `expandNamedArgs` 同契约）：
 *   · 具名对象 `{ uri, newName, expectedVersion?, idempotencyKey? }`；
 *   · 逐位 `(uri, newName, expectedVersion?)`。
 * 两样都没给 ⇒ 旧行为：进入行内重命名（UI 命令面板/右键菜单那条）。
 */
interface RenameArgs {
  uri?: unknown;
  newName?: unknown;
  expectedVersion?: unknown;
}
function parseRenameArgs(args: unknown[]): { uri?: string; newName?: string; expectedVersion?: number } {
  const named = args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])
    ? (args[0] as RenameArgs)
    : undefined;
  const uri = typeof args[0] === "string" ? args[0] : typeof named?.uri === "string" ? named.uri : undefined;
  const newName = typeof args[1] === "string" ? args[1] : typeof named?.newName === "string" ? named.newName : undefined;
  const ev = typeof args[2] === "number" ? args[2] : typeof named?.expectedVersion === "number" ? named.expectedVersion : undefined;
  return { uri, newName, expectedVersion: ev };
}

export function registerFileCommands(): void {
  lk.commands.registerCommand("file-tree.newFile", async (...args) => {
    const hd = h(); if (!hd) return;
    const model = hd.getModel();
    const dirUri = resolveDirUri(args[0] as FileMenuContext | undefined);
    if (!dirUri) return;
    const name = await nextName(dirUri, "新建文件");
    await lk.filesystem.writeTextFile(joinPath(dirUri, name), "");
    bumpTreeStateVersion();
    await model.refresh(dirUri);
    const parent = model.findClosest(dirUri);
    if (parent && model.isExpanded(parent.uri)) await model.getChildren(parent).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
  });

  lk.commands.registerCommand("file-tree.newFolder", async (...args) => {
    const hd = h(); if (!hd) return;
    const model = hd.getModel();
    const dirUri = resolveDirUri(args[0] as FileMenuContext | undefined);
    if (!dirUri) return;
    const name = await nextName(dirUri, "新建文件夹");
    await lk.filesystem.createDir(joinPath(dirUri, name));
    bumpTreeStateVersion();
    await model.refresh(dirUri);
    const parent = model.findClosest(dirUri);
    if (parent && model.isExpanded(parent.uri)) await model.getChildren(parent).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
  });

  lk.commands.registerCommand("file-tree.refresh", async () => {
    const hd = h();
    // T-B：只读状态命令——回**可判读快照**（无视图也回，如实标 viewMounted:false）
    if (!hd) {
      return {
        ok: true, viewMounted: false, rootCount: 0, roots: [] as string[], expanded: [] as string[],
        stateVersion: treeStateVersion(), updatedAt: nowIso(),
      };
    }
    const model = hd.getModel();
    await model.refresh();
    for (const uri of model.getExpandedUris()) {
      const item = model.findClosest(uri);
      if (item) await model.getChildren(item).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
    }
    const roots = model.roots.map((r) => r.uri);
    return {
      ok: true, viewMounted: true, rootCount: roots.length, roots,
      expanded: model.getExpandedUris(),
      stateVersion: treeStateVersion(), updatedAt: nowIso(),
    };
  });

  lk.commands.registerCommand("file-tree.collapseAll", async () => {
    h()?.getModel().collapseAll();
  });

  // ── E4V#27: F2 行内重命名 ＋ T-B：带参的程序化 rename（无视图也可用）──
  lk.commands.registerCommand("file-tree.rename", async (...args) => {
    const { uri, newName, expectedVersion } = parseRenameArgs(args);
    // 无参 / 右键 context（键名不含 newName）⇒ 旧行为：进入行内重命名
    if (!uri || !newName) {
      h()?.startRename();
      return { renamed: false, interactive: true, stateVersion: treeStateVersion() };
    }
    // 参数归一（newName 只能是同一目录下的名字，⛔ 带分隔符）
    if (uri.trim() === "" || newName.trim() === "" || /[\\/]/.test(newName) || newName === "." || newName === "..") {
      return fileTreeError(
        FILETREE_ERROR_CODES.EBADARGS,
        `rename 参数非法：uri 必须非空、newName 必须是不含分隔符的名字（收到 uri=${JSON.stringify(uri)} newName=${JSON.stringify(newName)}）`,
        '例：{"uri":"C:/proj/a.txt","newName":"b.txt"}；换目录请用移动/粘贴',
        { uri, newName },
      );
    }
    // 乐观并发：调用方读过快照就带上 expectedVersion；不一致 ⇒ ECONFLICT（details.stateVersion = 当前值）
    const currentVersion = treeStateVersion();
    if (expectedVersion !== undefined && expectedVersion !== currentVersion) {
      return fileTreeError(
        FILETREE_ERROR_CODES.ECONFLICT,
        `树状态已变化（期望 stateVersion=${expectedVersion}，当前 ${currentVersion}）——本次未改名`,
        "先 file-tree.refresh 取最新 stateVersion，确认目标仍在后再重试",
        { stateVersion: currentVersion },
      );
    }
    const dir = dirname(uri);
    const dest = joinPath(dir, newName);
    const oldName = basename(uri);
    // 同参重放语义：已就是目标名 ⇒ 幂等成功（不再动盘）
    if (newName === oldName) {
      return { renamed: false, oldUri: uri, newUri: uri, name: newName, stateVersion: currentVersion };
    }
    // 目标已存在 ⇒ 拒（⛔ 覆盖）；仅大小写改名（a.txt → A.txt）放行
    const caseOnly = normalizePath(uri).toLowerCase() === normalizePath(dest).toLowerCase();
    if (!caseOnly && await lk.filesystem.exists(dest)) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EEXIST,
        `目标已存在：${dest}——rename ⛔ 覆盖已有文件/文件夹`,
        "换一个 newName，或先删除/移动目标",
        { uri, newUri: dest },
      );
    }
    try {
      await lk.filesystem.rename(uri, dest);
    } catch (e) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EFS,
        `重命名失败：${errText(e)}`,
        "确认源仍在、目标未被占用、当前用户有该目录写权限；先 file-tree.refresh 核对",
        { uri, newUri: dest },
      );
    }
    const stateVersion = bumpTreeStateVersion();
    lk.events.emit("file:renamed", { oldPath: uri, newPath: dest });
    const hd = h();
    if (hd) {
      const model = hd.getModel();
      await model.refresh(dir);
      const parent = model.findClosest(dir);
      if (parent && model.isExpanded(parent.uri)) await model.getChildren(parent).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
    }
    // 后置状态：改完能直接回读新路径 ＋ 新版本
    return { renamed: true, oldUri: uri, newUri: dest, name: newName, stateVersion };
  });

  // ── E4V#24: delete ──
  lk.commands.registerCommand("file-tree.delete", async (...args) => {
    const hd = h(); if (!hd) return;
    const model = hd.getModel();
    const ctx = args[0] as FileMenuContext | undefined;
    const selection = hd.getSelection();
    const focused = hd.getFocusedUri();
    const uris: string[] = selection.length > 0 ? selection : ctx ? [ctx.uri] : focused ? [focused] : [];
    if (uris.length === 0) return;
    const confirmDelete = await lk.configuration.get("file-tree.confirmDelete") ?? true;
    if (confirmDelete) {
      const nameList = uris.map((u) => `"${u.split("/").pop() ?? u}"`).join(", ");
      const confirmed = await window.linkdesk?.dialog?.confirm?.(`确定删除 ${nameList}？`);
      if (!confirmed) return;
    }
    const parentUris = new Set<string>();
    // E6#73m K2：逐项兜住——删整个目录是长任务且**会失败**（占用/只读/权限），老写法首项抛错
    // 就整批中止、且异常沿命令 handler 悬空 ⇒ 用户看到「树没刷新，也没报错」。
    const failures: FailureItem[] = [];
    for (const uri of uris) {
      try {
        await lk.filesystem.remove(uri);
        lk.events.emit("file:deleted", { filePath: uri });
        parentUris.add(dirname(uri));
      } catch (e) {
        failures.push({ name: nameOf(uri), detail: errText(e) });
      }
    }
    // T-B：本轮命令真的删掉了东西才推进状态版本（失败项⛔ 计账）
    if (parentUris.size > 0) bumpTreeStateVersion();
    // 失败项**不进 parentUris**——它们还在盘上，刷新那层只会白跑（真删掉的照常刷）
    notifyFailure(i18n.t("删除"), failures);
    for (const parentUri of parentUris) {
      await refreshDirSafe(model, parentUri);
    }
  });
}
