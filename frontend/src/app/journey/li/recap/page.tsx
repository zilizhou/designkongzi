"use client";

import Link from "next/link";
import MockMark from "@/components/qiewen/MockMark";
import { MOCK_RULES } from "@/lib/qiewen/mock";

export default function LiRecapPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] tracking-[0.32em] text-accent">近思 · 复盘</p>
            <MockMark />
          </div>
          <h1 className="mt-2 font-serif text-3xl text-fg">揖过浅，不是分数不够</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            演练结束先看规则出处、时代和教学抽象，再回到章句。阈值是练习用的，不是唯一礼制。
          </p>
        </div>
        <Link href="/journey/li" className="text-sm text-accent hover:underline">
          再演练 →
        </Link>
      </div>

      <div className="space-y-4">
        {MOCK_RULES.map((r) => (
          <article key={r.id} className="rounded-[1.4rem] border border-line bg-surface p-5 shadow-paper">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-lg text-fg">{r.action}</span>
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                {r.verdict}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted">{r.expected}</p>
            <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
              <div>
                <dt className="text-[11px] tracking-wide text-faint">出处</dt>
                <dd className="mt-1 font-serif text-fg">{r.source_label}</dd>
              </div>
              <div>
                <dt className="text-[11px] tracking-wide text-faint">时代</dt>
                <dd className="mt-1 text-muted">{r.era}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] tracking-wide text-faint">适用范围</dt>
                <dd className="mt-1 text-muted">{r.scope}</dd>
              </div>
              <div className="md:col-span-2 rounded-xl bg-surface-2 px-4 py-3">
                <dt className="text-[11px] tracking-wide text-faint">教学抽象</dt>
                <dd className="mt-1 text-muted">{r.abstraction_note}</dd>
              </div>
            </dl>
            <Link
              href={`/read?ref=${r.source_ref}`}
              className="mt-4 inline-block text-sm text-accent hover:underline"
            >
              回到相关章句 →
            </Link>
          </article>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/chat?q=${encodeURIComponent("「克己复礼」是在要求人压抑自己吗？")}`}
          className="rounded-full bg-accent px-4 py-2 text-sm text-white"
        >
          就此切问
        </Link>
        <Link href="/me" className="rounded-full border border-line px-4 py-2 text-sm text-muted">
          写入学习档案
        </Link>
      </div>
    </div>
  );
}
