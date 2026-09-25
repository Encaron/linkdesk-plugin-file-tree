/**
 * fsWatcher——文件系统变更的组件内发射器。E6#149 补测。
 *
 * 为什么单独立文件：`fsEmitter` 是 `FoldersView` 里「watch 回调 → 树刷新」的那一段，模块级单例、
 * 无 DOM 依赖 ⇒ 可纯逻辑测。既有 6 个测试文件都不碰它 ⇒ 退订与错误隔离零断言
 * （错误隔离是源码写明的设计：一个订阅者崩了不能连累别的订阅者）。
 *
 * 单例提醒：`fsEmitter` 全文件共享 ⇒ 每条用例自己退订干净，别让监听器漏到下一条。
 */

import { describe, expect, it, vi } from "vitest";
import { fsEmitter } from "../views/FoldersView/fsWatcher";
import type { FsChangeEvent } from "../views/FoldersView/fsWatcher";

const EVENTS: FsChangeEvent[] = [
  { path: "/root/src/a.ts", type: "change" },
  { path: "/root/src/b.ts", type: "add" },
];

describe("fsEmitter", () => {
  it("event 订阅 + fire → 每个监听器都收到同一批事件", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = fsEmitter.event(a);
    const offB = fsEmitter.event(b);
    try {
      fsEmitter.fire(EVENTS);

      expect(a).toHaveBeenCalledTimes(1);
      expect(a).toHaveBeenCalledWith(EVENTS);
      expect(b).toHaveBeenCalledWith(EVENTS);
    } finally {
      offA();
      offB();
    }
  });

  it("退订后不再收到（卸载即摘）", () => {
    const fn = vi.fn();
    const off = fsEmitter.event(fn);
    off();

    fsEmitter.fire(EVENTS);

    expect(fn).not.toHaveBeenCalled();
  });

  it("退订幂等——调两次不抛（React 严格模式下 cleanup 可能重入）", () => {
    const off = fsEmitter.event(vi.fn());
    off();
    expect(() => off()).not.toThrow();
  });

  it("一个订阅者抛错不阻塞其余——错误隔离（先注册的抛，后注册的仍收到）", () => {
    const boom = vi.fn(() => {
      throw new Error("subscriber boom");
    });
    const after = vi.fn();
    const offBoom = fsEmitter.event(boom);
    const offAfter = fsEmitter.event(after);
    try {
      expect(() => fsEmitter.fire(EVENTS)).not.toThrow();
      expect(boom).toHaveBeenCalledTimes(1);
      expect(after).toHaveBeenCalledWith(EVENTS);
    } finally {
      offBoom();
      offAfter();
    }
  });

  it("空批照常派发——调用方按批推，空批也走同一条路（订阅者自己决定要不要刷新）", () => {
    const fn = vi.fn();
    const off = fsEmitter.event(fn);
    try {
      fsEmitter.fire([]);
      expect(fn).toHaveBeenCalledWith([]);
    } finally {
      off();
    }
  });
});
