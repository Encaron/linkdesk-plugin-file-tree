/**
 * fileIconRuntime——本插件持有的图标解析器实例态。E6#149 补测。
 *
 * 为什么单独立文件：`FileIconResolver` 本体的契约测试在**壳仓**（`src/components/shared/file-icon/
 * FileIconResolver.test.ts`，共享单一源码）。本模块剩的是**这一层的事**：实例被换了没有、
 * 换回 undefined 时是不是真的回到 codicon 保底（`iconTheme:changed` 卸主题走的就是这条）。
 * 少了它，「切主题 → 改图标」断在「换实例」这一环时无人报警。
 *
 * fixture 用虚构映射名（硬约束 21：禁真实插件名 / 真实 UI 文案）。
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { IconThemeMappings } from "@linkdesk/contracts";
import { getIconResolver, updateIconResolver } from "../services/fileIconRuntime";

/** 虚构图标主题——顶层 file/folder + 一处 ext，其余留空看是否回退 codicon 保底 */
const DEMO_THEME: IconThemeMappings = {
  file: { class: "demo-glyph-file" },
  folder: { class: "demo-glyph-folder" },
  extensions: { ".ts": { class: "demo-glyph-ts" } },
  folders: { "demo-src": { class: "demo-glyph-src" } },
};

beforeEach(() => {
  // 模块级实例态全文件共享——每例先回到「默认主题」，别让上一条用例的主题漏下来
  updateIconResolver();
});

describe("fileIconRuntime", () => {
  it("默认（undefined）= 壳 codicon 保底——未命中任何映射的扩展名走内置默认表", () => {
    const r = getIconResolver();

    expect(r.getFileIcon("main.py")).toEqual({ kind: "class", className: "codicon-file" });
    expect(r.getFolderIcon("node_modules", false)).toEqual({ kind: "class", className: "codicon-archive" });
  });

  it("未调用 updateIconResolver 前多次取用 → 同一个实例（不每次新建）", () => {
    expect(getIconResolver()).toBe(getIconResolver());
  });

  it("updateIconResolver(mappings) → 解析器换成主题那份：ext 命中主题、未命中回落主题顶层默认", () => {
    updateIconResolver(DEMO_THEME);
    const r = getIconResolver();

    expect(r.getFileIcon("a.ts")).toEqual({ kind: "class", className: "demo-glyph-ts" });
    // .py 主题没声明 → 回落**主题顶层 file**（不是 codicon）——主题只替换声明部分
    expect(r.getFileIcon("main.py")).toEqual({ kind: "class", className: "demo-glyph-file" });
    expect(r.getFolderIcon("demo-src", false)).toEqual({ kind: "class", className: "demo-glyph-src" });
  });

  it("再 updateIconResolver()（undefined）→ 回到 codicon 保底（主题卸载路径，不是「保持上一次」）", () => {
    updateIconResolver(DEMO_THEME);
    expect(getIconResolver().getFileIcon("a.ts")).toEqual({ kind: "class", className: "demo-glyph-ts" });

    updateIconResolver();
    const r = getIconResolver();

    const ts = r.getFileIcon("a.ts");
    expect(ts).not.toEqual({ kind: "class", className: "demo-glyph-ts" });
    expect(ts.kind).toBe("class");
    expect("className" in ts && ts.className).toMatch(/^codicon-/);
    expect(r.getFileIcon("main.py")).toEqual({ kind: "class", className: "codicon-file" });
  });
});
