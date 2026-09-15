/**
 * SearchResults——结果列表（文件分组 + 匹配行）（E6#87a 从 SearchView.tsx 拆出，逐字搬运）。
 */

import type { SearchWireResult, SearchWireMatch } from "@linkdesk/contracts";

export interface SearchResultsProps {
  results: SearchWireResult;
  expandedFiles: Set<string>;
  toggleFile: (filePath: string) => void;
  handleOpenMatch: (match: SearchWireMatch) => void;
}

export function SearchResults({ results, expandedFiles, toggleFile, handleOpenMatch }: SearchResultsProps) {
  return (
    <div className="file-tree-search-results">
      {results.map((file) => (
        <div key={file.filePath} className="file-tree-search-file">
          <div className="file-tree-search-file-header" onClick={() => toggleFile(file.filePath)}>
            <span className={`codicon ${expandedFiles.has(file.filePath) ? "codicon-chevron-down" : "codicon-chevron-right"} file-tree-search-file-chevron`} />
            <span className="codicon codicon-file file-tree-search-file-icon" />
            <span className="file-tree-search-file-name">{file.filePath.split("/").pop()}</span>
            <span className="file-tree-search-file-path">{file.filePath}</span>
            <span className="file-tree-search-file-count">{file.matches.length}</span>
          </div>
          {expandedFiles.has(file.filePath) && (
            <div className="file-tree-search-matches">
              {file.matches.map((m, i) => (
                <div key={i} className="file-tree-search-match" onDoubleClick={() => handleOpenMatch(m)}>
                  <span className="file-tree-search-match-line">{m.lineNumber}</span>
                  <span className="file-tree-search-match-text">{m.lineText}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
