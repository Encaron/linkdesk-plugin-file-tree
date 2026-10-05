/**
 * Menu——文件树右键菜单消费组件本体。
 *
 * 对标 VS Code：右键之前先选中（sidebar.tsx 在调用前处理）。
 * ContextMenu 内部从 MenuRegistry 读取 `fileContext` 槽位的菜单项（条目本身 2026-09-29 起由
 * `plugin.json` 的声明式 `contributes.menus.fileContext` 注册——槽位 id 是**壳 MENU_SLOTS 的值**，
 * 小驼峰；旧写法 `"FileContext"` 是枚举成员名，读写同一个错键只是自洽、不是正确），
 * 通过 ContextKeyService 求值 when 条件。
 */
import React, { useEffect, useState } from "react";
import { ContextMenu } from "@linkdesk/ui"; // E6#54c：共享控件走 @linkdesk/ui
import type { ExplorerItem } from "../../services/FileTreeModel";
import { extensionWithDot } from "../../utils/pathUtils";

interface FileTreeContextMenuProps {
  /** 右键的目标节点——null = 空白处右键（仅新建） */
  item: ExplorerItem | null;
  /** 菜单锚点（clientX/clientY） */
  anchor: { x: number; y: number };
  /** 关闭回调 */
  onClose: () => void;
}

const FileTreeContextMenu: React.FC<FileTreeContextMenuProps> = ({ item, anchor, onClose }) => {
  // 文件打开方式与贡献点 T3（F2）：**宿主公开约定面**两键——写权限归 file-tree（宿主账
  // `contextKeysPublic` 登记），读的人是**任意第三方插件的菜单 `when`**。
  // 🔴 无文件上下文（空白处右键 / 根节点）⇒ **两键都未定义**，⛔ 不是空串：
  //    `resourceExtname == ""` 会被 `when` 判成「有一个空扩展名」——02 E12 点名的那类误报。
  const resourceIsFile = item && item.parent !== null ? item.isDirectory === false : undefined;
  const resourceExtname =
    item && item.parent !== null && !item.isDirectory
      ? extensionWithDot(item.name).toLowerCase() || undefined // 无扩展名/点开头 ⇒ undefined
      : undefined;

  // F1（T2 · 第 3 波）E13：「打开方式…」在无 handler 时隐藏——右键时刻现读一次 handler 数。
  // undefined = 未定（IPC 未回）/旧壳缺面/无扩展名 ⇒ `when` 判假、项隐藏（降级口径 = 不显示该项）。
  const [hasHandler, setHasHandler] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    if (!resourceExtname || typeof window.linkdesk?.fileAssociation?.listHandlersFor !== "function") {
      setHasHandler(undefined);
      return;
    }
    let cancelled = false;
    window.linkdesk.fileAssociation
      .listHandlersFor(resourceExtname)
      .then((rows: unknown) => {
        if (!cancelled) setHasHandler(Array.isArray(rows) && rows.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasHandler(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [resourceExtname, item]);

  // E4V#12: 瞬态 context key——菜单渲染前注入，关闭时清除
  useEffect(() => {
    const lk = window.linkdesk;
    lk?.contextKey?.set("file-tree.itemIsFile", item?.isDirectory === false);
    lk?.contextKey?.set("file-tree.itemIsDir", item?.isDirectory === true);
    lk?.contextKey?.set("file-tree.itemIsRoot", item?.parent === null);
    lk?.contextKey?.set("file-tree.resourceReadonly", item?.isReadonly === true);
    lk?.contextKey?.set("resourceExtname", resourceExtname);
    lk?.contextKey?.set("resourceIsFile", resourceIsFile);
    return () => {
      lk?.contextKey?.set("file-tree.itemIsFile", false);
      lk?.contextKey?.set("file-tree.itemIsDir", false);
      lk?.contextKey?.set("file-tree.itemIsRoot", false);
      lk?.contextKey?.set("file-tree.resourceReadonly", false);
      lk?.contextKey?.set("resourceExtname", undefined);
      lk?.contextKey?.set("resourceIsFile", undefined);
    };
  }, [item, resourceExtname, resourceIsFile]);

  // 传给命令的上下文（handler 通过 args[0] 接收）
  // when 条件优先读此上下文——菜单渲染不等 IPC 异步的 contextKey.set
  // ⚠️ 旗子名带 `.` ⇒ 作对象键**必须加引号**（裸标识符位写 `file-tree.x` 是语法错误）。
  //    context 经 ContextMenu 以 `Record<string, unknown>` 按字符串键读取 ⇒ 加引号零语义变化。
  // ⚠️ 公共两键**无条件带上**（值可以是 undefined）：`_readKey` 用 `key in overrides` 判优先，
  //    键缺席才回落全局 `_state`——缺席会把上一次右键的扩展名读回来（串味）。
  const context = item ? {
    uri: item.uri,
    isDirectory: item.isDirectory,
    "file-tree.itemIsFile": item.isDirectory === false,
    "file-tree.itemIsDir": item.isDirectory === true,
    "file-tree.itemIsRoot": item.parent === null,
    "file-tree.resourceReadonly": item.isReadonly === true,
    resourceExtname,
    resourceIsFile,
    // F1（T2 · 第 3 波）E13/E12：无 handler 时「打开方式…」不可达——`when` 收敛旗子。
    // 现读（右键时刻查 listHandlersFor，命中即现）；undefined = 未定/旧壳 ⇒ 项隐藏（降级口径）。
    "file-tree.hasHandler": hasHandler,
    // 选择器面板锚点（命令 handler 经 args[0].anchor 接收）——右键就近弹出
    anchor,
  } : undefined;

  return (
    <ContextMenu
      menuId={"fileContext"}
      anchor={anchor}
      context={context}
      onClose={onClose}
    />
  );
};

export default FileTreeContextMenu;
