/**
 * OpenWithPanel 行为测试（F1 · jsdom）——「选择器写得对不对」的机械证据。
 *
 * 钉住：① 行渲染（全部 handler＋当前默认标记）② 「当前默认」行只随用户覆盖出现
 * ③ 打开（仅此一次）= tabs.create(pluginId) 不落盘 ④ 设为默认 = setDefault(ext, pluginId)
 * ⑤ 恢复自动 = setDefault(ext, null) ⑥ 空态（无 handler ⇒ 市场搜索入口）。
 * fixture 全虚构（硬约束 21）。
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";

// React 18 act 环境标志（jsdom 下必挂，否则 act 只告警不生效）
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

// 测试环境无宿主 i18n 资源——最小初始化：缺 key 回原文（key = 中文原文，与运行时口径一致）
import i18n from "i18next";
i18n.init({ lng: "zh", resources: {}, parseMissingKeyHandler: (key) => key });

const calls: Record<string, unknown[]> = { tabs: [], setDefault: [], events: [] };

const mockHandlers = {
  txt: [
    { pluginId: "demo-editor", displayName: "Demo Editor", isCurrent: true },
    { pluginId: "demo-reader", displayName: "Demo Reader", isCurrent: false },
  ],
};

vi.stubGlobal("window", Object.assign(window, {
  linkdesk: {
    fileAssociation: {
      listHandlersFor: vi.fn(async (ext: string) => (ext === "txt" ? mockHandlers.txt : [])),
      setDefault: vi.fn(async (ext: string, pluginId: string | null) => {
        calls.setDefault.push([ext, pluginId]);
        mockHandlers.txt = mockHandlers.txt.map((h) => ({
          ...h,
          isCurrent: pluginId === null ? h.pluginId === "demo-editor" : h.pluginId === pluginId,
        }));
      }),
    },
    configuration: { get: vi.fn(async () => ({ ".txt": "demo-reader" })) },
    plugins: { listAll: vi.fn(async () => []) },
    tabs: { create: vi.fn((...a: unknown[]) => calls.tabs.push(a)) },
    events: { emit: vi.fn((...a: unknown[]) => calls.events.push(a)) },
  },
}));

import { OpenWithPanelHost } from "../openWith/OpenWithPanel";
import { openOpenWithPicker, closeOpenWithPicker } from "../openWith/openWithStore";

let container: HTMLDivElement;
let root: Root;
async function renderHost(): Promise<void> {
  await act(async () => {
    root.render(React.createElement(OpenWithPanelHost));
  });
}
/** 取含指定文案的 button——OverlayPortal 渲染在 body 级（容器外） */
function buttonWith(text: string): HTMLButtonElement {
  const btn = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes(text));
  if (!btn) throw new Error(`button "${text}" not found`);
  return btn;
}

beforeEach(() => {
  calls.tabs.length = 0;
  calls.setDefault.length = 0;
  calls.events.length = 0;
  mockHandlers.txt = [
    { pluginId: "demo-editor", displayName: "Demo Editor", isCurrent: true },
    { pluginId: "demo-reader", displayName: "Demo Reader", isCurrent: false },
  ];
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  return async () => {
    closeOpenWithPicker();
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
});

describe("OpenWithPanel（F1 选择器）", () => {
  it("① 列全部 handler；用户覆盖在 ⇒ 当前默认行＋徽标随覆盖表走", async () => {
    openOpenWithPicker({ uri: "/w/a.txt", name: "a.txt", ext: "txt", anchor: { x: 10, y: 20 } });
    await renderHost();
    const html = document.body.innerHTML;
    expect(html).toContain("Demo Editor");
    expect(html).toContain("Demo Reader");
    expect(html).toContain("当前默认"); // 覆盖 {".txt":"demo-reader"} ⇒ 顶部行出现
    expect(html).toContain("恢复自动");
    // demo-reader 是覆盖指向者 ⇒ 徽标「默认」；demo-editor 是落选者 ⇒ 无徽标行文案
    const readerRow = [...document.body.querySelectorAll(".file-tree-openwith-row")].find((r) =>
      r.textContent?.includes("Demo Reader"),
    );
    expect(readerRow?.innerHTML).toContain("默认");
  });

  it("② 「打开（仅此一次）」→ tabs.create（插件 id 随行，不写覆盖表）", async () => {
    openOpenWithPicker({ uri: "/w/a.txt", name: "a.txt", ext: "txt", anchor: null });
    await renderHost();
    const btn = buttonWith("打开（仅此一次）");
    expect(calls.tabs).toEqual([]);
    await act(async () => {
      btn.click();
    });
    expect(calls.tabs).toEqual([["demo-editor", { filePath: "/w/a.txt", sourceId: "/w/a.txt", label: "a.txt", pinned: true }]]);
    expect(calls.setDefault).toEqual([]);
  });

  it("③ 「设为默认」→ setDefault(ext, pluginId)，面板现读刷新（E31）", async () => {
    openOpenWithPicker({ uri: "/w/a.txt", name: "a.txt", ext: "txt", anchor: null });
    await renderHost();
    const editorRow = [...document.body.querySelectorAll(".file-tree-openwith-row")].find((r) =>
      r.textContent?.includes("Demo Editor"),
    );
    const btn = [...(editorRow?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.includes("设为默认"));
    await act(async () => {
      btn!.click();
    });
    expect(calls.setDefault).toEqual([["txt", "demo-editor"]]);
    // 现读刷新：editor 变 isCurrent ⇒ 「当前默认」行显示 Demo Editor
    expect(document.body.innerHTML).toContain("Demo Editor");
  });

  it("④ 「恢复自动」→ setDefault(ext, null)", async () => {
    openOpenWithPicker({ uri: "/w/a.txt", name: "a.txt", ext: "txt", anchor: null });
    await renderHost();
    await act(async () => {
      buttonWith("恢复自动").click();
    });
    expect(calls.setDefault).toEqual([["txt", null]]);
  });

  it("⑤ 空态：无 handler ⇒ 市场搜索入口（揭示 marketplace 侧栏）", async () => {
    openOpenWithPicker({ uri: "/w/b.xyzfix", name: "b.xyzfix", ext: "xyzfix", anchor: null });
    await renderHost();
    expect(document.body.innerHTML).toContain("没有任何已装插件声明");
    await act(async () => {
      buttonWith("在市场搜索阅读器").click();
    });
    expect(calls.events).toEqual([["icon:selected", "marketplace"]]);
  });
});
