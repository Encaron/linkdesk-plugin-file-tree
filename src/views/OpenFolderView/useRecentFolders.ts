/**
 * useRecentFolders——最近打开过的文件夹（**只读消费**）。
 *
 * ── 数据从哪来 ──
 * 属主是**欢迎页**：壳侧 `src/pool/views/welcome/WelcomePoolView.tsx` 在
 * `workspace.onDidChangeFolders` 里把新根 unshift 进 `pluginState("app", "recentFolders")`
 * （形如 `{ path, name }[]`，上限 10）。本插件**只读、不写回**——两个写方各写一份必然
 * 互相覆盖，且本插件没有欢迎页那份「当前会话看过哪些」的上下文。
 * ⚠️ 跨命名空间读（`app` ← `file-tree`）是既有用法，不是本补丁新开的口子：
 * `pluginState:get` 当前**无属主校验**（`src/core/services/plugins/IpcBridgeHandler/data.ts`）。
 * 代价如实记账：欢迎页标签页没开着时，那份列表就停在上次写入的内容（无人写入 ≠ 数据错）。
 *
 * ── 为什么订阅 onChange 而不是 onDidChangeFolders ──
 * `onDidChangeFolders` 是**广播在前、落盘在后**（欢迎页的监听器要 await getFolders 再 await set），
 * 本侧若在同一条广播里重读，读到的多半是**上一版**——差一次事件才能追上，表现为「刚打开的目录
 * 不在最近里」。`pluginState.onChange("app","recentFolders")` 的回调直接**带新值**
 * （`plugin-state:changed` 载荷），既没有这一拍的错位，也不用再猜谁先谁后。
 */

import { useCallback, useEffect, useState } from "react";
import { basename } from "../../utils/pathUtils";

/** 数据属主插件 id——欢迎页写在 `app` 命名空间下 */
const OWNER_PLUGIN_ID = "app";
const RECENT_KEY = "recentFolders";
/** 侧栏最多列几条——与欢迎页的展示口径一致（存 10 条，两边各显示前 5 条） */
const MAX_VISIBLE = 5;

export interface RecentFolder {
  path: string;
  name: string;
}

/**
 * 收窄成 `{ path, name }[]`。
 * 防御读的理由：`recentFolders` 在历史版本里存过**裸字符串数组**（插件侧 WelcomeView 时期），
 * 用户机器上可能还留着那种形态；脏条目在这里挡掉，不往 UI 上漏半条空行。
 */
function pickRecent(raw: unknown): RecentFolder[] {
  if (!Array.isArray(raw)) return [];
  const out: RecentFolder[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const obj = entry as Partial<RecentFolder> | null;
    const path = typeof obj?.path === "string" ? obj.path : "";
    if (!path || seen.has(path)) continue;
    seen.add(path);
    out.push({ path, name: typeof obj?.name === "string" && obj.name ? obj.name : basename(path) });
    if (out.length >= MAX_VISIBLE) break;
  }
  return out;
}

export function useRecentFolders(): RecentFolder[] {
  const [recent, setRecent] = useState<RecentFolder[]>([]);

  const reload = useCallback(async () => {
    try {
      const raw = await window.linkdesk?.pluginState?.get(OWNER_PLUGIN_ID, RECENT_KEY);
      setRecent(pickRecent(raw));
    } catch {
      // 读不到就当作「没有最近项」——本区是增强，不该因它把 section 打成错误态
      setRecent([]);
    }
  }, []);

  useEffect(() => {
    void reload();
    const unsub = window.linkdesk?.pluginState?.onChange?.(OWNER_PLUGIN_ID, RECENT_KEY, (value) => {
      setRecent(pickRecent(value));
    });
    return unsub;
  }, [reload]);

  return recent;
}
