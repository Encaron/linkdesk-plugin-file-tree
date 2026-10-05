/**
 * openWithStore——「打开方式…」选择器的模块级单例状态（F1，T2 第 3 波）。
 *
 * 为什么是模块级 mutable 单一属主：命令 handler（navigation.ts，模块级注册）与视图组件
 * （FoldersView 挂载的 OpenWithPanelHost）分居两处——照 host-bridge.ts 同款纪律，
 * 全仓只在本文件写 `_state`，跨文件读走 accessor（⛔ 别处再写一份）。
 *
 * 弹出/收起归 file-tree 本地 state（右键交互的 owner 是文件树，壳不弹这个窗——01 §T2 组件落格）；
 * 浮层地基用共享 OverlayPortal（层级/裁剪/Esc 现成），本 store 只管「开不开、给谁开」。
 */

/** 选择器打开请求——anchor 为 null = 非右键入口（命令面板），面板居中 */
export interface OpenWithRequest {
  uri: string;
  name: string;
  /** 归一化前的扩展名（可能带点/大写）——查询侧 listHandlersFor 自行归一 */
  ext: string;
  anchor: { x: number; y: number } | null;
}

let _state: OpenWithRequest | null = null;
const _subs = new Set<() => void>();

function emit(): void {
  for (const cb of _subs) cb();
}

/** 打开选择器（幂等：同请求重复打开只刷新内容） */
export function openOpenWithPicker(req: OpenWithRequest): void {
  _state = { ...req };
  emit();
}

export function closeOpenWithPicker(): void {
  if (!_state) return;
  _state = null;
  emit();
}

/** 订阅开关（useSyncExternalStore 用）——快照引用只在开/关时变化 */
export function subscribeOpenWithPicker(cb: () => void): () => void {
  _subs.add(cb);
  return () => {
    _subs.delete(cb);
  };
}

export function getOpenWithPickerState(): OpenWithRequest | null {
  return _state;
}
