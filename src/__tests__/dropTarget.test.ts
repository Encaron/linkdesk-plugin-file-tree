/**
 * dropTarget——由鼠标位置解析拖放目标。E6#149 补测。
 *
 * 为什么单独立文件：`FileTreeDnD.test.ts` 测的是 **`executeSafeDrop`**（`FileTreeDnD/execute.ts`）——
 * 那个函数有**自己的一套内联祖先判据**，跟本夹的 `isAncestorOf` 不是同一段代码。同名的
 * `FileTreeDnD.test.ts` 因此看不见本模块 ⇒ 三个导出零断言（改坏 `getDropTargetIndex` 的取整、
 * 或让 `isAncestorOf` 放行路径前缀不相邻的兄弟，拖放目标就会指错目录，而测试全绿）。
 *
 * 断言口径照生产现状：本模块**不做路径归一**（`isAncestorOf` 里写死 "/" 分隔比较），归一由调用方负责。
 */

import { describe, expect, it } from "vitest";
import { getDropTargetIndex, isAncestorOf, resolveDropTarget } from "../services/FileTreeDnD/dropTarget";
import { setUiFontScale } from "../utils/layoutTokens";
import type { ExplorerItem } from "../services/FileTreeModel";
import type { FlatItem } from "../utils/pathUtils";

function item(uri: string, isDirectory: boolean): ExplorerItem {
  return { uri, name: uri.split("/").pop() || uri, isDirectory, isSymlink: false, children: null, parent: null };
}

function flat(it: ExplorerItem, depth = 0): FlatItem {
  return { item: it, depth };
}

describe("getDropTargetIndex（鼠标 Y → flatItems 索引）", () => {
  it("容器顶 + 无滚动 → 第 0 行", () => {
    expect(getDropTargetIndex(100, 0, 100)).toBe(0);
  });

  it("行内中段向下取整——没走完一整行仍算本行", () => {
    expect(getDropTargetIndex(125, 0, 100)).toBe(0); // +25 < 26
    expect(getDropTargetIndex(126, 0, 100)).toBe(1); // 满一行
  });

  it("滚动量参与计算——容器已滚动 2 行时同一屏幕位置指向第 2 行之后", () => {
    expect(getDropTargetIndex(100, 0, 100)).toBe(0);
    expect(getDropTargetIndex(100, 52, 100)).toBe(2);
  });

  it("鼠标在容器上方 → 负数原样返回（越界由 resolveDropTarget 兜）", () => {
    expect(getDropTargetIndex(90, 0, 100)).toBe(-1);
  });

  it("行高随字号比例缩放——同一 Y 在大字号下指向更靠前的行", () => {
    setUiFontScale(100);
    const at100 = getDropTargetIndex(300, 0, 100); // 200 / 26 = 7
    setUiFontScale(200);
    const at200 = getDropTargetIndex(300, 0, 100); // 200 / 52 = 3
    setUiFontScale(100);
    expect(at100).toBe(7);
    expect(at200).toBe(3);
  });
});

describe("resolveDropTarget（索引 → 目标目录）", () => {
  const dir = item("/root/src", true);
  const file = item("/root/src/a.ts", false);
  const flats = [flat(item("/root", true)), flat(dir, 1), flat(file, 2)];

  it("目录项 → 目标就是它自己；effect 恒为 move、index/item 原样带回", () => {
    expect(resolveDropTarget(1, flats)).toEqual({ index: 1, item: dir, targetDir: "/root/src", effect: "move" });
  });

  it("文件项 → 目标是它所在的父目录", () => {
    expect(resolveDropTarget(2, flats)?.targetDir).toBe("/root/src");
    expect(resolveDropTarget(2, flats)?.item).toBe(file);
  });

  it("索引越界（-1 / 长度）→ null——鼠标在树上下的空白处不产生目标", () => {
    expect(resolveDropTarget(-1, flats)).toBeNull();
    expect(resolveDropTarget(3, flats)).toBeNull();
  });

  it("空树 → null", () => {
    expect(resolveDropTarget(0, [])).toBeNull();
  });
});

describe("isAncestorOf（禁止拖祖先到后代）", () => {
  it("目录 → 其后代：true（含跨多层）", () => {
    expect(isAncestorOf(item("/root/src", true), item("/root/src/sub", true))).toBe(true);
    expect(isAncestorOf(item("/root/src", true), item("/root/src/sub/b.ts", false))).toBe(true);
  });

  it("同一 URI → false（自己不是自己的祖先——同路径由调用方另判「无操作」）", () => {
    expect(isAncestorOf(item("/root/src", true), item("/root/src", true))).toBe(false);
  });

  it("源是文件 → 恒 false（文件没有后代，哪怕路径看着像前缀）", () => {
    expect(isAncestorOf(item("/root/src", false), item("/root/src/sub", true))).toBe(false);
  });

  it("前缀相同但不是路径段 → false（/root/src 不是 /root/src2/x 的祖先）", () => {
    expect(isAncestorOf(item("/root/src", true), item("/root/src2/x", false))).toBe(false);
  });

  it("反向（后代 → 祖先）→ false——判据是单向的", () => {
    expect(isAncestorOf(item("/root/src/sub", true), item("/root/src", true))).toBe(false);
  });

  it("目标未归一（含反斜杠）→ false——本模块不做归一，调用方必须先 normalizePath", () => {
    expect(isAncestorOf(item("/root/src", true), item("/root\\src\\sub", true))).toBe(false);
  });
});
