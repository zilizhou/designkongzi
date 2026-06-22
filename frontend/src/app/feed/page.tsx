"use client";

import { useEffect, useState } from "react";
import { addFavorite, getFeed } from "@/lib/api";
import type { FeedItem } from "@/lib/types";

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [err, setErr] = useState("");
  const [liked, setLiked] = useState<Record<number, boolean>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});
  const [toast, setToast] = useState("");

  useEffect(() => {
    getFeed("en", 20)
      .then(setItems)
      .catch(() => setErr("无法连接后端 (8000)。"));
  }, []);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1500);
  };

  const onLike = (i: number) => setLiked((s) => ({ ...s, [i]: !s[i] }));
  const onSave = async (i: number, it: FeedItem) => {
    if (saved[i]) return;
    setSaved((s) => ({ ...s, [i]: true }));
    try {
      await addFavorite("passage", it.ref_id, it.original_text);
      flash("已收藏到「我的」");
    } catch {
      setSaved((s) => ({ ...s, [i]: false }));
    }
  };
  const onShare = (it: FeedItem) => {
    navigator.clipboard?.writeText(`${it.original_text} —《${it.ref_label}》`);
    flash("已复制金句");
  };

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;

  return (
    <div className="relative mx-auto max-w-md">
      {toast && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-black/70 px-4 py-1.5 text-xs text-white">
          {toast}
        </div>
      )}
      <div className="h-[calc(100dvh-8rem)] snap-y snap-mandatory overflow-y-auto rounded-3xl">
        {items.map((it, i) => (
          <Card
            key={i}
            it={it}
            liked={!!liked[i]}
            saved={!!saved[i]}
            onLike={() => onLike(i)}
            onSave={() => onSave(i, it)}
            onShare={() => onShare(it)}
            onWallpaper={() => flash("壁纸生成中…（demo）")}
          />
        ))}
        {items.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-faint">
            加载中…
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  it,
  liked,
  saved,
  onLike,
  onSave,
  onShare,
  onWallpaper,
}: {
  it: FeedItem;
  liked: boolean;
  saved: boolean;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onWallpaper: () => void;
}) {
  return (
    <section className="relative flex h-full snap-start flex-col justify-center overflow-hidden bg-[#2C2C2A] px-7 text-center">
      {/* 氛围光斑 */}
      <div className="pointer-events-none absolute -right-12 -top-8 h-56 w-56 rounded-full bg-[#712B13] opacity-30 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 bottom-24 h-44 w-44 rounded-full bg-[#085041] opacity-30 blur-2xl" />

      {/* 原文大字 */}
      <p className="relative font-serif text-[28px] font-medium leading-[1.7] tracking-[0.18em] text-[#F5F0E6]">
        {it.original_text}
      </p>
      {it.translation && (
        <p className="relative mt-5 font-serif text-xs italic leading-relaxed text-[#D3D1C7]">
          {it.translation}
        </p>
      )}
      <span className="relative mx-auto mt-5 inline-block rounded-full bg-[#F5F0E6]/10 px-3 py-1 text-[11px] text-[#F5F0E6]">
        {it.ref_label}
      </span>

      {/* 署名 + 标签（左下） */}
      <div className="absolute bottom-7 left-6 right-20 text-left">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-[#F5F0E6]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#BA7517] font-serif text-[10px] text-[#412402]">
            {it.persona[0]}
          </span>
          {it.persona}
        </div>
        <div className="text-[11px] text-[#FAC775]">{it.tags.join("  ")}</div>
      </div>

      {/* 右侧动作栏 */}
      <div className="absolute bottom-7 right-4 flex flex-col items-center gap-5">
        <Action label="" onClick={onLike}>
          <span className={`text-2xl ${liked ? "scale-110" : ""}`}>
            {liked ? "❤️" : "🤍"}
          </span>
        </Action>
        <Action label="评论" onClick={() => {}}>💬</Action>
        <Action label="分享" onClick={onShare}>↗</Action>
        <Action label="壁纸" onClick={onWallpaper}>🖼</Action>
        <Action label={saved ? "已藏" : "收藏"} onClick={onSave}>
          <span className="text-xl">{saved ? "⭐" : "☆"}</span>
        </Action>
      </div>
    </section>
  );
}

function Action({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 text-[#F5F0E6]">
      <span className="text-xl leading-none">{children}</span>
      {label && <span className="text-[10px]">{label}</span>}
    </button>
  );
}
