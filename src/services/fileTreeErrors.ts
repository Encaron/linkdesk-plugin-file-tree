/**
 * file-tree 命令错误的**返回式信封**（T-B / S2-T14 跨桥口径）。
 *
 * 跨 contextBridge 的 `throw` 只保留 message，`code/hint/details` 会丢（池侧只能归 EUNKNOWN）
 * ⇒ 预期内业务失败一律 **`return fileTreeError(...)`**，形状与串口仓的 `serialError` 同源：
 * `{ isPluginError: true, code, message, hint?, details? }`（普通对象，⛔ Error 实例）。
 *
 * 码表只收本插件语义；壳保留码（EVIEWREQUIRED / ENOTACTIVE / EUNKNOWNCOMMAND / EOPEXPIRED /
 * EPOLICYDENIED / EPROTECTED / EUSERDENIED / ESHELLTIMEOUT / EUNKNOWN）⛔ 不得重定义。
 */
import { pluginError } from "@linkdesk/plugin-sdk/runtime";

export const FILETREE_ERROR_CODES = {
  /** 参数非法（uri/newName/expectedVersion 形状不对） */
  EBADARGS: "EBADARGS",
  /** 目标已存在（rename 不覆盖） */
  EEXIST: "EEXIST",
  /** 宿主文件系统操作失败（占用/权限/不存在等，具体原因在 message） */
  EFS: "EFS",
  /** 乐观并发冲突：expectedVersion ≠ 当前 stateVersion（details.stateVersion = 当前值） */
  ECONFLICT: "ECONFLICT",
  /** 需要 file-tree 视图才能执行（无参行内改名）；无视图时如实报，⛔ 空动作冒充成功 */
  ENOVIEW: "ENOVIEW",
} as const;

export type FileTreeErrorCode = (typeof FILETREE_ERROR_CODES)[keyof typeof FILETREE_ERROR_CODES];

export interface FileTreeCommandError {
  readonly isPluginError: true;
  readonly code: FileTreeErrorCode;
  readonly message: string;
  readonly hint?: string;
  readonly details?: Record<string, unknown>;
}

/** 构造返回式错误——调用点 `return fileTreeError(...)`（⛔ throw：异常跨桥丢码）。 */
export function fileTreeError(
  code: FileTreeErrorCode,
  message: string,
  hint?: string,
  details?: Record<string, unknown>,
): FileTreeCommandError {
  const validated = pluginError({ code, message, hint, details });
  return {
    isPluginError: true,
    code: validated.code as FileTreeErrorCode,
    message: validated.message,
    ...(validated.hint !== undefined ? { hint: validated.hint } : {}),
    ...(validated.details !== undefined ? { details: validated.details } : {}),
  };
}
