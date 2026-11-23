/**
 * useTreeConfig——文件树的四项外部配置订阅（E6#87a 从 FileTree.tsx 拆出）。
 *
 * 订阅生命周期留在 React effect 里（硬约束 19），模块级只留一次性缓存：
 *   - `iconTheme:changed` → 重建 resolver + 触发节点重渲染
 *   - 活跃工作区（E4V#35e 根节点 accent 色）
 *   - `file-tree.compactFolders` → 写 flatten 缓存 + rerender
 *   - 宿主 CSS token `--ui-scale` → 行高（2026-11-24 F3：不再读 app.uiFontScale 配置键）
 *   - `file-tree.expandOnClick` → 点击目录行是否 toggle
 */
import { useEffect, useState } from "react";
import { getScaledTreeItemHeight, setUiFontScale } from "../../utils/layoutTokens";
import { loadCompactFolders, setCompactFolders } from "./flatten";
import { updateIconResolver } from "../../services/fileIconRuntime"; // E6#69g：解析器已上移共享，本文件只持插件实例态
import type { IconThemeMappings } from "@linkdesk/contracts";

const lk = window.linkdesk;

/**
 * 2026-11-24（F3）：行高比例只吃宿主 CSS 度量 token `--ui-scale`（`:root`，壳 commitTokens 写）。
 * ⛔ 不再读 `app.uiFontScale` 配置键（那是宿主外观语义；插件读键 = 换宿主键名就静默断）。
 * 虚拟滚动需要数值 → 从计算样式读 token；token 缺失/坏值 = 1（100%）。
 */
function readUiScalePercent(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--ui-scale");
  const scale = Number.parseFloat(raw);
  return Number.isFinite(scale) && scale > 0 ? Math.round(scale * 100) : 100;
}

/** 把当前 token 写入 layoutTokens 缓存（与 CSS calc(26px*var(--ui-scale)) 同一乘子） */
function applyUiScale(): void {
  setUiFontScale(readUiScalePercent());
}

export function useTreeConfig(rerender: () => void) {
  /** E4V#35e: 活跃工作区——根节点 accent 色加粗 */
  const [activeWorkspaceUri, setActiveWorkspaceUri] = useState<string>("");
  /** E5.8#133.3: 图标主题 id——仅作 FileTreeNode memo 重渲染触发器（图标现取 getIconResolver） */
  const [iconThemeId, setIconThemeId] = useState("default");
  // E5.8#133.3: 图标主题订阅——切换 → 重建 resolver + 刷新节点。启动时 preload 缓存回放
  // （iconTheme:changed extraHandler + events.on 回放）→ 挂载即拿到重启前选择，非 default 图标集恢复。
  useEffect(() => {
    return lk.events.on("iconTheme:changed", (payload: { iconThemeId: string; mappings?: IconThemeMappings }) => {
      updateIconResolver(payload.mappings);
      setIconThemeId(payload.iconThemeId);
    });
  }, []);
  useEffect(() => { lk.workspace.getActive().then((v: string | undefined) => { if (v) setActiveWorkspaceUri(v); }); }, []);
  useEffect(() => {
    return lk.workspace.onDidChangeActiveWorkspace((uri: string | null) => { setActiveWorkspaceUri(uri ?? ""); rerender(); });
  }, [rerender]);

  // E4V#34b: 加载 file-tree.compactFolders 配置并订阅变更
  useEffect(() => {
    loadCompactFolders().then(rerender);
    return lk.configuration.onChange("file-tree.compactFolders", (v: boolean) => {
      setCompactFolders(v ?? true);
      rerender();
    });
  }, [rerender]); // rerender 稳定（useCallback []）——零重跑，满足规则

  // E5.8 Phase 12 #172: 行高运行时桥——app.uiFontScale 变化 → 缓存 + state 更新 → 虚拟滚动按新行高重算
  const [itemHeight, setItemHeight] = useState(getScaledTreeItemHeight);
  useEffect(() => {
    // 初始：读宿主 token；变更：宿主题/字号提交后广播 theme:changed（payload.variables 含 --ui-scale）
    applyUiScale();
    setItemHeight(getScaledTreeItemHeight());
    return lk.events.on("theme:changed", () => {
      applyUiScale();
      setItemHeight(getScaledTreeItemHeight());
    });
  }, []);

  /** E5: 点击目录行是否 toggle 展开/折叠——默认 false，仅 twistie 管展开折叠 */
  const [expandOnClick, setExpandOnClick] = useState(false);
  useEffect(() => {
    const cfg = window.linkdesk?.configuration;
    if (!cfg) return;
    cfg.get("file-tree.expandOnClick").then((v: unknown) => setExpandOnClick(Boolean(v)));
    return cfg.onChange("file-tree.expandOnClick", (v: unknown) => setExpandOnClick(Boolean(v)));
  }, []);

  return { activeWorkspaceUri, iconThemeId, itemHeight, expandOnClick };
}
