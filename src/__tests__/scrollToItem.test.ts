/**
 * scrollToItem——键盘导航的「把目标行滚进视口」。E6#149 补测。
 *
 * 为什么单独立文件：本模块被 `FileTreeKeyboard/{navigation,typeAhead,index}.ts` 共用，但那条链整体
 * 属视图/交互层（依赖真 DOM 与 React），既有 6 个测试文件都不碰它 ⇒ `scrollToItem` 自己零断言。
 * 而它是**纯计算 + 两次赋值**：只要一个假容器就能测（⛔ 不引 RTL、不搭真视口）。
 *
 * 假容器只实现被读写的三样（`scrollTop` / `clientHeight`）——`clientHeight` 在 jsdom 里恒为 0
 * 且只读，真 DOM 反而测不了「视口高度」这个变量。
 */

import { describe, expect, it } from "vitest";
import { scrollToItem } from "../services/FileTreeKeyboard/scrollToItem";
import { setUiFontScale, TREE_ITEM_HEIGHT } from "../utils/layoutTokens";

function container(scrollTop: number, clientHeight: number): HTMLDivElement {
  return { scrollTop, clientHeight } as unknown as HTMLDivElement;
}

const H = TREE_ITEM_HEIGHT; // 26px（scale 100）

describe("scrollToItem", () => {
  it("容器为 null → 直接返回（组件卸载后回调仍可能打进来）", () => {
    expect(() => scrollToItem(5, null)).not.toThrow();
  });

  it("目标在视口上方 → 滚到目标顶（贴顶，不留空）", () => {
    const el = container(200, 300); // 视口 200~500
    scrollToItem(5, el); // 目标顶 = 130
    expect(el.scrollTop).toBe(5 * H);
  });

  it("目标在视口下方 → 滚到「目标贴底」的位置", () => {
    const el = container(0, 300);
    scrollToItem(20, el); // 目标顶 520，视口底 300
    expect(el.scrollTop).toBe(20 * H - 300 + H); // 520 - 300 + 26 = 246
  });

  it("目标已完整可见 → 一点不动（不为了居中而抖视口）", () => {
    const el = container(0, 300);
    scrollToItem(2, el); // 52 ~ 78，全在 0~300 内
    expect(el.scrollTop).toBe(0);
  });

  it("贴顶与贴底的边界都算「可见」——相等不算越界", () => {
    const top = container(52, 300);
    scrollToItem(2, top); // 目标顶 === scrollTop
    expect(top.scrollTop).toBe(52);

    const bottom = container(0, 10 * H + H); // 286 = 目标底
    scrollToItem(10, bottom);
    expect(bottom.scrollTop).toBe(0);
  });

  it("行高随字号比例缩放——同一 index 在大字号下滚动量更大", () => {
    setUiFontScale(150); // 26 * 1.5 = 39
    try {
      const el = container(0, 38);
      scrollToItem(1, el); // 目标顶 39，视口底 38 ⇒ 贴底滚
      expect(el.scrollTop).toBe(39 - 38 + 39);
    } finally {
      setUiFontScale(100);
    }
  });
});
