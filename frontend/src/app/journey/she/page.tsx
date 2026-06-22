"use client";

import dynamic from "next/dynamic";

// 3D 部分关闭 SSR — React Three Fiber 在 SSR 阶段会尝试 import three，可能在
// 标准化输出（standalone）中失败。整个游戏组件用 dynamic({ ssr: false }) 加载。
const She3DGame = dynamic(() => import("./She3DGame"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-line bg-surface p-12 text-center">
      <div className="font-serif text-lg text-fg">射场准备中…</div>
      <div className="mt-2 text-xs text-faint">正在加载 3D 场景与弓箭</div>
    </div>
  ),
});

export default function ShePage() {
  return <She3DGame />;
}
