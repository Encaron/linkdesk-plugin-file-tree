/**
 * openWithStore 单测——F1 选择器的开关状态机（纯逻辑，无 DOM）。
 * 钉住的是「订阅语义写反」类 bug：快照引用稳定（useSyncExternalStore 依赖引用相等）、
 * 关闭态幂等（close 未开面板不发通知）、订阅退订后不再收。
 */
import { describe, it, expect, vi } from "vitest";
import {
  openOpenWithPicker,
  closeOpenWithPicker,
  subscribeOpenWithPicker,
  getOpenWithPickerState,
} from "../openWith/openWithStore";

const REQ = { uri: "/w/论文.pdf", name: "论文.pdf", ext: "pdf", anchor: { x: 10, y: 20 } };

describe("openWithStore（F1 选择器开关状态机）", () => {
  it("打开 → 快照非空且引用稳定；关闭 → 快照回 null", () => {
    closeOpenWithPicker();
    expect(getOpenWithPickerState()).toBeNull();

    openOpenWithPicker(REQ);
    const s1 = getOpenWithPickerState();
    expect(s1).toMatchObject({ uri: REQ.uri, ext: "pdf" });

    openOpenWithPicker(REQ); // 同请求重复打开——引用刷新（订阅者重渲染一次），内容一致
    const s2 = getOpenWithPickerState();
    expect(s2).not.toBe(s1);
    expect(s2).toMatchObject({ uri: REQ.uri });

    closeOpenWithPicker();
    expect(getOpenWithPickerState()).toBeNull();
  });

  it("关闭态再关 = no-op（不惊动订阅者）", () => {
    closeOpenWithPicker();
    const cb = vi.fn();
    const unsub = subscribeOpenWithPicker(cb);
    closeOpenWithPicker();
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it("开/关都通知订阅者；退订后不再收", () => {
    closeOpenWithPicker();
    const seen: Array<string | null> = [];
    const unsub = subscribeOpenWithPicker(() => seen.push(getOpenWithPickerState()?.ext ?? null));
    openOpenWithPicker(REQ);
    closeOpenWithPicker();
    unsub();
    openOpenWithPicker(REQ);
    expect(seen).toEqual(["pdf", null]);
  });
});
