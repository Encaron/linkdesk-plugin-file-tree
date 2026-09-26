/**
 * E6#155 步一：CompactFolder 纯函数分支补测。
 * 立案读数里官方五仓最后一个「零测」单元——此前只有 CompactController.test.ts 经控制器
 * 间接覆盖 5/6 分支，唯一没跑到的是 `!child.isDirectory → null`（唯一子节点是文件）这一分支。
 */

import { describe, it, expect } from "vitest";
import { getCompactedPath, isCompacted } from "../components/CompactFolder";
import type { ExplorerItem } from "../services/FileTreeModel";

/** 测试夹具用中性占位名（⛔ 不用真插件名/真 UI 文案） */
function dir(name: string, children: ExplorerItem[] | null): ExplorerItem {
  return { uri: `/${name}`, name, isDirectory: true, isSymlink: false, children, parent: null };
}

function file(name: string): ExplorerItem {
  return { uri: `/${name}`, name, isDirectory: false, isSymlink: false, children: null, parent: null };
}

describe("CompactFolder.getCompactedPath", () => {
  it("唯一子节点是文件 → 不压缩（返回 null）——立案读数里唯一未覆盖的分支", () => {
    const parent = dir("parent", [file("b.ts")]);
    expect(getCompactedPath(parent)).toBeNull();
    expect(isCompacted(parent)).toBe(false);
  });

  it("压缩链在文件前停下——「唯一子节点是文件」的目录层返回 null，文件名不进面包屑", () => {
    // parent → sub → b.ts：sub 层命中「唯一子节点是文件 → null」分支 ⇒ sub 的压缩段不含文件名，
    // parent 层以 [parent.name, sub.name] 收尾——压缩的是目录链，文件名永远不进面包屑。
    const parent = dir("parent", [dir("sub", [file("b.ts")])]);
    expect(getCompactedPath(parent)).toEqual(["parent", "sub"]);
    expect(isCompacted(parent)).toBe(true);
  });

  it("压缩链以空目录收尾——子目录没有子节点时以子目录名结尾", () => {
    const parent = dir("parent", [dir("empty", [])]);
    expect(getCompactedPath(parent)).toEqual(["parent", "empty"]);
  });
});
