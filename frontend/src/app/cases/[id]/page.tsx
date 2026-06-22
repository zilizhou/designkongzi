"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCase, getTopics } from "@/lib/api";
import type { CaseDetail, TopicBrief } from "@/lib/types";

const CIV_COLORS: Record<string, string> = {
  confucian: "#993C1D",
  christian: "#7A4B36",
  enlightenment: "#0F6E56",
  kantian: "#534AB7",
  buddhist: "#854F0B",
};

export default function CaseDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [c, setC] = useState<CaseDetail | null>(null);
  const [topics, setTopics] = useState<TopicBrief[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    getCase(Number(id)).then(setC).catch(() => setC(null));
    getTopics().then(setTopics).catch(() => {});
  }, [id]);

  const topic = topics.find((t) => t.id === c?.topic_id);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 1500);
  };

  const onShare = () => {
    if (!c) return;
    const text = `${c.question}\n\n${c.confucian_answer.split("\n")[0]}\n\n——孔子·儒家语义平台`;
    navigator.clipboard?.writeText(text);
    flash("已复制案例摘要，可粘贴分享");
  };

  if (!c)
    return <div className="skeleton h-80 w-full rounded-2xl" />;

  return (
    <div className="relative space-y-4">
      {toast && (
        <div className="fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-xs text-white">
          {toast}
        </div>
      )}

      {/* 返回 + 标题 */}
      <div className="text-xs">
        <Link href="/cases" className="text-faint hover:text-accent">
          ← 返回案例库
        </Link>
      </div>

      {/* 议题 + 状态 */}
      <div className="flex flex-wrap items-center gap-2">
        {topic && (
          <span
            className="rounded-full px-2.5 py-1 text-xs text-white"
            style={{ background: topic.color }}
          >
            {topic.name}
          </span>
        )}
        {c.status !== "published" && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">
            {c.status === "draft" ? "待审" : c.status === "reviewed" ? "已审" : c.status}
          </span>
        )}
        {c.ai_generated && !c.reviewer && (
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">
            AI 协助
          </span>
        )}
        {c.quality > 0 && (
          <span className="text-xs text-amber-500">{"★".repeat(c.quality)}</span>
        )}
        <button
          onClick={onShare}
          className="ml-auto rounded-full border border-line px-3 py-1 text-xs text-muted hover:bg-surface-2"
        >
          分享
        </button>
      </div>

      {/* 问题 */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-2 text-xs text-faint">问题</div>
        <h1 className="font-serif text-xl leading-relaxed text-fg">{c.question}</h1>
      </section>

      {/* 儒家答案 */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="mb-3 text-xs text-faint">儒家价值推理</div>
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg">
          {c.confucian_answer}
        </pre>
      </section>

      {/* 经典依据 */}
      {c.citations.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs text-faint">经典依据</div>
          {c.citations.map((cit) => (
            <Link
              key={cit.ref_id}
              href={`/read?ref=${encodeURIComponent(cit.ref_id)}`}
              className="block max-w-full rounded-r-lg border-l-[3px] border-accent bg-accent-soft px-3 py-2 hover:opacity-90"
            >
              <div className="font-serif text-[15px] font-medium tracking-wide text-accent-ink">
                {cit.text}
              </div>
              <div className="mt-1 text-[10px] text-accent">{cit.ref_label}</div>
            </Link>
          ))}
        </section>
      )}

      {/* 跨文明对照 */}
      {c.cross_civ_views.length > 0 && (
        <section>
          <div className="mb-2 text-xs text-faint">
            跨文明对照 · {c.cross_civ_views.length} 文明并陈
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {c.cross_civ_views.map((v) => {
              const color = CIV_COLORS[v.civilization] ?? "#888";
              return (
                <div
                  key={v.civilization}
                  className="rounded-xl border border-line bg-surface p-3"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className="inline-block h-1.5 w-6 rounded-full"
                      style={{ background: color }}
                    />
                    <span className="text-xs font-medium" style={{ color }}>
                      {v.civ_label}
                    </span>
                  </div>
                  <div className="font-serif text-sm leading-relaxed text-fg">
                    {v.headline}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 审核信息 */}
      {(c.reviewer || c.review_note) && (
        <section className="rounded-xl border border-line bg-surface-2/40 p-3 text-xs text-faint">
          <span>
            {c.reviewer && `审核：${c.reviewer}`}
            {c.reviewed_at && ` · ${new Date(c.reviewed_at).toLocaleDateString()}`}
          </span>
          {c.review_note && <div className="mt-1">备注：{c.review_note}</div>}
        </section>
      )}
    </div>
  );
}
