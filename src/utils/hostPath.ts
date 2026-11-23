/**
 * 宿主路径 API 的唯一转入口（2026-11-24 F1 / K7）。
 *
 * 为什么有本文件：本仓过去自写 `basename`/`dirname`/`joinPath`/`extname`（旧 `pathUtils.ts:28-72`），
 * 与壳 `window.linkdesk.path.*`（`electron/preload-pool/namespaces-data.ts` `buildPath`）是两份实现——
 * 壳归一化 `\`→`/`、对 `.gitignore` 这类点开头文件的 extname 规则，自写版迟早漂移。
 *
 * 纪律：本文件每个函数体**只有一次宿主调用**（零 split/pop/正则实现）；行为唯一源 = 宿主。
 * ⛔ 不在别处再定义同类函数；新路径工具先看宿主有没有。
 */

const p = () => window.linkdesk.path;

/** 归一化路径——统一 `/` 分隔（壳实现） */
export function normalizePath(x: string): string {
  return p().normalize(x);
}

/** 路径最后一段（文件名/文件夹名）——壳实现 */
export function basename(x: string): string {
  return p().basename(x);
}

/** 父目录——壳实现 */
export function dirname(x: string): string {
  return p().dirname(x);
}

/** 拼接路径（`/` 分隔）——壳实现 */
export function joinPath(parent: string, name: string): string {
  return p().join(parent, name);
}

/** 扩展名（不含点）——壳 extname 去点；`.gitignore` → "" */
export function extension(name: string): string {
  return p().extname(name).replace(/^\./, "");
}

/** 扩展名（含点）——壳 extname 原样；无扩展名 → "" */
export function extensionWithDot(name: string): string {
  return p().extname(name);
}
