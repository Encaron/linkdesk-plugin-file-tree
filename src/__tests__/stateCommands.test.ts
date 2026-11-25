/**
 * T-B 状态命令试点——file-tree.refresh 快照 ＋ file-tree.rename 后置状态/版本冲突。
 *
 * 判据只钉插件契约（回执形状、版本推进、冲突码），不钉壳侧重放（那是宿主的活）：
 *   · refresh 回可判读快照（键 ⊆ manifest returns，key 集稳定）；
 *   · rename 成功 ⇒ 后置状态含 newUri/stateVersion，版本 +1；
 *   · expectedVersion 陈旧 ⇒ ECONFLICT + details.stateVersion，且**零副作用**；
 *   · 参数/目标存在/宿主失败 ⇒ 返回式结构化错误（⛔ throw）。
 */
import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { _resetTreeStateVersionForTest } from "../services/FileTreeState";
import { clearFileTreeHandle, setFileTreeHandleRef } from "../components/FileTreeContextMenu/host-bridge";

type Handler = (...args: unknown[]) => Promise<unknown> | unknown;

const handlers = new Map<string, Handler>();
const renamedCalls: Array<[string, string]> = [];
const written: string[] = [];
const createdDirs: string[] = [];
const copied: Array<[string, string]> = [];
const removed: string[] = [];
const events: Array<[string, unknown]> = [];
let existsReply = false;
let renameFail: string | null = null;

beforeAll(async () => {
  (window as unknown as { linkdesk: unknown }).linkdesk = {
    path: {
      normalize: (x: string) => x.replace(/\\/g, "/"),
      basename: (x: string) => x.split("/").pop() ?? "",
      dirname: (x: string) => {
        const i = x.lastIndexOf("/");
        return i <= 0 ? "/" : x.slice(0, i);
      },
      join: (a: string, b: string) => `${a.replace(/\/$/, "")}/${b}`,
    },
    filesystem: {
      exists: async () => existsReply,
      rename: async (from: string, to: string) => {
        if (renameFail) throw new Error(renameFail);
        renamedCalls.push([from, to]);
      },
      writeTextFile: async (p: string) => { written.push(p); },
      createDir: async (p: string) => { createdDirs.push(p); },
      copy: async (from: string, to: string) => { copied.push([from, to]); },
      remove: async (p: string) => { removed.push(p); },
    },
    commands: {
      registerCommand: (id: string, handler: Handler) => { handlers.set(id, handler); },
    },
    events: { emit: (topic: string, payload: unknown) => { events.push([topic, payload]); } },
    configuration: { get: async () => "smart" },
  };
  // files.ts / clipboard.ts 在模块顶层 `const lk = window.linkdesk` ⇒ 必须先装桩再 import
  const mod = await import("../components/FileTreeContextMenu/commands/files");
  mod.registerFileCommands();
  const clip = await import("../components/FileTreeContextMenu/commands/clipboard");
  clip.registerClipboardCommands();
});

beforeEach(() => {
  _resetTreeStateVersionForTest();
  clearFileTreeHandle();
  renamedCalls.length = 0;
  written.length = 0;
  createdDirs.length = 0;
  copied.length = 0;
  removed.length = 0;
  events.length = 0;
  existsReply = false;
  renameFail = null;
});

const call = (id: string, ...args: unknown[]) => handlers.get(`file-tree.${id}`)!;

describe("file-tree.refresh：状态快照（无视图也回）", () => {
  it("键集稳定且 stateVersion 可读（无视图 ⇒ viewMounted:false）", async () => {
    const res = await call("refresh")() as Record<string, unknown>;
    expect(Object.keys(res).sort()).toEqual(
      ["expanded", "ok", "rootCount", "roots", "stateVersion", "updatedAt", "viewMounted"],
    );
    expect(res).toMatchObject({ ok: true, viewMounted: false, rootCount: 0, roots: [], expanded: [], stateVersion: 0 });
    expect(res.updatedAt).toBeTypeOf("string");
  });
});

