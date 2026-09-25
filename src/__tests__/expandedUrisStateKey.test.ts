/**
 * expandedUrisStateKey——展开态落盘 key 的多窗维度。E6#149 补测。
 *
 * 为什么单独立文件：`useExpandPersistence` / `useWorkspaceRoots` 两个 hook 消费它，而 hook 属视图层
 * （本层口径外）；key 生成本身是纯函数 ⇒ 单测。判据有两面：
 *   - **多窗不互相覆盖**：`?wsWindow=ws-N` 时 key 带窗维度；
 *   - **旧数据零迁移**：无参数/脏值一律回退旧 key `expandedUris`（第一个窗的既有展开态直接沿用）。
 * 脏值防线（`/^ws-\d+$/`）是源码里写明的「拒绝脏值混进 key」——本文件把它钉住。
 */

import { afterEach, describe, expect, it } from "vitest";
import { expandedUrisStateKey } from "../utils/expandedUrisStateKey";

/** 把 jsdom 的 location.search 设成指定查询串（空串 = 无查询参数） */
function goto(search: string): void {
  window.history.replaceState({}, "", search ? `/?${search}` : "/");
}

afterEach(() => {
  goto("");
});

describe("expandedUrisStateKey", () => {
  it("无 wsWindow 参数 → 旧 key `expandedUris`（单窗时代/既有数据零迁移）", () => {
    goto("");
    expect(expandedUrisStateKey()).toBe("expandedUris");
  });

  it("`?wsWindow=ws-2` → key 带窗维度（每窗展开态互不覆盖）", () => {
    goto("wsWindow=ws-2");
    expect(expandedUrisStateKey()).toBe("expandedUris:ws-2");
  });

  it("多位数窗号照收（ws-12）", () => {
    goto("wsWindow=ws-12");
    expect(expandedUrisStateKey()).toBe("expandedUris:ws-12");
  });

  it("与别的参数并存 → 仍按 wsWindow 取（不靠参数顺序）", () => {
    goto("theme=dark&wsWindow=ws-3&x=1");
    expect(expandedUrisStateKey()).toBe("expandedUris:ws-3");
  });

  it("脏值一律回退旧 key——不允许写花 key（ws-abc / ws- / ws-2x / ws2 / 带空格 / 空值）", () => {
    for (const dirty of ["wsWindow=ws-abc", "wsWindow=ws-", "wsWindow=ws-2x", "wsWindow=ws2", "wsWindow=%20ws-2", "wsWindow="]) {
      goto(dirty);
      expect(expandedUrisStateKey(), dirty).toBe("expandedUris");
    }
  });

  it("每次调用现算——URL 变了立刻反映（不缓存在模块里）", () => {
    goto("wsWindow=ws-5");
    expect(expandedUrisStateKey()).toBe("expandedUris:ws-5");
    goto("");
    expect(expandedUrisStateKey()).toBe("expandedUris");
  });
});
