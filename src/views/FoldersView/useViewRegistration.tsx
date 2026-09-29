/**
 * useViewRegistration——FOLDERS 动态标题 + SEARCH / 打开文件夹 视图注册（E6#87a 从 FoldersView.tsx 拆出）。
 *
 * E3.6 TB6：FOLDERS view 动态标题 = 工作区文件夹名。
 * E36#ROLE：role 字段保证始终 sectionViews——title 可安全为空，不再需要 " " 占位。
 * E4V#35：多根时标题走 workspace name。
 * E4V#56+P2：pinnedContent——sticky scroll 已移除（E4V#57 放弃）。
 *
 * ⚠️ 本 hook 里的运行时注册**不是**这两个 section 的唯一注册点：`plugin.json` 的
 * `contributes.views.explorer` 才是（加载器在插件装载时注册、与视图是否 mount 无关）。
 * 运行时这一笔只补两件声明面表达不了的事——① 标题的**译文**（`contributes.views[].title`
 * 是原样下发的，加载器不翻）；② FOLDERS 的**动态**标题与 header actions。
 * `registerView` 是 Object.assign 式更新（壳 ViewContainerService），声明面那份 desc 上的
 * `_renderPath`（池侧据此 import 视图包）不在本笔 descriptor 里 ⇒ 原样保留。
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import OpenFolderView from "../OpenFolderView";
import SearchView from "../SearchView";

const lk = window.linkdesk;

export function useViewRegistration() {
  const { t } = useTranslation();

  useEffect(() => {
    const updateTitle = async () => {
      const folders = await lk.workspace.getFolders();
      // E4V#35f: 单根→根名，多根→"工作区"（对标 VS Code WORKSPACE）
      const title = folders.length === 1 ? folders[0].name : (folders.length > 1 ? t("工作区") : "");
      // E5.7#98：getView 是 IPC invoke（异步）——补 await。定向前为 undefined 恒真（同步用异步 API），
      // render 恒 ()=>null；await 后 existing.render 仍随 IPC 序列化剥函数 → 兜底行为不变，仅类型诚实
      // E5.8#41.9.2：getView 复合寻址——(pluginId, viewId) 精确查（#41.8 §4 方案 A，IPC 链带 pluginId）
      const existing = await window.linkdesk?.viewContainer?.getView("file-tree", "folders");
      window.linkdesk?.viewContainer?.registerView("file-tree", "explorer", {
        id: "folders",
        title,
        render: existing?.render ?? (() => null),
        minHeight: 180,
        // E4V#20f: 工具栏迁移到 header actions——对标 VS Code ▶ FOLDERS [+][🔄][⊟]
        actions: (
          <>
            <button className="file-tree-toolbar-btn" data-hint={t("新建文件")} aria-label={t("新建文件")} onClick={() => lk.commands.executeCommand("file-tree.newFile")}>
              <span className="codicon codicon-new-file" />
            </button>
            <button className="file-tree-toolbar-btn" data-hint={t("新建文件夹")} aria-label={t("新建文件夹")} onClick={() => lk.commands.executeCommand("file-tree.newFolder")}>
              <span className="codicon codicon-new-folder" />
            </button>
            <button className="file-tree-toolbar-btn" data-hint={t("刷新")} aria-label={t("刷新")} onClick={() => lk.commands.executeCommand("file-tree.refresh")}>
              <span className="codicon codicon-refresh" />
            </button>
            <button className="file-tree-toolbar-btn" data-hint={t("收起全部")} aria-label={t("收起全部")} onClick={() => lk.commands.executeCommand("file-tree.collapseAll")}>
              <span className="codicon codicon-collapse-all" />
            </button>
          </>
        ),
      });
    };
    updateTitle();
    const unsub = lk.workspace.onDidChangeFolders(updateTitle);
    return unsub;
  }, [t]);

  /** E4V#37b: 注册 SEARCH view——和 FOLDERS 同容器，始终可见 */
  useEffect(() => {
    window.linkdesk?.viewContainer?.registerView("file-tree", "explorer", {
      id: "search",
      title: t("搜索"),
      order: 1,
      render: () => <SearchView />,
    });
  }, [t]);

  /** FT#1: 注册「打开文件夹」常驻 section——搜索下方 order 2，与欢迎页开关无关 */
  useEffect(() => {
    window.linkdesk?.viewContainer?.registerView("file-tree", "explorer", {
      id: "open-folder",
      title: t("打开文件夹"),
      order: 2,
      render: () => <OpenFolderView />,
    });
  }, [t]);
}
