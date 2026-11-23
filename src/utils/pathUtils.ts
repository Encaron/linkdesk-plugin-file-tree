/**
 * 文件树的结构类型与纯结构拆分（2026-11-24 F1 后只剩这些）。
 *
 * 🔴 路径函数（basename / dirname / joinPath / extname / normalize）已全部迁到
 *    `./hostPath.ts`（唯一转入口 → 壳 `window.linkdesk.path.*`）。
 *    本文件⛔ 不得再出现同类实现——壳是行为唯一源（`\` 归一、点开头文件 extname 等规则一处定）。
 */

import type { ExplorerItem } from "../services/FileTreeModel";

/* ── 类型 ── */

/** 扁平化后的树节点——虚拟滚动消费 */
export interface FlatItem {
  item: ExplorerItem;
  depth: number;
  /** 紧凑文件夹——压缩后的路径段，如 ["src", "components", "Button.tsx"] */
  compactedSegments?: string[];
  /** E4V#16: 本层还有后续兄弟——CSS 引导线 */
  guide?: boolean;
  /** E4V#16: 被排除但保留显示的条目灰显 */
  isDimmed?: boolean;
}

/* ── 纯结构拆分（非宿主语义：只按分隔符切段）── */

/** 拆分路径为段 */
export function splitPath(fullPath: string): string[] {
  return fullPath.split(/[/\\]/).filter(Boolean);
}
