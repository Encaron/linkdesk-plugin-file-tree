/**
 * fileTreeErrors 单测——返回式错误信封（跨 contextBridge 可携带）＋ 码表稳定。
 * ⛔ Error 实例：结构化克隆只带 name/message，码会丢（池侧只能归 EUNKNOWN）。
 */
import { describe, expect, it } from "vitest";
import { FILETREE_ERROR_CODES, fileTreeError } from "../services/fileTreeErrors";

describe("file-tree 返回式错误信封", () => {
  it("码表四码稳定（EBADARGS/EEXIST/EFS/ECONFLICT）", () => {
    expect(FILETREE_ERROR_CODES.EBADARGS).toBe("EBADARGS");
    expect(FILETREE_ERROR_CODES.EEXIST).toBe("EEXIST");
    expect(FILETREE_ERROR_CODES.EFS).toBe("EFS");
    expect(FILETREE_ERROR_CODES.ECONFLICT).toBe("ECONFLICT");
  });

  it("fileTreeError 返回普通对象（不是 Error）；code/hint/details 可跨桥", () => {
    const err = fileTreeError(
      FILETREE_ERROR_CODES.ECONFLICT,
      "树状态已变化",
      "先 file-tree.refresh",
      { stateVersion: 3 },
    );
    expect(err).not.toBeInstanceOf(Error);
    expect(err.isPluginError).toBe(true);
    expect(err.code).toBe("ECONFLICT");
    expect(err.hint).toMatch(/refresh/);
    expect(err.details).toEqual({ stateVersion: 3 });
    expect(structuredClone(err)).toEqual(err);
  });

  it("入参写错当场失败（编程错误不是业务回执）", () => {
    expect(() => fileTreeError("" as never, "x")).toThrow(TypeError);
    expect(() => fileTreeError(FILETREE_ERROR_CODES.EFS, "")).toThrow(TypeError);
  });
});
