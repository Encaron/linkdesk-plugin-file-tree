/**
 * useRecentFolders——最近打开过的文件夹（**只读消费**）。
 *
 * ── 数据从哪来（2026-11-24 F2 后）──
 * 属主是**壳**（`app` 命名空间，唯一写点 = 欢迎页 `WelcomePoolView.tsx`）。
 * 本插件⛔ 不再跨属主直读 `pluginState("app","recentFolders")`——宿主改键名/结构会静默断链。
 * 读取面 = `workspace.getRecentFolders()`（主进程按 `src/core/services/recentFolders` 的规则
 * 归一化：防御历史裸字符串形态、去重、截到显示上限）；变更 = `onDidChangeRecentFolders`。
 *
 * 本插件**只读、不写回**——两个写方各写一份必然互相覆盖，且本插件没有欢迎页那份
 * 「当前会话看过哪些」的上下文。
 */

import { useEffect, useState } from "react";

export interface RecentFolder {
  path: string;
  name: string;
}

export function useRecentFolders(): RecentFolder[] {
  const [recent, setRecent] = useState<RecentFolder[]>([]);

  useEffect(() => {
    let cancelled = false;
    const ws = window.linkdesk.workspace;
    ws.getRecentFolders()
      .then((folders) => {
        if (!cancelled) setRecent(folders);
      })
      .catch(() => {
        // 读不到就当作「没有最近项」——本区是增强，不该因它把 section 打成错误态
        if (!cancelled) setRecent([]);
      });
    const unsub = ws.onDidChangeRecentFolders((folders) => {
      if (!cancelled) setRecent(folders);
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return recent;
}
