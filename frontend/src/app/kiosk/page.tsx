"use client";

import { useEffect, useRef, useState } from "react";
import { getFeed } from "@/lib/api";
import { track } from "@/lib/track";
import type { FeedItem } from "@/lib/types";

const AUTO_MS = 8000;

export default function KioskPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [campus, setCampus] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 从 query 读取校园（埋点 + 显示）
  useEffect(() => {
    const url = new URLSearchParams(window.location.search);
    const c = url.get("campus");
    setCampus(c);
    track("/kiosk", { device: "kiosk", source: "qr", campus: c || undefined });
    getFeed("en", 30).then(setItems).catch(() => {});
  }, []);

  // 自动轮播
  useEffect(() => {
    if (paused || items.length === 0) return;
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, AUTO_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, items.length]);

  const cur = items[idx];

  if (!cur)
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/50">
        Loading…
      </div>
    );

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      onClick={() => setPaused((p) => !p)}
    >
      {/* 氛围光斑 */}
      <div className="pointer-events-none absolute -right-20 -top-24 h-[60vh] w-[60vh] rounded-full bg-[#712B13] opacity-25 blur-[80px]" />
      <div className="pointer-events-none absolute -left-20 bottom-12 h-[40vh] w-[40vh] rounded-full bg-[#085041] opacity-30 blur-[80px]" />

      {/* 校园 / 平台标 */}
      <div className="absolute left-8 top-6 flex items-center gap-3">
        <span className="seal flex h-9 w-9 items-center justify-center rounded-md text-xl">孔</span>
        <div className="font-serif text-base">
          {campus ? `${campus} · 儒家语义平台` : "孔子 · 儒家语义平台"}
        </div>
      </div>

      <div className="absolute right-8 top-6 flex items-center gap-3 text-xs text-white/60">
        <span>{idx + 1} / {items.length}</span>
        <span className="rounded-full bg-white/10 px-2 py-0.5">
          {paused ? "已暂停 · 点击继续" : "自动轮播 · 点击暂停"}
        </span>
      </div>

      {/* 主要内容 */}
      <div className="flex h-full flex-col items-center justify-center px-12">
        <p className="text-center font-serif text-[64px] leading-[1.5] tracking-[0.2em] text-[#F5F0E6]">
          {cur.original_text}
        </p>
        {cur.translation && (
          <p className="mt-10 max-w-[64ch] text-center font-serif text-lg italic leading-relaxed text-[#D3D1C7]">
            {cur.translation}
          </p>
        )}
        <span className="mt-10 inline-block rounded-full bg-white/10 px-5 py-2 text-sm text-[#F5F0E6]">
          {cur.ref_label}
        </span>
      </div>

      {/* 署名 + 标签 */}
      <div className="absolute bottom-8 left-8 right-8 flex items-end justify-between text-[#F5F0E6]">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#BA7517] font-serif text-xs text-[#412402]">
              {cur.persona[0]}
            </span>
            {cur.persona}
          </div>
          <div className="text-xs text-[#FAC775]">{cur.tags.join("   ")}</div>
        </div>
        <div className="text-right text-xs text-white/50">
          kongzi.platform · 扫码继续阅读
        </div>
      </div>

      {/* 进度条 */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
        <div
          className="h-full bg-[#FAC775] transition-all"
          style={{ width: paused ? "100%" : `${((idx + 1) / items.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
