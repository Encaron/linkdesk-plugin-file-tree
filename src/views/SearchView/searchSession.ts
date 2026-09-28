/**
 * searchSession——本次搜索的**模块级快照**（M2 `AI#24`）。
 *
 * ## 为什么要有这份快照
 *
 * 搜索结果本体住在 `useSearch` 的 React state 里——视图不在场时，命令 handler（非 React 上下文）
 * 拿不到「当前高亮的是哪一条」。而「打开搜索结果」这件事的目标恰恰就是**那一条**：
 * 界面上双击 `.file-tree-search-match` 才够得着（`SearchResults.tsx:29`）。
 * ⇒ 搜索执行/导航变化时把 `(matches, index)` 记进本模块，命令 handler 读它解析目标。
 *
 * ## 口径
 *
 * - **只读不改**：本快照不是第二真相源，是**视图态的一次投影**；唯一写点是 `useSearch` 的 effect。
 * - **纯逻辑**：本文件不碰 `window.linkdesk`（好让解析规则能直接单测），开标签页那一步在
 *   `searchCommands.ts` 里走 `openMatch`（与双击**同一个函数**）。
 * - 视图卸载 ⇒ 搜索结果面没了 ⇒ `resetSearchSession()`，命令如实回「没有搜索结果」，
 *   ⛔ 不给一个界面上早已不存在的陈旧目标。
 */

import type { SearchWireMatch } from "@linkdesk/contracts";

export interface SearchSession {
  /** 展平后的全部匹配（与 F4 导航消费的同一份顺序） */
  matches: SearchWireMatch[];
  /** 当前高亮索引（`-1` = 还没导航过） */
  index: number;
}

let _session: SearchSession = { matches: [], index: -1 };

/** 视图侧唯一写点——搜索完成/导航变化时投影进来 */
export function recordSearchSession(matches: SearchWireMatch[], index: number): void {
  _session = { matches, index };
}

/** 视图卸载时清空——理由见文件头注（不给陈旧目标） */
export function resetSearchSession(): void {
  _session = { matches: [], index: -1 };
}

export function getSearchSession(): SearchSession {
  return _session;
}

export interface OpenSearchResultArgs {
  /** 目标文件（工作区相对路径，`/` 分隔）——缺省 = 当前高亮那条 */
  filePath?: string;
  /** 目标行号——与 filePath 一起用时精确定位某一条匹配 */
  lineNumber?: number;
}

/** 路径比较——两侧都把 `\` 归一成 `/` 再比（搜索结果来自壳，Windows 上可能带反斜杠） */
function samePath(a: string, b: string): boolean {
  return a.replace(/\\/g, "/") === b.replace(/\\/g, "/");
}

/**
 * 解析要打开的那条匹配——纯函数，四种情形：
 *   ① 给了 filePath ＋ lineNumber ⇒ 精确命中那一条（搜不到返回 null，不猜近似）
 *   ② 只给 filePath ⇒ 该文件的**第一条**匹配
 *   ③ 什么都不给 ⇒ 当前高亮那条（`index` 越界时退到第一条）
 *   ④ 没有搜索结果 ⇒ null（调用方据此如实报错）
 */
export function resolveSearchMatch(args?: OpenSearchResultArgs): { match: SearchWireMatch; index: number } | null {
  const { matches, index } = _session;
  if (matches.length === 0) return null;

  if (args?.filePath) {
    const hit = matches.findIndex(
      (m) => samePath(m.filePath, args.filePath!)
        && (args.lineNumber === undefined || m.lineNumber === args.lineNumber),
    );
    return hit < 0 ? null : { match: matches[hit], index: hit };
  }

  const i = index >= 0 && index < matches.length ? index : 0;
  return { match: matches[i], index: i };
}
