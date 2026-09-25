/**
 * reload——原子重载与刷新。E6#149 补测。
 *
 * 为什么单独立文件：三个导出（`reloadItem` / `reloadExpandedDescendants` / `refreshTree`）在既有
 * `FileTreeModel.test.ts` 里**零断言**——那条链只有 `model.refresh()` 能走到，而 `refresh(` 在测试里
 * 一次都没出现过（门面其余方法都测了）。本文件补的就是这条链：清缓存 → 重载 → 递归已展开子树。
 *
 * 替身：`TreeHost` 是「FileTreeModel 对同夹辅助函数暴露的最小面」——测试自建假 host（只在**本文件**里，
 * ⛔ 不动共享地基）。断言口径照**生产现状**（源码头注写明）：三个函数**自己都不 fire**，由调用方重载后统一触发。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshTree, reloadItem, reloadExpandedDescendants } from "../services/FileTreeModel/reload";
import type { TreeHost } from "../services/FileTreeModel/host";
import type { ExplorerItem } from "../services/FileTreeModel/types";

function node(uri: string, isDirectory: boolean, children: ExplorerItem[] | null = null): ExplorerItem {
  return { uri, name: uri.split("/").pop() || uri, isDirectory, isSymlink: false, children, parent: null };
}

/** 磁盘替身——uri → 该目录的条目（每次 getChildren 都写回 item.children，模拟真实懒加载） */
type Disk = Record<string, ExplorerItem[]>;

/**
 * 假 TreeHost：
 *   - `getChildren` 从 `disk` 取条目写回 `item.children`（并登记进 byUri 索引，模拟真实 host 的 findClosest）
 *   - `isExpanded` 读传入的 expanded 集合（生产里那个 Set 是按引用传进辅助函数的）
 */
function makeHost(roots: ExplorerItem[], disk: Disk, expanded: Set<string>) {
  const byUri = new Map<string, ExplorerItem>();
  const index = (it: ExplorerItem) => {
    byUri.set(it.uri, it);
    for (const c of it.children ?? []) index(c);
  };
  for (const r of roots) index(r);

  const getChildren = vi.fn(async (it: ExplorerItem) => {
    const entries = disk[it.uri] ?? [];
    it.children = entries;
    for (const e of entries) {
      e.parent = it;
      byUri.set(e.uri, e);
    }
    return entries;
  });

  const host: TreeHost = {
    roots,
    onDidChange: { fire: vi.fn() },
    findClosest: (uri: string) => byUri.get(uri) ?? null,
    findClosestRoot: (uri: string) =>
      roots.find((r) => uri === r.uri || uri.startsWith(r.uri + "/")) ?? null,
    getChildren,
    expand: vi.fn(),
    isExpanded: (uri: string) => expanded.has(uri),
  };
  return host;
}

/** 固定树：/root ─┬ src ─┬ a.ts
 *                 │      └ sub ─ b.ts
 *                 └ pkg ─ c.ts */
function fixture() {
  const a = node("/root/src/a.ts", false);
  const b = node("/root/src/sub/b.ts", false);
  const sub = node("/root/src/sub", true, [b]);
  const src = node("/root/src", true, [a, sub]);
  const c = node("/root/pkg/c.ts", false);
  const pkg = node("/root/pkg", true, [c]);
  const root = node("/root", true, [src, pkg]);
  const disk: Disk = {
    "/root": [src, pkg],
    "/root/src": [a, sub],
    "/root/src/sub": [b],
    "/root/pkg": [c],
  };
  return { root, src, sub, pkg, disk };
}

let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  // reloadItem 的失败出口是 console.error（E6#73m 之前的形态，本格不改生产码）——测试里收声并断言
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errSpy.mockRestore();
});

