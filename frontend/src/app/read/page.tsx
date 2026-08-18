"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import MockMark from "@/components/qiewen/MockMark";
import { getBooks, getChapters, getPassage, getPassages } from "@/lib/api";
import { getMockPassage, MOCK_PASSAGES } from "@/lib/qiewen/mock";
import { useLang } from "@/lib/i18n";
import type { Book, Chapter, Passage, PassageBrief } from "@/lib/types";

type Layer = "original" | "pinyin" | "translation" | "annotation";

interface ViewPassage {
  id: string;
  ref_label: string;
  original_text: string;
  pinyin?: string;
  translation?: string;
  annotations: { source: string; content: string }[];
  concepts: string[];
  mocked: boolean;
}

function fromApi(p: Passage, lang: string): ViewPassage {
  const tr =
    p.translations.find((t) => t.lang === lang) ??
    p.translations.find((t) => t.lang === "en");
  return {
    id: p.id,
    ref_label: p.ref_label ?? p.id,
    original_text: p.original_text,
    pinyin: p.pinyin ?? undefined,
    translation: tr?.text,
    annotations: p.annotations.map((a) => ({
      source: a.source || (a.type === "classical" ? "传统注疏" : "释义"),
      content: a.content,
    })),
    concepts: p.concepts,
    mocked: false,
  };
}

function ReadInner() {
  const params = useSearchParams();
  const ref = params.get("ref") ?? "";
  const [lang] = useLang();
  const [books, setBooks] = useState<Book[]>([]);
  const [bookId, setBookId] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [chapterId, setChapterId] = useState("");
  const [passages, setPassages] = useState<PassageBrief[]>([]);
  const [activeId, setActiveId] = useState(ref);
  const [view, setView] = useState<ViewPassage | null>(null);
  const [mocked, setMocked] = useState(false);
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    original: true,
    pinyin: true,
    translation: true,
    annotation: true,
  });

  useEffect(() => {
    getBooks()
      .then((bs) => {
        setBooks(bs);
        if (bs[0]) setBookId(bs[0].id);
      })
      .catch(() => setMocked(true));
  }, []);

  useEffect(() => {
    if (!bookId || mocked) return;
    getChapters(bookId).then((cs) => {
      setChapters(cs);
      if (cs[0]) setChapterId(cs[0].id);
    });
  }, [bookId, mocked]);

  useEffect(() => {
    if (!chapterId || mocked) return;
    getPassages(chapterId).then((ps) => {
      setPassages(ps);
      if (!ref && ps[0]) setActiveId(ps[0].id);
    });
  }, [chapterId, mocked, ref]);

  useEffect(() => {
    const id = activeId || ref || Object.keys(MOCK_PASSAGES)[0];
    if (!id) return;
    if (mocked) {
      const m = getMockPassage(id) ?? Object.values(MOCK_PASSAGES)[0];
      setView({
        id: m.id,
        ref_label: m.ref_label,
        original_text: m.original_text,
        pinyin: m.pinyin,
        translation: m.translation_en,
        annotations: m.annotations,
        concepts: m.concepts,
        mocked: true,
      });
      return;
    }
    getPassage(id, lang)
      .then((p) => setView(fromApi(p, lang)))
      .catch(() => {
        setMocked(true);
        const m = getMockPassage(id) ?? Object.values(MOCK_PASSAGES)[0];
        setView({
          id: m.id,
          ref_label: m.ref_label,
          original_text: m.original_text,
          pinyin: m.pinyin,
          translation: m.translation_en,
          annotations: m.annotations,
          concepts: m.concepts,
          mocked: true,
        });
      });
  }, [activeId, ref, lang, mocked]);

  const list = mocked
    ? Object.values(MOCK_PASSAGES).map((p) => ({ id: p.id, original_text: p.original_text }))
    : passages;

  return (
    <div className="grid gap-5 md:grid-cols-[240px_1fr]">
      <aside className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-[11px] tracking-[0.32em] text-accent">典</p>
          {mocked && <MockMark />}
        </div>
        {!mocked && (
          <div className="flex gap-2">
            <select
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>{b.title_zh}</option>
              ))}
            </select>
            <select
              value={chapterId}
              onChange={(e) => setChapterId(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
            >
              {chapters.map((c) => (
                <option key={c.id} value={c.id}>{c.title_zh}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto md:max-h-[62vh] md:flex-col md:overflow-y-auto">
          {list.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setActiveId(p.id)}
              className={`block w-full shrink-0 truncate rounded-xl px-3 py-2.5 text-left font-serif text-sm ${
                p.id === (view?.id ?? activeId)
                  ? "bg-accent-soft text-accent-ink"
                  : "text-muted hover:bg-surface-2"
              }`}
            >
              {p.original_text}
            </button>
          ))}
        </div>
      </aside>

      <section>
        {view && (
          <article className="rounded-[1.6rem] border border-line bg-surface p-6 shadow-paper md:p-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-faint">{view.ref_label}</span>
              <div className="flex flex-wrap gap-1">
                {(["original", "pinyin", "translation", "annotation"] as Layer[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLayers((s) => ({ ...s, [l]: !s[l] }))}
                    className={`rounded-full px-2.5 py-1 text-[11px] ${
                      layers[l] ? "bg-accent-soft text-accent" : "bg-surface-2 text-faint"
                    }`}
                  >
                    {{ original: "原文", pinyin: "拼音", translation: "译文", annotation: "注" }[l]}
                  </button>
                ))}
              </div>
            </div>
            {layers.original && (
              <p className="font-serif text-[1.65rem] leading-loose tracking-wide text-fg">
                {view.original_text}
              </p>
            )}
            {layers.pinyin && view.pinyin && (
              <p className="mt-2 font-serif-en text-sm italic text-faint">{view.pinyin}</p>
            )}
            {layers.translation && view.translation && (
              <p className="mt-4 font-serif-en text-sm leading-relaxed text-muted">{view.translation}</p>
            )}
            {layers.annotation && view.annotations.length > 0 && (
              <div className="mt-6 space-y-2">
                {view.annotations.map((a, i) => (
                  <div key={i} className="rounded-xl bg-surface-2 px-4 py-3 text-sm text-muted">
                    <span className="mr-2 text-xs text-zhu">{a.source}</span>
                    {a.content}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/chat?q=${encodeURIComponent(`请分轨解释：${view.original_text}`)}`}
                className="rounded-full bg-accent px-4 py-2 text-sm text-white"
              >
                就此切问
              </Link>
              <Link
                href="/journey/li/recap"
                className="rounded-full border border-line px-4 py-2 text-sm text-muted"
              >
                近思复盘
              </Link>
            </div>
            {view.concepts.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2 text-xs text-faint">
                {view.concepts.map((c) => (
                  <span key={c}>#{c}</span>
                ))}
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
}

export default function ReadPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-2xl" />}>
      <ReadInner />
    </Suspense>
  );
}