describe("file-tree.rename：程序化改名（带参）", () => {
  it("成功 ⇒ 后置状态含新路径 ＋ stateVersion+1 ＋ 发 file:renamed", async () => {
    const res = await call("rename")({ uri: "C:/proj/a.txt", newName: "b.txt" }) as Record<string, unknown>;
    expect(res).toMatchObject({
      renamed: true, oldUri: "C:/proj/a.txt", newUri: "C:/proj/b.txt", name: "b.txt", stateVersion: 1,
    });
    expect(renamedCalls).toEqual([["C:/proj/a.txt", "C:/proj/b.txt"]]);
    expect(events).toContainEqual(["file:renamed", { oldPath: "C:/proj/a.txt", newPath: "C:/proj/b.txt" }]);
  });

  it("陈旧 expectedVersion ⇒ ECONFLICT ＋ details.stateVersion，零副作用", async () => {
    await call("rename")({ uri: "C:/proj/a.txt", newName: "b.txt" }); // 版本 → 1
    const stale = await call("rename")({ uri: "C:/proj/b.txt", newName: "c.txt", expectedVersion: 0 }) as {
      isPluginError?: boolean; code?: string; details?: { stateVersion?: number };
    };
    expect(stale.isPluginError).toBe(true);
    expect(stale.code).toBe("ECONFLICT");
    expect(stale.details?.stateVersion).toBe(1);
    expect(renamedCalls).toHaveLength(1); // 第二次没有动盘
  });

  it("版本匹配 ⇒ 放行（位置参数形与具名对象形等价）", async () => {
    const res = await call("rename")("C:/proj/a.txt", "b.txt", 0) as Record<string, unknown>;
    expect(res).toMatchObject({ renamed: true, stateVersion: 1 });
  });

  it("同参重放（newName === 当前名）⇒ 幂等成功、不重复动盘、版本不变", async () => {
    const res = await call("rename")({ uri: "C:/proj/a.txt", newName: "a.txt" }) as Record<string, unknown>;
    expect(res).toMatchObject({ renamed: false, newUri: "C:/proj/a.txt", stateVersion: 0 });
    expect(renamedCalls).toHaveLength(0);
  });

  it("newName 带分隔符 ⇒ EBADARGS（⛔ 跨目录移动）", async () => {
    const res = await call("rename")({ uri: "C:/proj/a.txt", newName: "sub/b.txt" }) as {
      isPluginError?: boolean; code?: string;
    };
    expect(res.isPluginError).toBe(true);
    expect(res.code).toBe("EBADARGS");
  });

  it("目标已存在 ⇒ EEXIST（⛔ 覆盖）", async () => {
    existsReply = true;
    const res = await call("rename")({ uri: "C:/proj/a.txt", newName: "b.txt" }) as {
      isPluginError?: boolean; code?: string;
    };
    expect(res.isPluginError).toBe(true);
    expect(res.code).toBe("EEXIST");
    expect(renamedCalls).toHaveLength(0);
  });

  it("宿主 rename 失败 ⇒ EFS（错误信封，⛔ 裸 throw）", async () => {
    renameFail = "EBUSY: file is locked";
    const res = await call("rename")({ uri: "C:/proj/a.txt", newName: "b.txt" }) as {
      isPluginError?: boolean; code?: string; message?: string;
    };
    expect(res.isPluginError).toBe(true);
    expect(res.code).toBe("EFS");
    expect(res.message).toMatch(/EBUSY/);
  });

  it("无参 + 无视图 ⇒ ENOVIEW（⛔ 空动作冒充 interactive 成功）", async () => {
    const res = await call("rename")() as { isPluginError?: boolean; code?: string; hint?: string };
    expect(res.isPluginError).toBe(true);
    expect(res.code).toBe("ENOVIEW");
    expect(res.hint).toMatch(/uri\+newName|open-tab/);
  });

  it("无参 + 有视图 ⇒ 进入行内重命名（interactive:true ＋ 真调 startRename）", async () => {
    const startRename = vi.fn();
    setFileTreeHandleRef({ current: { startRename } } as never);
    try {
      const res = await call("rename")() as Record<string, unknown>;
      expect(res).toMatchObject({ renamed: false, interactive: true, stateVersion: 0 });
      expect(startRename).toHaveBeenCalledTimes(1);
    } finally {
      clearFileTreeHandle();
    }
  });

  it("只给 uri 或只给 newName ⇒ EBADARGS（⛔ 半参走行内/空动作）", async () => {
    const onlyUri = await call("rename")({ uri: "C:/proj/b.txt" }) as { isPluginError?: boolean; code?: string };
    expect(onlyUri.isPluginError).toBe(true);
    expect(onlyUri.code).toBe("EBADARGS");

    const onlyName = await call("rename")({ newName: "b.txt" }) as { isPluginError?: boolean; code?: string };
    expect(onlyName.isPluginError).toBe(true);
    expect(onlyName.code).toBe("EBADARGS");

    expect(renamedCalls).toHaveLength(0); // 零副作用
  });
});

