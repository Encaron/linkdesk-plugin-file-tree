/**
 * Menu——文件树右键菜单消费组件本体。
 *
 * 对标 VS Code：右键之前先选中（sidebar.tsx 在调用前处理）。
 * ContextMenu 内部从 MenuRegistry 读取 "FileContext" 的菜单项，
 * 通过 ContextKeyService 求值 when 条件。
 */
import React, { useEffect } from "react";
import { ContextMenu } from "@linkdesk/ui"; // E6#54c：共享控件走 @linkdesk/ui
import type { ExplorerItem } from "../../services/FileTreeModel";

interface FileTreeContextMenuProps {
  /** 右键的目标节点——null = 空白处右键（仅新建） */
  item: ExplorerItem | null;
  /** 菜单锚点（clientX/clientY） */
  anchor: { x: number; y: number };
  /** 关闭回调 */
  onClose: () => void;
}

const FileTreeContextMenu: React.FC<FileTreeContextMenuProps> = ({ item, anchor, onClose }) => {
  // E4V#12: 瞬态 context key——菜单渲染前注入，关闭时清除
  useEffect(() => {
    const lk = window.linkdesk;
    lk?.contextKey?.set("file-tree.itemIsFile", item?.isDirectory === false);
    lk?.contextKey?.set("file-tree.itemIsDir", item?.isDirectory === true);
    lk?.contextKey?.set("file-tree.itemIsRoot", item?.parent === null);
    lk?.contextKey?.set("file-tree.resourceReadonly", item?.isReadonly === true);
    return () => {
      lk?.contextKey?.set("file-tree.itemIsFile", false);
      lk?.contextKey?.set("file-tree.itemIsDir", false);
      lk?.contextKey?.set("file-tree.itemIsRoot", false);
      lk?.contextKey?.set("file-tree.resourceReadonly", false);
    };
  }, [item]);

  // 传给命令的上下文（handler 通过 args[0] 接收）
  // when 条件优先读此上下文——菜单渲染不等 IPC 异步的 contextKey.set
  // ⚠️ 旗子名带 `.` ⇒ 作对象键**必须加引号**（裸标识符位写 `file-tree.x` 是语法错误）。
  //    context 经 ContextMenu 以 `Record<string, unknown>` 按字符串键读取 ⇒ 加引号零语义变化。
  const context = item ? {
    uri: item.uri,
    isDirectory: item.isDirectory,
    "file-tree.itemIsFile": item.isDirectory === false,
    "file-tree.itemIsDir": item.isDirectory === true,
    "file-tree.itemIsRoot": item.parent === null,
    "file-tree.resourceReadonly": item.isReadonly === true,
  } : undefined;

  return (
    <ContextMenu
      menuId={"FileContext"}
      anchor={anchor}
      context={context}
      onClose={onClose}
    />
  );
};

export default FileTreeContextMenu;
