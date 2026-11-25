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

/** newFile/newFolder 入参（具名对象或逐位 `dir, name`；都不给 = 旧 UI 行为） */
interface CreateArgs { dir?: unknown; name?: unknown }
function parseCreateArgs(args: unknown[]): { dir?: string; name?: string } {
  const named = args.length === 1 && args[0] !== null && typeof args[0] === "object" && !Array.isArray(args[0])
    ? (args[0] as CreateArgs)
    : undefined;
  const dir = typeof args[0] === "string" ? args[0] : typeof named?.dir === "string" ? named.dir : undefined;
  const name = typeof args[1] === "string" ? args[1] : typeof named?.name === "string" ? named.name : undefined;
  return { dir, name };
}

/** 名字合法性（新建/重命名共用口径）：非空、不含分隔符、不是 . / .. */
function badName(name: string): boolean {
  return name.trim() === "" || /[\\/]/.test(name) || name === "." || name === "..";
}

export function registerFileCommands(): void {
  lk.commands.registerCommand("file-tree.newFile", async (...args) => {
    const { dir, name: explicitName } = parseCreateArgs(args);
    const hd = h();
    const model = hd?.getModel();
    const dirUri = dir ?? resolveDirUri(args[0] as FileMenuContext | undefined);
    if (!dirUri) {
      return fileTreeError(
        FILETREE_ERROR_CODES.ENOVIEW,
        "无 file-tree 视图且未给目录——无法确定新建位置",
        "程序化请传 dir（目标目录 uri）＋可选 name；或先 open-tab file-tree",
      );
    }
    if (explicitName !== undefined && badName(explicitName)) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EBADARGS,
        `name 非法（收到 ${JSON.stringify(explicitName)}）——必须是不含分隔符的文件名`,
        "省略 name 走自动命名，或换一个合法名字",
        { dir: dirUri, name: explicitName },
      );
    }
    if (explicitName !== undefined && await lk.filesystem.exists(joinPath(dirUri, explicitName))) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EEXIST,
        `目标已存在：${joinPath(dirUri, explicitName)}——newFile ⛔ 覆盖`,
        "换一个 name，或省略 name 走自动递增命名",
        { dir: dirUri, name: explicitName },
      );
    }
    const name = explicitName ?? await nextName(dirUri, "新建文件");
    const uri = joinPath(dirUri, name);
    try {
      await lk.filesystem.writeTextFile(uri, "");
    } catch (e) {
      return fileTreeError(FILETREE_ERROR_CODES.EFS, `新建文件失败：${errText(e)}`, "检查目录写权限", { dir: dirUri, name });
    }
    const stateVersion = bumpTreeStateVersion();
    if (model) {
      await model.refresh(dirUri);
      const parent = model.findClosest(dirUri);
      if (parent && model.isExpanded(parent.uri)) await model.getChildren(parent).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
    }
    return { created: true, uri, name, stateVersion };
  });

  lk.commands.registerCommand("file-tree.newFolder", async (...args) => {
    const { dir, name: explicitName } = parseCreateArgs(args);
    const hd = h();
    const model = hd?.getModel();
    const dirUri = dir ?? resolveDirUri(args[0] as FileMenuContext | undefined);
    if (!dirUri) {
      return fileTreeError(
        FILETREE_ERROR_CODES.ENOVIEW,
        "无 file-tree 视图且未给目录——无法确定新建位置",
        "程序化请传 dir（目标目录 uri）＋可选 name；或先 open-tab file-tree",
      );
    }
    if (explicitName !== undefined && badName(explicitName)) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EBADARGS,
        `name 非法（收到 ${JSON.stringify(explicitName)}）——必须是不含分隔符的文件夹名`,
        "省略 name 走自动命名，或换一个合法名字",
        { dir: dirUri, name: explicitName },
      );
    }
    if (explicitName !== undefined && await lk.filesystem.exists(joinPath(dirUri, explicitName))) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EEXIST,
        `目标已存在：${joinPath(dirUri, explicitName)}——newFolder ⛔ 覆盖`,
        "换一个 name，或省略 name 走自动递增命名",
        { dir: dirUri, name: explicitName },
      );
    }
    const name = explicitName ?? await nextName(dirUri, "新建文件夹");
    const uri = joinPath(dirUri, name);
    try {
      await lk.filesystem.createDir(uri);
    } catch (e) {
      return fileTreeError(FILETREE_ERROR_CODES.EFS, `新建文件夹失败：${errText(e)}`, "检查目录写权限", { dir: dirUri, name });
    }
    const stateVersion = bumpTreeStateVersion();
    if (model) {
      await model.refresh(dirUri);
      const parent = model.findClosest(dirUri);
      if (parent && model.isExpanded(parent.uri)) await model.getChildren(parent).catch((e) => { console.error("[file-tree] 刷新目录失败:", e); });
    }
    return { created: true, uri, name, stateVersion };
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
    // 三态：都不给 = 行内改名；只给一个 = 坏参（⛔ 空动作冒充成功）；两个都给 = 程序化
    if (!uri && !newName) {
      const hd = h();
      if (!hd) {
        return fileTreeError(
          FILETREE_ERROR_CODES.ENOVIEW,
          "无 file-tree 视图——无参 rename 是行内改名，需要视图在场",
          "传 uri+newName 走程序化改名（无视图可用），或先 open-tab file-tree 再调用",
        );
      }
      hd.startRename();
      return { renamed: false, interactive: true, stateVersion: treeStateVersion() };
    }
    if (!uri || !newName) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EBADARGS,
        `rename 参数缺一半：uri 与 newName 必须同给（收到 uri=${JSON.stringify(uri)} newName=${JSON.stringify(newName)}）`,
        "程序化改名请同时给 uri+newName；行内改名请两个都不传",
        { uri: uri ?? null, newName: newName ?? null },
      );
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
    // T-B：程序化入参（uris 数组 / 单个 uri / confirm）；UI 右键 context（带 isDirectory）走旧靶子解析
    const a0 = args[0];
    let programmatic: string[] | null = null;
    let skipConfirm = false;
    if (Array.isArray(a0)) {
      programmatic = a0.filter((x): x is string => typeof x === "string" && x.length > 0);
      skipConfirm = args[1] === true;
    } else if (typeof a0 === "string" && a0) {
      programmatic = [a0];
      skipConfirm = args[1] === true;
    } else if (a0 && typeof a0 === "object" && !("isDirectory" in (a0 as Record<string, unknown>))) {
      const o = a0 as { uris?: unknown; uri?: unknown; confirm?: unknown };
      const list = Array.isArray(o.uris)
        ? o.uris.filter((x): x is string => typeof x === "string" && x.length > 0)
        : typeof o.uri === "string" && o.uri ? [o.uri] : [];
      programmatic = list;
      skipConfirm = o.confirm === true;
    }
    if (programmatic !== null && programmatic.length === 0) {
      return fileTreeError(
        FILETREE_ERROR_CODES.EBADARGS,
        "delete 没给要删的路径——传 uris: [路径…]（或单个 uri）",
        "先 file-tree.refresh 核对路径；用绝对路径 uri",
      );
    }
    const hd = h();
    const model = hd?.getModel();
    let uris: string[];
    if (programmatic !== null) {
      uris = programmatic;
    } else {
      const ctx = args[0] as FileMenuContext | undefined;
      const selection = hd?.getSelection() ?? [];
      const focused = hd?.getFocusedUri() ?? null;
      uris = selection.length > 0 ? selection : ctx ? [ctx.uri] : focused ? [focused] : [];
      if (!hd || uris.length === 0) {
        return fileTreeError(
          FILETREE_ERROR_CODES.ENOVIEW,
          "无 file-tree 视图且没有选中项——无法确定删除靶子",
          "程序化请传 uris: [路径…]；或先 open-tab file-tree 选中后再调用",
        );
      }
    }
    const confirmDelete = await lk.configuration.get("file-tree.confirmDelete") ?? true;
    if (confirmDelete && !skipConfirm) {
      const nameList = uris.map((u) => `"${u.split("/").pop() ?? u}"`).join(", ");
      const confirmed = await window.linkdesk?.dialog?.confirm?.(`确定删除 ${nameList}？`);
      if (!confirmed) {
        return { deleted: 0, failed: 0, deletedUris: [] as string[], cancelled: true, stateVersion: treeStateVersion() };
      }
    }
    const parentUris = new Set<string>();
    // E6#73m K2：逐项兜住——删整个目录是长任务且**会失败**（占用/只读/权限），老写法首项抛错
    // 就整批中止、且异常沿命令 handler 悬空 ⇒ 用户看到「树没刷新，也没报错」。
    const failures: FailureItem[] = [];
    const deletedUris: string[] = [];
    for (const uri of uris) {
      try {
        await lk.filesystem.remove(uri);
        lk.events.emit("file:deleted", { filePath: uri });
        parentUris.add(dirname(uri));
        deletedUris.push(uri);
      } catch (e) {
        failures.push({ name: nameOf(uri), detail: errText(e) });
      }
    }
    // T-B：本轮命令真的删掉了东西才推进状态版本（失败项⛔ 计账）
    const stateVersion = deletedUris.length > 0 ? bumpTreeStateVersion() : treeStateVersion();
    // 失败项**不进 parentUris**——它们还在盘上，刷新那层只会白跑（真删掉的照常刷）
    notifyFailure(i18n.t("删除"), failures);
    if (model) {
      for (const parentUri of parentUris) {
        await refreshDirSafe(model, parentUri);
      }
    }
    // 后置状态：删了几条 / 哪些 / 失败几条，AI 可回读判读
    return {
      deleted: deletedUris.length, failed: failures.length, deletedUris,
      ...(failures.length > 0 ? { failures } : {}),
      cancelled: false, stateVersion,
    };
  });
}
