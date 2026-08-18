"use client";

import Link from "next/link";
import { t, useLang } from "@/lib/i18n";
import { DEMO_QUESTION } from "@/components/qiewen/tracks";

export default function Home() {
  const [lang] = useLang();

  return (
    <div className="qx-bleed relative overflow-hidden">
      <div className="pointer-events-none absolute inset-y-0 left-[7%] hidden w-px bg-line/70 lg:block" />
      <div className="mx-auto grid min-h-[calc(100dvh-3.5rem)] max-w-6xl grid-cols-1 px-5 py-10 md:px-8 lg:grid-cols-[4.5rem_1fr] lg:py-16">
        <aside className="hidden lg:flex">
          <p className="font-serif text-[15px] leading-[2.4] tracking-[0.55em] text-faint [writing-mode:vertical-rl]">
            切问而近思 · 论语 · 子张
          </p>
        </aside>

        <div className="flex flex-col justify-center">
          <p className="qx-rise text-[11px] tracking-[0.38em] text-accent">
            {t("home.values", lang)}
          </p>
          <h1 className="qx-rise qx-rise-2 mt-5 font-serif text-[2.6rem] font-medium leading-[1.15] text-fg sm:text-6xl">
            切问近思
          </h1>
          <p className="qx-rise qx-rise-3 mt-5 max-w-xl font-serif text-lg leading-relaxed text-muted sm:text-xl">
            {t("brand.line", lang)}
          </p>
          <p className="qx-rise qx-rise-3 mt-3 max-w-lg font-serif-en text-sm italic text-faint">
            Not an AI playing Confucius — an AI accountable for every claim.
          </p>

          <div className="qx-rise qx-rise-4 mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Link
              href={`/chat?q=${encodeURIComponent(DEMO_QUESTION)}`}
              className="group relative overflow-hidden rounded-[1.6rem] border border-line bg-surface p-6 shadow-paper transition hover:-translate-y-0.5 sm:p-8"
            >
              <div className="absolute right-5 top-5 font-serif text-5xl text-accent/10">问</div>
              <div className="text-[11px] tracking-[0.32em] text-accent">切问</div>
              <div className="mt-3 font-serif text-2xl text-fg">{t("home.door.ask", lang)}</div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
                {t("home.door.ask.desc", lang)}
              </p>
              <span className="mt-6 inline-flex items-center text-sm text-accent">
                进入对读
                <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
              </span>
            </Link>

            <Link
              href="/journey/li"
              className="group relative overflow-hidden rounded-[1.6rem] border border-line bg-accent-soft p-6 transition hover:-translate-y-0.5 sm:p-8"
            >
              <div className="absolute right-5 top-5 font-serif text-5xl text-accent/15">习</div>
              <div className="text-[11px] tracking-[0.32em] text-accent">近思</div>
              <div className="mt-3 font-serif text-2xl text-accent-ink">
                {t("home.door.practice", lang)}
              </div>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-accent-ink/75">
                {t("home.door.practice.desc", lang)}
              </p>
              <span className="mt-6 inline-flex items-center text-sm text-accent">
                进入演练
                <span className="ml-1 transition group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          </div>

          <div className="qx-rise qx-rise-4 mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <span className="text-[11px] tracking-[0.28em] text-faint">{t("home.try", lang)}</span>
            <Link
              href={`/chat?q=${encodeURIComponent(DEMO_QUESTION)}`}
              className="rounded-full border border-line bg-surface/80 px-4 py-2 font-serif text-sm text-fg hover:border-gold-line"
            >
              {DEMO_QUESTION}
            </Link>
          </div>

          <div className="mt-12 flex flex-wrap gap-x-6 gap-y-2 text-xs text-faint">
            <Link href="/read" className="hover:text-accent">读经</Link>
            <Link href="/graph" className="hover:text-accent">图谱</Link>
            <Link href="/design" className="hover:text-accent">界面稿</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
