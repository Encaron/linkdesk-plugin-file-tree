/**
 * emitter（FileTreeModel 的 MiniEmitter）——模型变更派发的唯一出口。E6#149 补测。
 *
 * 为什么单独立文件：`FileTreeModel.test.ts` 只从门面断言「setRoots / collapse 会 fire」两条，
 * 本模块自己的公开面（退订、错误隔离、派发中退订、dispose）**一条断言都没有**——改坏不红。
 * 错误隔离那条尤其要紧：它是源码里写明的设计（一个监听器崩溃不阻塞其他），而视图层订阅者众多。
 *
 * ⛔ 不动共享地基（`@linkdesk/plugin-sdk/vitest-setup`）；本文件零 DOM、零 IPC。
 */

import { describe, expect, it, vi } from "vitest";
import { MiniEmitter } from "../services/FileTreeModel/emitter";

describe("MiniEmitter", () => {
  it("event 订阅 + fire——每个监听器都收到同一份数据", () => {
    const em = new MiniEmitter<string>();
    const a = vi.fn();
    const b = vi.fn();
    em.event(a);
    em.event(b);

    em.fire("changed");

    expect(a).toHaveBeenCalledTimes(1);
    expect(a).toHaveBeenCalledWith("changed");
    expect(b).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledWith("changed");
  });

  it("退订函数摘掉自己——其余监听器不受影响", () => {
    const em = new MiniEmitter<number>();
    const a = vi.fn();
    const b = vi.fn();
    const offA = em.event(a);
    em.event(b);

    offA();
    em.fire(1);

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("fire 无监听器——静默不抛（模型在无人订阅时照常 fire）", () => {
    const em = new MiniEmitter<void>();
    expect(() => em.fire()).not.toThrow();
  });

  it("一个监听器抛错不阻塞其余——错误隔离（先注册的抛，后注册的仍收到）", () => {
    const em = new MiniEmitter<string>();
    const boom = vi.fn(() => {
      throw new Error("listener boom");
    });
    const after = vi.fn();
    em.event(boom);
    em.event(after);

    expect(() => em.fire("x")).not.toThrow();
    expect(boom).toHaveBeenCalledTimes(1);
    expect(after).toHaveBeenCalledWith("x");
  });

  it("错误隔离不粘——抛过错的监听器下次仍被调用（异常没把它从表里摘掉）", () => {
    const em = new MiniEmitter<string>();
    const boom = vi.fn(() => {
      throw new Error("boom");
    });
    em.event(boom);

    em.fire("a");
    em.fire("b");

    expect(boom).toHaveBeenCalledTimes(2);
  });

  it("派发中退订——尚未轮到的监听器本轮收不到（Set 迭代即时生效），且摘掉是持久的", () => {
    const em = new MiniEmitter<string>();
    const seen: string[] = [];
    let offB: (() => void) | undefined;
    em.event(() => {
      seen.push("a");
      offB?.(); // 第一个监听器在派发途中把第二个摘掉
    });
    offB = em.event(() => {
      seen.push("b");
    });

    em.fire("x");
    expect(seen).toEqual(["a"]); // b 未被本轮派发触达

    em.fire("y");
    expect(seen).toEqual(["a", "a"]); // 摘掉是持久的，不是本轮跳过
  });

  it("dispose 清空全部监听器——之后 fire 静默", () => {
    const em = new MiniEmitter<string>();
    const fn = vi.fn();
    em.event(fn);

    em.dispose();
    em.fire("x");

    expect(fn).not.toHaveBeenCalled();
  });
});
