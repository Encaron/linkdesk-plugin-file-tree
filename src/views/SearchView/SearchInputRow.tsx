/**
 * SearchInputRow——搜索框 + 历史下拉 + 三个选项按钮（E6#87a 从 SearchView.tsx 拆出）。
 *
 * 历史下拉改走共享 `OverlayPortal`（portal 进池侧 `#ld-float-layer`）：浮层「结构隔离地板」
 * 按 DOM 深度（`#ld-float-layer > * > [data-overlay-wrapper] > 表面`）给磨砂，自绘绝对定位
 * 的下拉拿不到——玻璃模式把 `--bg-card` 合成半透明后，背后内容直接透出（字叠字）。
 * 进层即与右键菜单／通知面板同一套材料，插件侧零私有磨砂配方。
 */

import { useCallback, useRef, useState } from "react";
import { OverlayPortal } from "@linkdesk/ui";
import type { TFunction } from "i18next";

/** fixed 浮层顶边下限——窗口顶部 30px 是 -webkit-app-region:drag 拖拽区（硬约束 18） */
const DRAG_REGION_TOP = 30;

export interface SearchInputRowProps {
  inputRef: React.RefObject<HTMLInputElement>;
  query: string;
  setQuery: (q: string) => void;
  searchHistory: string[];
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  caseSensitive: boolean;
  setCaseSensitive: React.Dispatch<React.SetStateAction<boolean>>;
  wholeWord: boolean;
  setWholeWord: React.Dispatch<React.SetStateAction<boolean>>;
  useRegex: boolean;
  setUseRegex: React.Dispatch<React.SetStateAction<boolean>>;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  t: TFunction;
}

export function SearchInputRow({
  inputRef,
  query,
  setQuery,
  searchHistory,
  showHistory,
  setShowHistory,
  caseSensitive,
  setCaseSensitive,
  wholeWord,
  setWholeWord,
  useRegex,
  setUseRegex,
  handleKeyDown,
  t,
}: SearchInputRowProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  /** 下拉锚点——表面进浮层后脱离本行（不再是行内 absolute），故跟字段壳的视口矩形走 fixed 定位。
   *  只在聚焦时算：开着的时候任何行外 mousedown 都会先关掉它，锚点不可能中途过期。 */
  const [historyAnchor, setHistoryAnchor] = useState({ top: 0, left: 0, width: 0 });

  const openHistory = useCallback(() => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (rect) {
      setHistoryAnchor({
        top: Math.max(DRAG_REGION_TOP, rect.bottom + 4),
        left: rect.left,
        width: rect.width,
      });
    }
    setShowHistory(true);
  }, [setShowHistory]);

  return (
    <div className="file-tree-search-input-row">
      <div className="file-tree-search-field" ref={fieldRef}>
        <input
          ref={inputRef}
          className="file-tree-search-input"
          type="text"
          placeholder={t("搜索")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={openHistory}
          onBlur={() => requestAnimationFrame(() => setShowHistory(false))}
        />
        <div className="file-tree-search-input-actions">
          <button className={`file-tree-search-option-btn ${caseSensitive ? "file-tree-search-option-btn--active" : ""}`}
            data-hint={t("区分大小写")} onClick={() => setCaseSensitive((v) => !v)}>Aa</button>
          <button className={`file-tree-search-option-btn ${wholeWord ? "file-tree-search-option-btn--active" : ""}`}
            data-hint={t("全词匹配")} onClick={() => setWholeWord((v) => !v)}>ab</button>
          <button className={`file-tree-search-option-btn ${useRegex ? "file-tree-search-option-btn--active" : ""}`}
            data-hint={t("正则表达式")} onClick={() => setUseRegex((v) => !v)}>.*</button>
        </div>
      </div>
      {showHistory && searchHistory.length > 0 && !query && (
        <OverlayPortal onClose={() => setShowHistory(false)} triggerRef={fieldRef}>
          <div className="file-tree-search-history" style={historyAnchor}>
            {searchHistory.map((h, i) => (
              <div key={i} className="file-tree-search-history-item" onMouseDown={() => { setQuery(h); setShowHistory(false); }}>
                <span className="codicon codicon-history" />
                <span>{h}</span>
              </div>
            ))}
          </div>
        </OverlayPortal>
      )}
    </div>
  );
}
