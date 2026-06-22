"use client";

import { getApiBase } from "@/lib/apiBase";

import { useEffect, useState } from "react";
import { listPlugins } from "@/lib/api";
import type { PluginItem } from "@/lib/types";


const TYPE_COLORS: Record<string, string> = {
  embed: "#0F6E56",
  share: "#993C1D",
  bot: "#534AB7",
  tool: "#854F0B",
  feed: "#1E5F8E",
};

export default function PluginsPage() {
  const [items, setItems] = useState<PluginItem[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    listPlugins().then((r) => setItems(r.items)).catch(() => {});
  }, []);

  const copy = (id: string, snippet: string) => {
    navigator.clipboard?.writeText(snippet);
    setCopied(id);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="text-xs tracking-widest text-accent">插件与轻应用 · Plugins</div>
        <h1 className="mt-1 font-serif text-xl text-fg">
          {items.length} 个嵌入方式 · 一键集成到你的场景
        </h1>
        <p className="mt-1 text-xs text-muted">
          申报书目标③：开发并上线不少于 10 个社交媒体插件与轻应用。
          所有插件复用同一平台后端，5 语支持，可追溯出处。
        </p>
      </section>

      {/* 现场预览：iframe + SVG */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">现场预览</div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1 text-[10px] text-faint">iframe（嵌入金句卡）</div>
            <iframe
              src={`${getApiBase()}/api/v1/embed/quote?ref=lunyu.yanyuan.12.2&lang=en`}
              className="h-44 w-full rounded-lg border border-line"
            />
          </div>
          <div>
            <div className="mb-1 text-[10px] text-faint">SVG 海报卡（1200×630）</div>
            <img
              src={`${getApiBase()}/api/v1/embed/card.svg?ref=lunyu.liren.4.16&lang=en`}
              alt="quote card"
              className="h-44 w-full rounded-lg border border-line bg-paper object-contain"
            />
          </div>
        </div>
      </section>

      {/* 插件清单 */}
      <section className="grid gap-3 md:grid-cols-2">
        {items.map((p) => (
          <div key={p.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-start gap-2">
              <span
                className="rounded-full px-2 py-0.5 text-[10px] text-white"
                style={{ background: TYPE_COLORS[p.type] ?? "#888" }}
              >
                {p.type}
              </span>
              <div className="flex-1">
                <div className="font-serif text-base text-fg">{p.name}</div>
                <div className="mt-0.5 text-xs text-faint">{p.summary}</div>
              </div>
            </div>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-surface-2/50 p-2.5 text-[11px] leading-relaxed text-muted">
                {p.snippet}
              </pre>
              <button
                onClick={() => copy(p.id, p.snippet)}
                className="absolute right-1 top-1 rounded bg-surface px-2 py-0.5 text-[10px] text-faint shadow hover:bg-accent hover:text-white"
              >
                {copied === p.id ? "已复制" : "复制"}
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