describe("file-tree.newFile/newFolder：程序化新建（无视图可用）", () => {
  it("newFile dir+name ⇒ created/uri/stateVersion+1（⛔ 只回 true）", async () => {
    const res = await call("newFile")({ dir: "C:/proj", name: "notes.txt" }) as Record<string, unknown>;
    expect(res).toMatchObject({ created: true, uri: "C:/proj/notes.txt", name: "notes.txt", stateVersion: 1 });
    expect(written).toEqual(["C:/proj/notes.txt"]);
  });

  it("newFile 显式 name 已存在 ⇒ EEXIST，零副作用", async () => {
    existsReply = true;
    const res = await call("newFile")({ dir: "C:/proj", name: "notes.txt" }) as { isPluginError?: boolean; code?: string };
    expect(res.isPluginError).toBe(true);
    expect(res.code).toBe("EEXIST");
    expect(written).toHaveLength(0);
  });

  it("newFile 无 dir 无视图 ⇒ ENOVIEW；坏 name ⇒ EBADARGS", async () => {
    const noView = await call("newFile")() as { isPluginError?: boolean; code?: string };
    expect(noView.code).toBe("ENOVIEW");
    const bad = await call("newFile")({ dir: "C:/proj", name: "a/b.txt" }) as { isPluginError?: boolean; code?: string };
    expect(bad.code).toBe("EBADARGS");
    expect(written).toHaveLength(0);
  });

  it("newFolder dir+name ⇒ created/uri/stateVersion，且走 createDir", async () => {
    const res = await call("newFolder")({ dir: "C:/proj", name: "assets" }) as Record<string, unknown>;
    expect(res).toMatchObject({ created: true, uri: "C:/proj/assets", name: "assets", stateVersion: 1 });
    expect(createdDirs).toEqual(["C:/proj/assets"]);
  });
});

describe("file-tree.delete：程序化删除（uris＋confirm）", () => {
  it("uris + confirm:true ⇒ deleted 计数/删除清单/stateVersion；无视图也可用", async () => {
    const res = await call("delete")({ uris: ["C:/proj/a.txt", "C:/proj/b.txt"], confirm: true }) as Record<string, unknown>;
    expect(res).toMatchObject({ deleted: 2, failed: 0, deletedUris: ["C:/proj/a.txt", "C:/proj/b.txt"], cancelled: false, stateVersion: 1 });
    expect(removed).toEqual(["C:/proj/a.txt", "C:/proj/b.txt"]);
  });

  it("空 uris ⇒ EBADARGS；无 uris 无视图 ⇒ ENOVIEW（⛔ 空动作）", async () => {
    const empty = await call("delete")({ uris: [], confirm: true }) as { isPluginError?: boolean; code?: string };
    expect(empty.code).toBe("EBADARGS");
    const noView = await call("delete")() as { isPluginError?: boolean; code?: string };
    expect(noView.code).toBe("ENOVIEW");
    expect(removed).toHaveLength(0);
  });
});

describe("file-tree.paste：程序化粘贴（sources＋targetDir）", () => {
  it("copy 两条成功 ⇒ pasted/done/mode/targetDir/stateVersion；发 copy 调用", async () => {
    const res = await call("paste")({
      sources: ["C:/proj/a.txt"], targetDir: "C:/proj/out", mode: "copy", confirm: true,
    }) as Record<string, unknown>;
    expect(res).toMatchObject({
      pasted: true, done: 1, failed: 0, cancelled: false, mode: "copy", targetDir: "C:/proj/out", stateVersion: 1,
    });
    expect(copied).toEqual([["C:/proj/a.txt", "C:/proj/out/a.txt"]]);
  });

  it("move ⇒ 先 copy 后 remove 源；版本 +1", async () => {
    const res = await call("paste")({
      sources: ["C:/proj/a.txt"], targetDir: "C:/proj/out", mode: "move", confirm: true,
    }) as Record<string, unknown>;
    expect(res).toMatchObject({ pasted: true, done: 1, mode: "move", stateVersion: 1 });
    expect(removed).toEqual(["C:/proj/a.txt"]);
  });

  it("缺 sources/targetDir ⇒ EBADARGS；无 sources 无视图 ⇒ ENOVIEW", async () => {
    const bad = await call("paste")({ sources: [], targetDir: "C:/proj/out" }) as { isPluginError?: boolean; code?: string };
    expect(bad.code).toBe("EBADARGS");
    const noView = await call("paste")() as { isPluginError?: boolean; code?: string };
    expect(noView.code).toBe("ENOVIEW");
  });
});