describe("refreshTree（带 path）", () => {
  it("已展开目录 → 原子重载：清缓存 + 重读磁盘 + 递归已展开子树", async () => {
    const { root, src, sub, disk } = fixture();
    const expanded = new Set(["/root", "/root/src", "/root/src/sub"]);
    const host = makeHost([root], disk, expanded);
    const stale = node("/root/src/stale.ts", false);
    src.children = [stale];

    await refreshTree(host, expanded, "/root/src");

    // 原子三步：重读了 src 自己，也重读了已展开的孙目录 sub
    expect(host.getChildren).toHaveBeenCalledTimes(2);
    expect(host.getChildren).toHaveBeenNthCalledWith(1, src);
    expect(host.getChildren).toHaveBeenNthCalledWith(2, sub);
    expect(src.children).toEqual([disk["/root/src"][0], disk["/root/src"][1]]);
    expect(src.children).not.toContain(stale); // 旧缓存节点没有残留
  });

  it("已展开目录重载后，未展开的子目录仍然不进磁盘（懒加载边界不因刷新而松动）", async () => {
    const { root, src, pkg, disk } = fixture();
    const expanded = new Set(["/root", "/root/src"]);
    const host = makeHost([root], disk, expanded);

    await refreshTree(host, expanded, "/root/src");

    expect(host.getChildren).toHaveBeenCalledTimes(1); // sub 未展开 ⇒ 不递归
    expect(src.children).not.toBeNull();
    expect(pkg.children).not.toBeNull(); // 别的分支零触碰
  });

  it("未展开目录 → 只清缓存、**不触发加载**（加载留给下一次展开）", async () => {
    const { root, src, pkg, disk } = fixture();
    const expanded = new Set(["/root"]);
    const host = makeHost([root], disk, expanded);

    await refreshTree(host, expanded, "/root/pkg");

    expect(pkg.children).toBeNull();
    expect(host.getChildren).not.toHaveBeenCalled();
    expect(src.children).not.toBeNull(); // 不相干的已展开分支没被清
  });

  it("文件路径 / 未知路径 → 什么都不动（isDirectory 守卫）", async () => {
    const { root, src, disk } = fixture();
    const expanded = new Set(["/root", "/root/src"]);
    const host = makeHost([root], disk, expanded);

    await refreshTree(host, expanded, "/root/src/a.ts");
    await refreshTree(host, expanded, "/nowhere");

    expect(host.getChildren).not.toHaveBeenCalled();
    expect(src.children).not.toBeNull();
  });

  it("三个辅助函数都不自己 fire——「不 fire」是契约（调用方重载后统一触发）", async () => {
    const { root, disk } = fixture();
    const expanded = new Set(["/root"]);
    const host = makeHost([root], disk, expanded);

    await refreshTree(host, expanded, "/root");
    await reloadItem(host, expanded, root);
    await reloadExpandedDescendants(host, expanded, root);

    expect(host.onDidChange.fire).not.toHaveBeenCalled();
  });
});

describe("refreshTree（无 path——全量刷新）", () => {
  it("清缓存的边界 = 已展开节点 + 所有根（未展开的懒加载节点不在其列）", async () => {
    const { root, src, pkg, disk } = fixture();
    const expanded = new Set(["/root/src"]); // 根自己没展开
    const host = makeHost([root], disk, expanded);

    await refreshTree(host, expanded);

    // 已展开的 src 与所有根都被清了缓存
    expect(src.children).toBeNull();
    expect(root.children).toBeNull();
    // 未展开、又不是根 —— 不在「已展开节点」集合里，全量刷新不碰它（照现状：缓存留着不碍事，
    // 一旦它被展开，展开路径自己会 getChildren）
    expect(pkg.children).not.toBeNull();
    // 根未展开 ⇒ 一个 getChildren 都不该发（全量刷新不是「全量预加载」）
    expect(host.getChildren).not.toHaveBeenCalled();
  });

  it("根已展开 → 根被原子重载（子项随之回填）", async () => {
    const { root, disk } = fixture();
    const expanded = new Set(["/root"]);
    const host = makeHost([root], disk, expanded);

    await refreshTree(host, expanded);

    expect(host.getChildren).toHaveBeenCalledTimes(1);
    expect(host.getChildren).toHaveBeenCalledWith(root);
    expect(root.children).not.toBeNull();
  });
});

describe("reloadItem 的失败出口", () => {
  it("getChildren 抛错 → 吞掉不冒泡（console.error 记一条）——调用方不可能忘掉这一步", async () => {
    const { root, disk } = fixture();
    const expanded = new Set(["/root"]);
    const host = makeHost([root], disk, expanded);
    host.getChildren = vi.fn(async () => {
      throw new Error("EACCES");
    });

    await expect(reloadItem(host, expanded, root)).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledTimes(1);
    expect(root.children).toBeNull(); // 加载失败 ⇒ 停在「未加载」，不是半截状态
  });
});

describe("reloadExpandedDescendants", () => {
  it("只碰「目录 && 已展开」的子项——文件与未展开目录一律不动", async () => {
    const { root, src, sub, pkg, disk } = fixture();
    const expanded = new Set(["/root/src"]); // sub 未展开
    const host = makeHost([root], disk, expanded);

    await reloadExpandedDescendants(host, expanded, root);

    expect(host.getChildren).toHaveBeenCalledTimes(1);
    expect(host.getChildren).toHaveBeenCalledWith(src);
    expect(sub.children).not.toBeNull(); // 未展开 ⇒ 不递归重载
    expect(pkg.children).not.toBeNull();
  });

  it("children 未加载（null）→ 直接返回，不去猜子项", async () => {
    const { root, disk } = fixture();
    const expanded = new Set(["/root"]);
    const host = makeHost([root], disk, expanded);
    root.children = null;

    await reloadExpandedDescendants(host, expanded, root);

    expect(host.getChildren).not.toHaveBeenCalled();
  });
});
