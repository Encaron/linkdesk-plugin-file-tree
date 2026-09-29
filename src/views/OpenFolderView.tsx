/**
 * OpenFolderView——侧栏 explorer 容器里的常驻 section「打开文件夹」（门面）。
 *
 * ── 为什么有它 ──
 * 打开文件夹的**唯一 UI 入口**原本只在欢迎页（`WelcomePoolView` 的「文件夹」区）。欢迎页是
 * 可关闭的标签页保底 ⇒ 关掉它、或把文件树目录清空之后，全软件再没有一处 UI 能打开文件夹。
 * 本 section 常驻在 explorer 容器内（FOLDERS 0 / SEARCH 1 / 本件 2），与欢迎页开关无关。
 * 立项与竞标见壳仓 `docs/05-插件更新/文件树/01-打开文件夹入口-设计.md`（A 版定稿）。
 *
 * 🔴 `contributes.views[].render = "src/views/OpenFolderView.tsx"`——basename 是 SDK bundle key，
 * 门面必须留在本路径本文件名。子件在同名夹 `OpenFolderView/`：
 *   - `useRecentFolders.ts`   最近文件夹（只读消费 `pluginState("app","recentFolders")`）
 *
 * 🔴 红线（bug-atlas §D3 / E4V#44 死锁教训，本文件存在的全部理由）：
 *   ① 本组件**永不卸载**——订阅（本件目前只有 pluginState.onChange）只挂这类常驻组件；
 *   ② 空态/有根态只允许「组件内部条件渲染」，⛔ 绝不做「外部替换整个组件」
 *      （`registerViewEmptyContent` 形态：FoldersView 当年被整替换 ⇒ 订阅被 cleanup ⇒
 *      `addFolder` 广播无人听 ⇒ 永久死锁）。
 *
 * ── 打开动作走命令，不直连 API ──
 * 主按钮打 `file-tree.openFolder`（handler = `workspace.openFolder()`）。与文件菜单、命令面板
 * 走**同一条链**，不写第二份逻辑；`data-hint` 也就能带出该命令的快捷键。
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRecentFolders } from "./OpenFolderView/useRecentFolders";
import "../styles/OpenFolderView.css";

const lk = window.linkdesk;

const OpenFolderView: React.FC = () => {
  const { t } = useTranslation();
  const recent = useRecentFolders();

  const handleOpenFolder = useCallback(() => {
    lk.commands.executeCommand("file-tree.openFolder");
  }, []);

  const handleOpenRecent = useCallback((folderPath: string) => {
    // 添加语义（不是替换）——与欢迎页最近列表、目录对话框同一个 `addFolder`
    lk.workspace.addFolder(folderPath);
  }, []);

  return (
    <div className="file-tree-open-folder">
      <button className="file-tree-open-folder-btn" onClick={handleOpenFolder}>
        <span className="codicon codicon-folder-opened" />
        {t("打开文件夹…")}
      </button>

      {/* 没有最近项时整块不渲染——不留空标题、不留空白块 */}
      {recent.length > 0 && (
        <div className="file-tree-open-folder-recent">
          <div className="file-tree-open-folder-recent-label">{t("最近")}</div>
          {recent.map((folder) => (
            <button
              key={folder.path}
              className="file-tree-open-folder-recent-item"
              data-hint={folder.path}
              data-hint-delay="0"
              onClick={() => handleOpenRecent(folder.path)}
            >
              <span className="codicon codicon-root-folder file-tree-open-folder-recent-icon" />
              <span className="file-tree-open-folder-recent-name">{folder.name}</span>
              <span className="file-tree-open-folder-recent-path">{folder.path}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default OpenFolderView;
