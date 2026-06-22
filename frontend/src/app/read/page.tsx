"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { addFavorite, getBooks, getChapters, getPassage, getPassages } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type { Book, Chapter, Passage, PassageBrief } from "@/lib/types";

type Layer = "original" | "pinyin" | "translation" | "annotation";
const LAYER_LABELS: [Layer, string][] = [
  ["original", "原文"],
  ["pinyin", "拼音"],
  ["translation", "译文"],
  ["annotation", "释义"],
];

export default function ReadPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [passages, setPassages] = useState<PassageBrief[]>([]);
  const [activeId, setActiveId] = useState("");
  const [passage, setPassage] = useState<Passage | null>(null);
  const [loading, setLoading] = useState(false);
  const [lang] = useLang();
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    original: true,
    pinyin: true,
    translation: true,
    annotation: true,
  });
  const [err, setErr] = useState("");
  const [faved, setFaved] = useState(false);

  useEffect(() => {
    getBooks()
      .then((bs) => {
        setBooks(bs);
        if (bs[0]) setBookId(bs[0].id);
      })
      .catch(() => setErr("无法连接后端，请先启动 uvicorn (8000)。"));
  }, []);

  useEffect(() => {
    if (!bookId) return;
    getChapters(bookId).then((cs) => {
      setChapters(cs);
      if (cs[0]) setChapterId(cs[0].id);
    });
  }, [bookId]);

  useEffect(() => {
    if (!chapterId) return;
    getPassages(chapterId).then((ps) => {
      setPassages(ps);
      if (ps[0]) setActiveId(ps[0].id);
    });
  }, [chapterId]);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true);
    setFaved(false);
    getPassage(activeId, lang)
      .then(setPassage)
      .finally(() => setLoading(false));
  }, [activeId, lang]);

  const doFav = async () => {
    if (!passage || faved) return;
    setFaved(true);
    try {
      await addFavorite("passage", passage.id, passage.original_text);
    } catch {
      setFaved(false);
    }
  };

  const toggle = (l: Layer) => setLayers((s) => ({ ...s, [l]: !s[l] }));
  const translation =
    passage?.translations.find((t) => t.lang === lang) ??
    passage?.translations.find((t) => t.lang === "en");

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;

  return (
    <div className="grid gap-4 md:grid-cols-[220px_1fr]">
      {/* 左栏 */}
      <aside className="space-y-3">
        <div className="flex gap-2">
          <select
            value={bookId}
            onChange={(e) => setBookId(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.title_zh}</option>
            ))}
          </select>
          <select
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg"
          >
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>{c.title_zh}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:max-h-[60vh] md:flex-col md:overflow-y-auto">
          {passages.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`block w-full shrink-0 truncate rounded-lg px-3 py-2 text-left font-serif text-sm md:shrink ${
                p.id === activeId
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-surface-2"
              }`}
            >
              {p.original_text}
            </button>
          ))}
        </div>
      </aside>

      {/* 右栏 */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
          <span className="text-xs text-faint">
            译文跟随顶部语言：{lang.toUpperCase()}
          </span>
          <span className="mx-1 h-4 w-px bg-line" />
          <div className="flex flex-wrap gap-1">
            {LAYER_LABELS.map(([l, label]) => (
              <button
                key={l}
                onClick={() => toggle(l)}
                className={`rounded-full px-2.5 py-1 text-xs ${
                  layers[l] ? "bg-accent-soft text-accent" : "bg-surface-2 text-faint"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading || !passage ? (
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-6">
            <div className="skeleton h-3 w-24" />
            <div className="skeleton h-8 w-full" />
            <div className="skeleton h-8 w-5/6" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-16 w-full" />
          </div>
        ) : (
          <article className="rounded-2xl border border-line bg-surface p-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs text-faint">{passage.ref_label}</span>
              <button
                onClick={doFav}
                className={`rounded-full px-3 py-1 text-xs ${
                  faved ? "bg-accent-soft text-accent" : "border border-line text-muted hover:bg-surface-2"
                }`}
              >
                {faved ? "★ 已收藏" : "☆ 收藏"}
              </button>
            </div>

            {layers.original && (
              <p className="font-serif text-2xl leading-loose tracking-wide text-fg">
                {passage.original_text}
              </p>
            )}
            {layers.pinyin && passage.pinyin && (
              <p className="mt-2 text-sm italic text-faint">{passage.pinyin}</p>
            )}
            {layers.translation && translation && (
              <p className="mt-4 text-sm leading-relaxed text-muted">{translation.text}</p>
            )}

            {layers.annotation && passage.annotations.length > 0 && (
              <div className="mt-5 space-y-2">
                {passage.annotations.map((a, i) => (
                  <div key={i} className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
                    <span className="mr-2 text-xs text-accent">
                      {a.source || (a.type === "classical" ? "传统注疏" : "释义")}
                    </span>
                    {a.content}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 rounded-lg border-l-[3px] border-cel bg-cel-soft p-3">
              <div className="mb-1 text-xs text-cel-ink">AI 解读</div>
              <p className="text-sm text-cel-ink/80">
                AI 解读由智能体运行时生成（区别于权威注释）。
              </p>
              <Link
                href={`/chat?q=${encodeURIComponent(`请解读：${passage.original_text}`)}`}
                className="mt-2 inline-block text-sm text-accent hover:underline"
              >
                问问子曰君 →
              </Link>
            </div>

            {passage.concepts.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {passage.concepts.map((c) => (
                  <span key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-faint">
                    #{c}
                  </span>
                ))}
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
}
