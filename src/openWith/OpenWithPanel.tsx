/**
 * OpenWithPanel——「打开方式…」选择器面板（F1，T2 第 3 波 · 权威图 mockups/05）。
 *
 * 户口 = **file-tree 私有视图件**（06-组件户口与组合纪律：组合是既定模式非权宜）——
 * 共享件只到原子：`OverlayPortal`（浮起来：层级/裁剪/Esc）、`PluginIcon`（行图标四源裁决）、
 * `Badge`（当前默认标记）；行布局与双动作按钮 = 唯一的新代码。
 * ⛔ 不借 `ldk-` 宿主保留类名（硬约束 23）——自有类名一律 `file-tree-openwith-` 前缀。
 *
 * 数据面（判定归壳、呈现归插件）：`lk.fileAssociation.listHandlersFor(ext)` 只读面现读；
 * 覆盖表现值经 `configuration.get` 现读（渲染前现读 ⇒ E31 双向同步的「读侧」半）。
 * 旧壳特性降级（07 §六）：宿主无 `listHandlersFor` ⇒ 命令入口 no-op（见 navigation.ts），
 * 本组件挂载了也查不到数据 ⇒ 渲染空态即关——两路都不留「点了就报错」的面。
 */
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Badge, OverlayPortal, PluginIcon } from "@linkdesk/ui";
import i18n from "i18next";
import {
  closeOpenWithPicker,
  getOpenWithPickerState,
  subscribeOpenWithPicker,
  type OpenWithRequest,
} from "./openWithStore";
import "./open-with.css";

const lk = () => window.linkdesk;

/** 市场插件 id——空态「在市场搜索阅读器」揭示其侧栏容器（与 editor 提示块同一路径） */
const MARKETPLACE_PLUGIN_ID = "marketplace";

interface HandlerRow {
  pluginId: string;
  displayName: string;
  isCurrent: boolean;
}

/** 图标 manifest 子集（PluginIcon 四源裁决所需）——listAll 全量 manifest 里挑；形状对齐 @linkdesk/ui 契约 */
type ManifestIconShape = { icon?: string; iconSource?: "svg" | "codicon" | "url" | "lucide" };

/** 覆盖表形状守卫——非 object / 值非 string 一律按未覆盖 */
function readOverrideTable(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v) out[k.toLowerCase()] = v;
  }
  return out;
}

export const OpenWithPanelHost: React.FC = () => {
  const state = useSyncExternalStore(subscribeOpenWithPicker, getOpenWithPickerState, getOpenWithPickerState);
  if (!state) return null;
  return <OpenWithPanel request={state} />;
};

