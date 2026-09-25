/**
 * shared——命令组的共用件（E6#87a：438 行 commands.ts 二次拆分）。
 *
 * 只放被两个以上命令组用到的东西；单组私有件留在各自文件里。
 */
import i18n from "i18next";
import type { FileTreeModel } from "../../../services/FileTreeModel";
import { notifyFailure, errText, nameOf } from "../../../services/FileTreeNotify";

/** 菜单传入的 command args */
export interface FileMenuContext {
  uri: string;
  isDirectory: boolean;
}

/** 尚未实现的命令占位 handler */
export const placeholder = (id: string) => async () => {
  console.warn(`[file-tree] 命令 "${id}" 尚未实现`);
};

/**
 * E6#73m K2：刷新目录——`getChildren` 读磁盘，目录刚被移走 / 权限没了都会抛。
 * 老写法 `.catch(console.error)` 对用户等于没有（池渲染进程零全局拒绝兜底）。
 * 统一走 FileTreeNotify 那一个出口，措辞与 FileTreeDnD 的 refreshDirSafe 一致。
 *
 * E6#149 补测读数修正：原先 `model.refresh(dir)` **没有 await**，紧接着又按「缓存里没有子项」
 * 补了一次 `getChildren` ⇒ 同一个目录被**并发读两遍盘**（refresh → reloadItem 已把 `children`
 * 清 null 并起了一次读盘，补的这次看见 `children === null` 又起一次），两份结果写同一个字段、
 * 还多 fire 一轮变更事件。`refresh` 对**已展开**目录本来就会重读子项并触发变更
 * （`refreshTree` 判的 `expanded.has(uri)` ≡ `isExpanded(uri)`，同一个集合），折叠目录又不需要子项
 * ⇒ 那次补读是纯重复劳动，已删。⚠️ 别再加回来：它不是「保险」，是让同一目录读两遍的那个 bug。
 * `await` 顺带让失败（含 refresh 内部抛出的拒绝）真的落进下面的 catch，而不是变成无人接的拒绝。
 */
export async function refreshDirSafe(model: FileTreeModel, dir: string): Promise<void> {
  try {
    await model.refresh(dir);
  } catch (e) {
    notifyFailure(i18n.t("刷新"), [{ name: nameOf(dir), detail: errText(e) }]);
  }
}
