"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCorpusStats, getPassage } from "@/lib/api";
import { t, useLang } from "@/lib/i18n";
import type { CorpusStats, Passage } from "@/lib/types";

const QUOTE_REF = "lunyu.yanyuan.12.2";

export default function Home() {
  const [lang] = useLang();
  const [quote, setQuote] = useState<Passage | null>(null);
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    getPassage(QUOTE_REF, lang).then(setQuote).catch(() => setErr(true));
  }, [lang]);

  useEffect(() => {
    getCorpusStats().then(setStats).catch(() => {});
  }, []);

  const translation = quote?.translations.find((tr) => tr.lang === lang)
    ?? quote?.translations.find((tr) => tr.lang === "en");

  return (
    <div className="space-y-6">
      {/* 今日金句 */}
      <section className="rounded-2xl border border-line bg-accent-soft p-6 shadow-sm">
        <div className="mb-2 text-xs tracking-widest text-accent">
          {t("home.quote", lang)}
        </div>
        {err ? (
          <p className="text-sm text-faint">
            后端未连接。请先启动后端 uvicorn (8000)。
          </p>
        ) : quote ? (
          <>
            <p className="font-serif text-2xl leading-relaxed tracking-wide text-accent-ink">
              {quote.original_text}
            </p>
            {translation && translation.lang !== "zh" && (
              <p className="mt-3 font-serif text-sm italic text-muted">
                {translation.text}
              </p>
            )}
            <span className="mt-4 inline-block rounded-full bg-surface/50 px-3 py-1 text-xs text-accent">
              {quote.ref_label}
            </span>
          </>
        ) : (
          <div className="space-y-3">
            <div className="skeleton h-7 w-3/4" />
            <div className="skeleton h-4 w-2/3" />
            <div className="skeleton h-6 w-28 rounded-full" />
          </div>
        )}
      </section>

      {/* 语料看板 — 申报书目标①「≥10 万条标注语料」量化展示 */}
      {stats && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-1">
            <div>
              <div className="font-serif text-3xl font-medium text-fg">
                {stats.total.toLocaleString()}
              </div>
              <div className="text-xs text-faint">{t("corpus.units", lang)}</div>
            </div>
            <div className="text-xs text-faint">
              {t("corpus.target", lang)} {stats.target.toLocaleString()}
              <span className="mx-1">·</span>
              {(stats.progress * 100).toFixed(2)}%
            </div>
            <div className="ml-auto text-xs text-faint">
              <span className="font-serif text-lg text-fg">{stats.language_count}</span>{" "}
              {t("corpus.langs", lang)}
              <span className="ml-2 text-faint">
                {stats.languages.map((l) => l.toUpperCase()).join(" · ")}
              </span>
            </div>
          </div>
          {/* 进度条 */}
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${Math.min(100, stats.progress * 100)}%` }}
            />
          </div>
          {/* 关键明细 */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:grid-cols-4">
            {Object.entries(stats.breakdown)
              .slice(0, 8)
              .map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2/40 px-2 py-1.5">
                  <div className="font-serif text-base text-fg">{v}</div>
                  <div className="text-[10px] text-faint">{k}</div>
                </div>
              ))}
          </div>
          <div className="mt-3 text-xs text-muted">
            <Link href="/cases" className="text-accent hover:underline">
              {stats.breakdown["跨文明对话案例（条）"] ?? 0}{" "}
              {t("corpus.cases", lang)} →
            </Link>
          </div>
        </section>
      )}

      {/* 入口 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { href: "/chat",  title: "home.entry.chat",  desc: "home.entry.chat.desc" },
          { href: "/read",  title: "home.entry.read",  desc: "home.entry.read.desc" },
          { href: "/graph", title: "home.entry.graph", desc: "home.entry.graph.desc" },
        ].map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group rounded-2xl border border-line bg-surface p-6 transition hover:shadow-md"
          >
            <div className="font-serif text-xl font-medium text-fg">
              {t(e.title, lang)}
            </div>
            <p className="mt-2 text-sm text-muted">{t(e.desc, lang)}</p>
            <span className="mt-4 inline-block text-sm text-accent group-hover:underline">
              {t("home.cta", lang)}
            </span>
          </Link>
        ))}
      </section>
    </div>
  );
}