const OpenWithPanel: React.FC<{ request: OpenWithRequest }> = ({ request }) => {
  const [handlers, setHandlers] = useState<HandlerRow[] | null>(null); // null = 加载中
  const [override, setOverride] = useState<Record<string, string>>({});
  const [icons, setIcons] = useState<Record<string, ManifestIconShape | undefined>>({});

  const hasFace = typeof lk().fileAssociation?.listHandlersFor === "function";

  /** 现读三件：handler 清单 / 覆盖表 / 图标 manifest——每次动作后整体重读（E31 渲染前现读） */
  const refresh = useCallback(async (req: OpenWithRequest) => {
    if (!hasFace) {
      setHandlers([]);
      return;
    }
    try {
      const rows = (await lk().fileAssociation.listHandlersFor(req.ext)) as HandlerRow[];
      setHandlers(rows ?? []);
    } catch {
      setHandlers([]); // 契约面在但调用失败——按无 handler 收敛（面板空态），不留报错面
    }
    try {
      const raw = await lk().configuration?.get("workbench.fileAssociations");
      setOverride(readOverrideTable(raw));
    } catch {
      setOverride({});
    }
    try {
      const all = await lk().plugins?.listAll?.();
      if (all) {
        const map: Record<string, ManifestIconShape | undefined> = {};
        for (const e of all) map[e.pluginId] = e.manifest as ManifestIconShape | undefined;
        setIcons(map);
      }
    } catch { /* 图标缺席 = PluginIcon 自兜底，不拦面板 */ }
  }, [hasFace]);

  useEffect(() => {
    void refresh(request);
  }, [request, refresh]);

  const close = useCallback(() => closeOpenWithPicker(), []);

  /** 打开（仅此一次）——直接建标签，不落盘 */
  const openOnce = useCallback(
    (pluginId: string) => {
      close();
      lk().tabs?.create(pluginId, {
        filePath: request.uri,
        sourceId: request.uri,
        label: request.name,
        pinned: true,
      });
    },
    [close, request],
  );

  /** 设为默认——写覆盖表（唯一写口 fileAssociation.setDefault），写完现读刷新（E31） */
  const setDefault = useCallback(
    async (pluginId: string) => {
      try {
        await lk().fileAssociation?.setDefault?.(request.ext, pluginId);
      } catch { /* 旧壳无写面：按钮点了无效果即降级（菜单项已按面收敛） */ }
      await refresh(request);
    },
    [request, refresh],
  );

  /** 恢复自动——删覆盖表该键（pluginId = null），回声明序 */
  const restoreAuto = useCallback(async () => {
    try {
      await lk().fileAssociation?.setDefault?.(request.ext, null);
    } catch { /* 同上 */ }
    await refresh(request);
  }, [request, refresh]);

  const searchMarket = useCallback(() => {
    close();
    lk().events?.emit("icon:selected", MARKETPLACE_PLUGIN_ID);
  }, [close]);

  /** 覆盖命中（用户指定过）⇒ 顶部「当前默认」行可见；isCurrent 随解析现算（含失效覆盖跳过，E6） */
  const overrideKey = useMemo(() => `.${request.ext.toLowerCase()}`, [request.ext]);
  const hasOverride = !!(override[overrideKey] ?? override[request.ext.toLowerCase()]);

  /** 面板定位：右键锚点就近弹出（钳制硬约束 18 拖拽区 + 视口边缘），非右键入口居中 */
  const pos = useMemo(() => {
    if (!request.anchor) return undefined;
    const left = Math.min(request.anchor.x, window.innerWidth - 460);
    const top = Math.max(30, Math.min(request.anchor.y, window.innerHeight - 320));
    return { left, top };
  }, [request.anchor]);

  if (!hasFace) return null; // 旧壳：不留面（命令入口已同步降级）

  return (
    <OverlayPortal onClose={close} trapFocus zIndex="3000" rootId="context-menu-root">
      <div className="file-tree-openwith" style={pos ? { position: "fixed", ...pos } : undefined} role="dialog" aria-label={i18n.t("打开方式")}>
        <div className="file-tree-openwith-head">
          <div>
            <div className="file-tree-openwith-title">{i18n.t("打开方式")}</div>
            <div className="file-tree-openwith-file">
              {request.name}（.{request.ext}）
            </div>
          </div>
          <button type="button" className="file-tree-openwith-x" onClick={close} aria-label={i18n.t("关闭")}>
            ✕
          </button>
        </div>
        {hasOverride && (
          <div className="file-tree-openwith-cur">
            <span>
              {i18n.t("当前默认：{{name}}（来自你的设置）", {
                name: handlers?.find((h) => h.isCurrent)?.displayName ?? "—",
              })}
            </span>
            <button type="button" onClick={restoreAuto}>{i18n.t("恢复自动")}</button>
          </div>
        )}
        <div className="file-tree-openwith-list">
          {handlers === null ? (
            <div className="file-tree-openwith-empty">{i18n.t("加载中…")}</div>
          ) : handlers.length === 0 ? (
            <div className="file-tree-openwith-empty">
              {i18n.t("没有任何已装插件声明 .{{ext}}", { ext: request.ext })}
              <div>
                <button type="button" onClick={searchMarket}>{i18n.t("在市场搜索阅读器")}</button>
              </div>
            </div>
          ) : (
            handlers.map((h) => (
              <div className="file-tree-openwith-row" key={h.pluginId}>
                <PluginIcon pluginId={h.pluginId} manifest={icons[h.pluginId]} className="file-tree-openwith-ic" />
                <div className="file-tree-openwith-names">
                  <div className="file-tree-openwith-nm">
                    {h.displayName}
                    {h.isCurrent && (
                      <Badge title={hasOverride ? i18n.t("用户指定") : undefined}>
                        {hasOverride ? i18n.t("默认") : i18n.t("自动默认")}
                      </Badge>
                    )}
                  </div>
                  <div className="file-tree-openwith-pid">{h.pluginId}</div>
                </div>
                <div className="file-tree-openwith-acts">
                  <button type="button" onClick={() => openOnce(h.pluginId)}>
                    {i18n.t("打开（仅此一次）")}
                  </button>
                  <button
                    type="button"
                    className={h.isCurrent && hasOverride ? "file-tree-openwith-def" : undefined}
                    onClick={() => setDefault(h.pluginId)}
                  >
                    {i18n.t("设为默认")}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </OverlayPortal>
  );
};
