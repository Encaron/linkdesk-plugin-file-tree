/**
 * 文件树状态版本——T-B「状态命令约定」（13-状态命令约定 §二）。
 *
 * `stateVersion` = 插件自定义的乐观并发版本（壳只透传）。口径（单一真相源，⛔ 各命令另算一套）：
 *   · **每次经本插件完成的树变更 +1**（rename / newFile / newFolder / delete / paste / 行内改名）；
 *   · 只覆盖「本插件命令」造成的变更——外部程序直接改盘不在内（那是硬事实，不是本插件的账）；
 *   · memory-only：池页面 reload 后归零。旧快照版本（如 5）遇到新进程（0）会判 ECONFLICT，
 *     AI 重新 `file-tree.refresh` 取新版本即可——宁可多一次自纠，也不让陈旧版本静默生效。
 *
 * 模块级 mutable 单一属主：本文件；跨文件只经下面三个 accessor。
 */
let _treeRevision = 0;

/** 当前状态版本（只读命令/写命令后置状态都取这一个数）。 */
export function treeStateVersion(): number {
  return _treeRevision;
}

/** 一次成功变更后推进版本，返回推进后的值（写命令后置状态用）。 */
export function bumpTreeStateVersion(): number {
  _treeRevision += 1;
  return _treeRevision;
}

/** 仅测试用：把版本复位（生产路径⛔ 调）。 */
export function _resetTreeStateVersionForTest(): void {
  _treeRevision = 0;
}
