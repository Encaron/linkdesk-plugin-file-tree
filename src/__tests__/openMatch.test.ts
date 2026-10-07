// @vitest-environment jsdom
/**
 * openMatch 单测——兜底链修复（2026-10-07）判据 J3/J4（搜索入口）。
 *
 * 钉死：空扩展名（无后缀 / 点开头文件）**不再静默 return**——照样问宿主、按答复开标签；
 * 旧行为 `if (!ext) return` 让搜索双击对这类文件是「点了没反应」的死点。
 * ⚠️ openMatch 在模块顶层捕 `window.linkdesk` ⇒ 须先装 window 再动态 import（逐用例 resetModules）。
 * fixture 全虚构（硬约束 21）：挂牌者 id 故意不叫 editor（自证不写死插件 id）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type OpenMatchModule = typeof import("../views/SearchView/openMatch");

const created: { type: string; filePath: string }[] = [];
let mod: OpenMatchModule;
let pluginFor: ReturnType<typeof vi.fn>;

function installWindow(answer: (ext: string) => Promise<string | undefined>): void {
  created.length = 0;
  pluginFor = vi.fn(answer);
  (window as unknown as { linkdesk: unknown }).linkdesk = {
    fileAssociation: { getPluginFor: pluginFor },
    tabs: {
      create: (type: string, opts: { filePath: string }) => {
        created.push({ type, filePath: opts.filePath });
      },
    },
  };
}

const MATCH = (filePath: string) => ({ filePath } as unknown as Parameters<OpenMatchModule["openMatch"]>[0]);

beforeEach(async () => {
  vi.resetModules();
  created.length = 0;
});

afterEach(() => {
  delete (window as unknown as { linkdesk?: unknown }).linkdesk;
  vi.restoreAllMocks();
});

describe("openMatch（兜底链 J3/J4：搜索入口恒调宿主面）", () => {
  it("零回归：有扩展名 → 按宿主答复开标签", async () => {
    installWindow(async () => "demo-plugin");
    mod = await import("../views/SearchView/openMatch");
    await mod.openMatch(MATCH("/tmp/demo/a.xyz"));
    expect(created).toEqual([{ type: "demo-plugin", filePath: "/tmp/demo/a.xyz" }]);
    expect(pluginFor).toHaveBeenCalledWith("xyz");
  });

  it("🔴 无后缀文件 → 照样问宿主并按答复开标签（不再死点）", async () => {
    installWindow(async (ext) => (ext ? "demo-plugin" : "demo-editor-a"));
    mod = await import("../views/SearchView/openMatch");
    await mod.openMatch(MATCH("/tmp/demo/Makefile"));
    expect(pluginFor).toHaveBeenCalledWith("");
    expect(created).toEqual([{ type: "demo-editor-a", filePath: "/tmp/demo/Makefile" }]);
  });

  it("🔴 点开头文件（.gitignore）→ 同路（dot>0 才算扩展名 ⇒ ext=\"\"）", async () => {
    installWindow(async (ext) => (ext ? "demo-plugin" : "demo-editor-a"));
    mod = await import("../views/SearchView/openMatch");
    await mod.openMatch(MATCH("/tmp/demo/.gitignore"));
    expect(pluginFor).toHaveBeenCalledWith("");
    expect(created).toHaveLength(1);
  });

  it("🔴 点了目录名的路径 ＋ 无后缀文件（/tmp/v1.2/Makefile）→ ext 必须按 basename 算（潜伏 bug：整条路径喂 extension() 曾算出「2/Makefile」）", async () => {
    installWindow(async (ext) => (ext ? "demo-plugin" : "demo-editor-a"));
    mod = await import("../views/SearchView/openMatch");
    await mod.openMatch(MATCH("/tmp/v1.2/Makefile"));
    expect(pluginFor).toHaveBeenCalledWith("");
    expect(created).toEqual([{ type: "demo-editor-a", filePath: "/tmp/v1.2/Makefile" }]);
  });

  it("宿主答 undefined → 不开标签（保守不拦，不变）", async () => {
    installWindow(async () => undefined);
    mod = await import("../views/SearchView/openMatch");
    await mod.openMatch(MATCH("/tmp/demo/a.xyz"));
    expect(created).toHaveLength(0);
  });
});
