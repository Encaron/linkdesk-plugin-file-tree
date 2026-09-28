/**
 * searchCommands——搜索面板动作的命令化（M2 `AI#24`）。
 *
 * ## 补的是哪条唯一鼠标路径
 *
 * `SearchResults.tsx:29`：匹配行 `onDoubleClick={() => handleOpenMatch(m)}` —— 打开一条搜索结果
 * **只有双击**（F4 那条键盘路要先让搜索框拿到焦点，且不是命令 ⇒ AI / 快捷键 / 命令面板都够不着）。
 *
 * ## 为什么注册在这里而不是视图里
 *
 * 命令 handler 要能**无视图**执行（AI 经 `exec` 打进来时，池的 on-command 激活会 import 本插件入口
 * ⇒ 入口顶层的副作用就是唯一注册时机）。故本函数由 `src/index.tsx` 入口顶层调用，
 * 目标从 `searchSession` 的模块级快照解析（见该文件头注）。
 *
 * ⛔ 打开文件那一步走 `openMatch`——**与双击同一个函数**，不许另写一条 `tabs.create`
 *   （那就成了第二份实现，扩展名→属主插件那套映射迟早分叉）。
 *
 * ⚠️ 注册**不带 meta**——本仓惯例：`title` / `description` / `params` 一律只写在 `plugin.json`
 *   的 `contributes.commands[]`（壳加载器会把说明与参数注册进命令索引；池侧不带这两项时不会抹掉
 *   声明面那份）。⛔ 别在这里补 meta，两份文案迟早分叉。
 */

import { openMatch } from "./openMatch";
import {
  getSearchSession, resolveSearchMatch, type OpenSearchResultArgs,
} from "./searchSession";

/**
 * 注册搜索命令。入口顶层调用一次（模块缓存 ⇒ 每次页面加载只跑一次）；
 * 重入只是再顶一遍同名 handler/meta，无副作用。
 * @returns 注册成功的条数（0 = `window.linkdesk.commands` 不可用）
 */
export function registerSearchCommands(): number {
  const reg = window.linkdesk?.commands?.registerCommand;
  if (!reg) return 0;

  reg(
    "file-tree.openSearchResult",
    async (args?: OpenSearchResultArgs) => {
      const target = resolveSearchMatch(args);
      if (!target) {
        const total = getSearchSession().matches.length;
        throw new Error(
          total === 0
            ? "没有搜索结果——先在搜索面板搜一次，或给 filePath 指定要打开的文件"
            : `搜索结果里没有匹配 ${args?.filePath}${args?.lineNumber === undefined ? "" : `:${args.lineNumber}`}`,
        );
      }
      // 与双击同一条路：扩展名 → 属主插件 → 开标签页
      await openMatch(target.match);
      return {
        opened: true,
        filePath: target.match.filePath,
        lineNumber: target.match.lineNumber,
        index: target.index,
        total: getSearchSession().matches.length,
      };
    },
  );

  return 1;
}
