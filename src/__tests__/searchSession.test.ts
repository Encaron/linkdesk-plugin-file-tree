/**
 * searchSession + searchCommands——AI#24「打开搜索结果」的两半。
 *
 * ## 为什么这两件要合在一个文件里测
 *
 * 判据是「这条动作**有命令路径**且进命令索引」。命令那半（`searchCommands.ts`）含 `window.linkdesk`
 * ⇒ 覆盖尺把它排除在外；纯逻辑那半（`searchSession.ts`）反过来**必须有测试**。而单独测解析规则
 * 只证明「找得到那条」，证明不了「找到之后真去开标签页」——那才是让 AI / 快捷键够得着双击的那一步。
 * 故两半在这里合着测。
 *
 * ## 替身（⛔ 不动共享地基）
 *
 * `commands` / `fileAssociation` 是共享 mock 里没有的两个面（六通用面里没有命令注册与扩展名映射），
 * 本文件按需 `vi.fn()` 补上——正是「插件专属桩住本仓测试文件」的写法。
 * 收线方式：用**假实现**（记下收到的参数）而不是「断言调了几次」——命令的读数（打开的是哪一条）
 * 是含在返回值里的，只数调用次数会把「开错那一条」放过去。
 *
 * ⚠️ **负控**（B5/B6）：不存在的 filePath、没有属主插件的扩展名——两条都必须**不碰** `tabs.create`。
 *    只断言「报错了」不够：一个先开标签页再抛错的实现同样绿。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SearchWireMatch } from "@linkdesk/contracts";
import {
  getSearchSession, recordSearchSession, resetSearchSession, resolveSearchMatch,
  type OpenSearchResultArgs,
} from "../views/SearchView/searchSession";
import { registerSearchCommands } from "../views/SearchView/searchCommands";

/** 造一条匹配行——只用得到 filePath / lineNumber，其余按 wire 形状补齐 */
function m(filePath: string, lineNumber: number, lineText = "hit"): SearchWireMatch {
  return { filePath, lineNumber, lineText, matchStart: 0, matchEnd: lineText.length };
}

const THREE = [m("E:/ws/a.ts", 3), m("E:/ws/b.ts", 12), m("E:/ws/a.ts", 40)];

let handlers: Map<string, (args?: unknown) => unknown>;
let created: Array<{ pluginId: string; opts: Record<string, unknown> }>;
let getPluginFor: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetSearchSession();
  handlers = new Map();
  created = [];
  getPluginFor = vi.fn(async (ext: string) => (ext === "unknown" ? null : "text-editor"));
  const lk = window.linkdesk as unknown as Record<string, unknown>;
  lk.commands = { registerCommand: (id: string, fn: (args?: unknown) => unknown) => { handlers.set(id, fn); } };
  lk.fileAssociation = { getPluginFor };
  (lk.tabs as Record<string, unknown>).create = (pluginId: string, opts: Record<string, unknown>) => {
    created.push({ pluginId, opts });
    return Promise.resolve("tab-1");
  };
});

afterEach(() => {
  resetSearchSession();
});

describe("searchSession 纯解析——目标从哪来", () => {
  it("还没搜过（空会话）⇒ null：命令要如实回「没有搜索结果」，⛔ 不能编一个目标", () => {
    expect(getSearchSession()).toEqual({ matches: [], index: -1 });
    expect(resolveSearchMatch()).toBeNull();
    expect(resolveSearchMatch({ filePath: "E:/ws/a.ts" })).toBeNull();
  });

  it("缺省打开当前高亮那条（index 由 useSearch 投影进来）", () => {
    recordSearchSession(THREE, 1);
    expect(resolveSearchMatch()).toEqual({ match: THREE[1], index: 1 });
    expect(resolveSearchMatch({})).toEqual({ match: THREE[1], index: 1 });
  });

  it("index = -1（搜出结果但还没导航过）⇒ 兜到第一条，而不是 -1 越界成 undefined", () => {
    recordSearchSession(THREE, -1);
    expect(resolveSearchMatch()?.index).toBe(0);
    expect(resolveSearchMatch()?.match).toBe(THREE[0]);
  });

  it("index 越界（结果集变小后残留的旧索引）⇒ 同样兜到第一条", () => {
    recordSearchSession(THREE, 99);
    expect(resolveSearchMatch()?.index).toBe(0);
  });

  it("按 filePath 指定——反斜杠与正斜杠等价（Windows 上两条写法都有人用）", () => {
    recordSearchSession(THREE, 0);
    expect(resolveSearchMatch({ filePath: "E:\\ws\\b.ts" })?.match).toBe(THREE[1]);
  });

  it("filePath + lineNumber 唯一确定一条：同一文件的多条匹配不会串行", () => {
    recordSearchSession(THREE, 0);
    expect(resolveSearchMatch({ filePath: "E:/ws/a.ts", lineNumber: 40 })?.match).toBe(THREE[2]);
    expect(resolveSearchMatch({ filePath: "E:/ws/a.ts", lineNumber: 40 })?.index).toBe(2);
  });

  it("filePath 在结果里、但那个行号不在 ⇒ null（不许退化成「随便开一条」）", () => {
    recordSearchSession(THREE, 0);
    expect(resolveSearchMatch({ filePath: "E:/ws/a.ts", lineNumber: 7 })).toBeNull();
  });

  it("filePath 不在本次结果里 ⇒ null", () => {
    recordSearchSession(THREE, 0);
    expect(resolveSearchMatch({ filePath: "E:/ws/zzz.ts" })).toBeNull();
  });

  it("reset（视图卸载）⇒ 回到空：不给一个界面上早已不存在的陈旧目标", () => {
    recordSearchSession(THREE, 2);
    resetSearchSession();
    expect(getSearchSession()).toEqual({ matches: [], index: -1 });
    expect(resolveSearchMatch()).toBeNull();
  });
});

