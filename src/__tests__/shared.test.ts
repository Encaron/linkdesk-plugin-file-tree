/**
 * shared——命令组的共用件（E6#149 补测）。
 *
 * 为什么单独立文件：`commands/shared.ts` 被四五个命令组 import（`placeholder` / `refreshDirSafe`），
 * 但既有 6 个测试文件都不碰它 ⇒ 零断言。两件里 `refreshDirSafe` 是**唯一失败出口的接线点**
 * （E6#73m K2：刷新失败必须走到 `FileTreeNotify`，不能像老写法那样只 `console.error`）——这条
 * 接错了用户就是「点了刷新，目录没动，也没说为什么」。
 *
 * 替身（⛔ 不动共享地基）：
 *   1. `window.linkdesk.notifications.show` 是**共享 mock 里没有的命名空间**（六通用面里没有铃铛）——
 *      本文件 `vi.fn()` 补上，用来断言「失败真的报了」；
 *   2. model 用最小桩（只实现被调到的成员）——正是「插件专属桩住本仓测试文件」的写法。
 *
 * ⚠️ 本文件随后被同一任务的 **`fix:` 笔**动过（⛔ 与补测笔不同笔）：补测读数读出真 bug——原
 * `refreshDirSafe` 漏 `await` 又补一次 `getChildren` ⇒ 同一目录并发读两遍盘。原「已展开 → 再拉
 * 一次子项」那条断言正是把这个 bug 当成了预期，故被替换成两条钉子（等 refresh 做完 / 不读第二遍）。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { placeholder, refreshDirSafe } from "../components/FileTreeContextMenu/commands/shared";
import type { FileTreeModel } from "../services/FileTreeModel";

type Notification = { message: string; opts?: Record<string, unknown> };
let show: ReturnType<typeof vi.fn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

/** 最小 model 桩——只实现 `refresh`（修根后 refreshDirSafe 只调它）；另三个成员留作「不许被调到」的探针 */
function modelStub(over: Partial<Record<"refresh" | "findClosest" | "isExpanded" | "getChildren", unknown>> = {}) {
  return {
    refresh: vi.fn(),
    findClosest: vi.fn(() => null),
    isExpanded: vi.fn(() => false),
    getChildren: vi.fn(async () => []),
    ...over,
  } as unknown as FileTreeModel;
}

beforeEach(() => {
  show = vi.fn();
  (window.linkdesk as unknown as { notifications: { show: unknown } }).notifications = { show };
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  delete (window.linkdesk as unknown as { notifications?: unknown }).notifications;
});

describe("placeholder（未实现命令的占位 handler）", () => {
  it("返回 async handler：调用即解析（不炸调用方），并 warn 出命令 id", async () => {
    const handler = placeholder("demo.command");

    await expect(handler()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain("demo.command");
  });
});

describe("refreshDirSafe（刷新目录——唯一失败出口接线点）", () => {
  it("先让模型刷新那个目录", async () => {
    const model = modelStub();

    await refreshDirSafe(model, "/root/src");

    expect(model.refresh).toHaveBeenCalledWith("/root/src");
  });

  it("🔴 等 refresh 做完才算完——refresh 还挂着时不许提前返回（原写法漏 await，正是并发读两遍盘的根因）", async () => {
    let release!: () => void;
    const model = modelStub({ refresh: vi.fn(() => new Promise<void>((r) => { release = r; })) });
    let done = false;
    const running = refreshDirSafe(model, "/root/src").then(() => { done = true; });

    await Promise.resolve();
    expect(done).toBe(false); // refresh 未完成 ⇒ 调用方必须还在等

    release();
    await running;
    expect(done).toBe(true);
  });

  it("🔴 同一目录不读第二遍——已展开目录也不补 getChildren（refresh 自己会重读子项并 fire）", async () => {
    const item = { uri: "/root/src", isDirectory: true };
    const model = modelStub({ findClosest: vi.fn(() => item), isExpanded: vi.fn(() => true) });

    await refreshDirSafe(model, "/root/src");

    expect(model.refresh).toHaveBeenCalledTimes(1);
    // 三个成员零调用 = 没有第二条读盘路径。补一次 `getChildren` 就是「同一目录并发读两遍盘」
    // （refresh → reloadItem 先把 children 清 null，补的那次见 null 又读一次）。
    expect(model.getChildren).not.toHaveBeenCalled();
    expect(model.findClosest).not.toHaveBeenCalled();
    expect(model.isExpanded).not.toHaveBeenCalled();
  });

  it("目标不在模型里 / 未展开 → 没有任何补读（懒加载边界不被刷新越过）", async () => {
    const missing = modelStub({ findClosest: vi.fn(() => null) });
    await refreshDirSafe(missing, "/root/gone");
    expect(missing.getChildren).not.toHaveBeenCalled();

    const collapsed = modelStub({
      findClosest: vi.fn(() => ({ uri: "/root/pkg", isDirectory: true })),
      isExpanded: vi.fn(() => false),
    });
    await refreshDirSafe(collapsed, "/root/pkg");
    expect(collapsed.getChildren).not.toHaveBeenCalled();
  });

  it("刷新抛错（目录已被移走 / 权限没了）→ 不冒泡，走 FileTreeNotify 那个唯一出口", async () => {
    const model = modelStub({
      refresh: vi.fn(() => {
        throw new Error("EACCES: permission denied");
      }),
    });

    await expect(refreshDirSafe(model, "/root/src")).resolves.toBeUndefined();

    expect(show).toHaveBeenCalledTimes(1);
    // ⚠️ 判据落在 **opts** 上，不落在 message 文案上：`i18n.t()` 在测试环境未初始化（i18next 返回
    //    undefined），文案在真机才由插件运行时初始化后的字典解析——文案是否齐全由字典门禁守，
    //    本文件的判据是「失败有没有走到那个唯一出口、出口参数对不对」。
    const [, opts] = show.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(opts).toEqual({ type: "error", source: "file-tree", persistent: true });
  });

  it("刷新以**拒绝**失败（refresh 内部 async 抛）→ 同样落进那个出口（补 await 之前这里是无人接的拒绝）", async () => {
    const model = modelStub({
      refresh: vi.fn(async () => {
        throw new Error("EPERM: operation not permitted");
      }),
    });

    await expect(refreshDirSafe(model, "/root/src")).resolves.toBeUndefined();

    expect(show).toHaveBeenCalledTimes(1);
  });

  it("一切正常时**不出声**——成功路径不许弹通知（show 零调用）", async () => {
    const model = modelStub({
      findClosest: vi.fn(() => ({ uri: "/root/src", isDirectory: true })),
      isExpanded: vi.fn(() => true),
    });

    await refreshDirSafe(model, "/root/src");

    expect(show).not.toHaveBeenCalled();
  });
});
