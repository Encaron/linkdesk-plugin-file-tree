/**
 * openMatch——双击/F4 打开匹配行所在文件（E6#87a 从 SearchView.tsx 拆出，逐字搬运）。
 */

import type { SearchWireMatch } from "@linkdesk/contracts";
import { basename, extension } from "../../utils/pathUtils";

const lk = window.linkdesk;

export async function openMatch(match: SearchWireMatch): Promise<void> {
  // ⚠️ extension() 只吃**文件名**——整条路径喂进去，点了目录名的路径（/tmp/v1.2/Makefile）
  // 会算出「2/Makefile」这种假扩展名（搜索匹配行是完整路径 ⇒ 必须先取 basename）。
  const ext = extension(basename(match.filePath));
  // 兜底链修复（2026-10-07）：不再对空扩展名静默 return——无后缀 / 点开头文件也照走宿主解析，
  // resolveOpenTarget("") 直落角色兜底（旧写法让搜索入口对这类文件是「点了没反应」的死点）。
  const pluginId = await lk.fileAssociation.getPluginFor(ext);
  if (!pluginId) return;
  window.linkdesk?.tabs?.create(pluginId, {
    filePath: match.filePath,
    label: match.filePath.split("/").pop() ?? match.filePath,
    pinned: true,
  });
}