describe("searchCommands 命令面——注册与打开", () => {
  it("注册 1 条，id 是 file-tree.openSearchResult（进命令索引的那条）", () => {
    expect(registerSearchCommands()).toBe(1);
    expect([...handlers.keys()]).toEqual(["file-tree.openSearchResult"]);
  });

  it("commands 面不可用时返回 0（⛔ 不许抛——入口顶层调用，抛了就整只插件加载失败）", () => {
    (window.linkdesk as unknown as Record<string, unknown>).commands = undefined;
    expect(registerSearchCommands()).toBe(0);
  });

  it("缺省打开当前高亮那条：扩展名问属主插件 → 开固定标签页，读数带 index/total", async () => {
    recordSearchSession(THREE, 2);
    registerSearchCommands();
    const res = await handlers.get("file-tree.openSearchResult")!() as Record<string, unknown>;

    expect(getPluginFor).toHaveBeenCalledWith("ts");
    expect(created).toEqual([{ pluginId: "text-editor", opts: { filePath: "E:/ws/a.ts", label: "a.ts", pinned: true } }]);
    expect(res).toEqual({ opened: true, filePath: "E:/ws/a.ts", lineNumber: 40, index: 2, total: 3 });
  });

  it("指定 filePath 时打开的是那一条，不是当前高亮那条（AI 点名的优先级）", async () => {
    recordSearchSession(THREE, 2);
    registerSearchCommands();
    const res = await handlers.get("file-tree.openSearchResult")!({ filePath: "E:/ws/b.ts", lineNumber: 12 } as OpenSearchResultArgs) as Record<string, unknown>;

    expect(created).toHaveLength(1);
    expect(created[0].opts.filePath).toBe("E:/ws/b.ts");
    expect(res.index).toBe(1);
  });

  it("没有搜索结果 ⇒ 抛「没有搜索结果」，且**不碰** tabs（负控：不许先开标签页再抛）", async () => {
    registerSearchCommands();
    await expect(handlers.get("file-tree.openSearchResult")!()).rejects.toThrow(/没有搜索结果/);
    expect(created).toHaveLength(0);
  });

  it("点名了不在结果里的 filePath ⇒ 抛错且带出名字，同样不碰 tabs", async () => {
    recordSearchSession(THREE, 0);
    registerSearchCommands();
    await expect(handlers.get("file-tree.openSearchResult")!({ filePath: "E:/ws/zzz.ts" } as OpenSearchResultArgs))
      .rejects.toThrow(/zzz\.ts/);
    expect(created).toHaveLength(0);
  });

  it("扩展名没有属主插件 ⇒ 与双击同路地静默不开（openMatch 的既有语义，本命令不另立一套）", async () => {
    recordSearchSession([m("E:/ws/dump.unknown", 1)], 0);
    registerSearchCommands();
    const res = await handlers.get("file-tree.openSearchResult")!() as Record<string, unknown>;

    expect(getPluginFor).toHaveBeenCalledWith("unknown");
    expect(created).toHaveLength(0);
    expect(res.opened).toBe(true); // 目标解析成功（只是没人能开它）——与双击一致
  });
});
