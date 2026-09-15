/**
 * SearchToolbar——过滤输入 + 工具栏（替换开关 / 折叠全部 / 统计文案）（E6#87a 从 SearchView.tsx 拆出，逐字搬运）。
 */

import type { TFunction } from "i18next";
import type { SearchState } from "./useSearch";

export interface SearchToolbarProps {
  include: string;
  setInclude: (v: string) => void;
  exclude: string;
  setExclude: (v: string) => void;
  statsText: string;
  setShowReplace: React.Dispatch<React.SetStateAction<boolean>>;
  state: SearchState;
  setExpandedFiles: React.Dispatch<React.SetStateAction<Set<string>>>;
  t: TFunction;
}

export function SearchToolbar({
  include,
  setInclude,
  exclude,
  setExclude,
  statsText,
  setShowReplace,
  state,
  setExpandedFiles,
  t,
}: SearchToolbarProps) {
  return (
    <>
      {/* 过滤输入 */}
      <div className="file-tree-search-filter-row">
        <input
          className="file-tree-search-filter-input"
          type="text"
          placeholder={t("要包含的文件")}
          value={include}
          onChange={(e) => setInclude(e.target.value)}
        />
        <input
          className="file-tree-search-filter-input"
          type="text"
          placeholder={t("要排除的文件")}
          value={exclude}
          onChange={(e) => setExclude(e.target.value)}
        />
      </div>

      {/* 工具栏：替换开关 + 折叠全部 */}
      <div className="file-tree-search-toolbar">
        <span className="file-tree-search-stats">{statsText}</span>
        <div className="file-tree-search-toolbar-actions">
          <button className="file-tree-search-option-btn" title={t("替换")}
            onClick={() => setShowReplace((v) => !v)}>{t("替换")}</button>
          {state === "hasResults" && (
            <button className="file-tree-search-option-btn" title={t("折叠全部")}
              onClick={() => setExpandedFiles(new Set())}>{t("折叠全部")}</button>
          )}
        </div>
      </div>
    </>
  );
}
