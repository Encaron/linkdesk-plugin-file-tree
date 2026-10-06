/**
 * SearchToolbar——过滤输入 + 工具栏（替换开关 / 折叠全部 / 统计文案）（E6#87a 从 SearchView.tsx 拆出，逐字搬运）。
 */

import { InlineInput } from "@linkdesk/ui";
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
      {/* 过滤输入——共享件 InlineInput（判据 A：消费宿主声明的控件住共享件，⛔ 不自绘）。
          常驻过滤框的接线＝**受控回灌**：`onChange` 即时回灌父侧 ⇒ 必须配 `syncValue`，否则
          Esc → `onCancel` 清了父侧值、框里却留着已过滤的词（镜像 C5 卡内过滤框写法）。
          `onConfirm` 空实现——blur 那一下的值与 `onChange` 是同一笔，再确认一次无意义。 */}
      <div className="file-tree-search-filter-row">
        <InlineInput
          size="compact"
          value={include}
          onChange={setInclude}
          onConfirm={() => {}}
          onCancel={() => setInclude("")}
          syncValue
          ariaLabel={t("要包含的文件")}
          placeholder={t("要包含的文件")}
        />
        <InlineInput
          size="compact"
          value={exclude}
          onChange={setExclude}
          onConfirm={() => {}}
          onCancel={() => setExclude("")}
          syncValue
          ariaLabel={t("要排除的文件")}
          placeholder={t("要排除的文件")}
        />
      </div>

      {/* 工具栏：替换开关 + 折叠全部 */}
      <div className="file-tree-search-toolbar">
        <span className="file-tree-search-stats">{statsText}</span>
        <div className="file-tree-search-toolbar-actions">
          <button className="file-tree-search-option-btn" data-hint={t("替换")}
            onClick={() => setShowReplace((v) => !v)}>{t("替换")}</button>
          {state === "hasResults" && (
            <button className="file-tree-search-option-btn" data-hint={t("折叠全部")}
              onClick={() => setExpandedFiles(new Set())}>{t("折叠全部")}</button>
          )}
        </div>
      </div>
    </>
  );
}
