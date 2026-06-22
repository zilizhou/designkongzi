"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCaseStats, getCases, getTopics } from "@/lib/api";
import type { CaseBrief, CaseStats, TopicBrief } from "@/lib/types";

const PAGE_SIZE = 12;

export default function CasesPage() {
  const [topics, setTopics] = useState<TopicBrief[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CaseBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getTopics().then(setTopics).catch(() => setErr("无法连接后端 (8000)。"));
    getCaseStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getCases({
      topic_id: topicId || undefined,
      q: q || undefined,
      page,
      page_size: PAGE_SIZE,
      status: "published",
    })
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .finally(() => setLoading(false));
  }, [topicId, q, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;

  return (
    <div className="space-y-4">
      {/* 顶部数据卡 */}
      {stats && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
            <div>
              <div className="font-serif text-3xl font-medium text-fg">
                {stats.total}
              </div>
              <div className="text-xs text-faint">案例库 · 5 议题 × 5 文明</div>
            </div>
            <div className="ml-auto text-xs text-faint">
              {Object.values(stats.by_topic).reduce(
                (acc, t) => acc + (t.by_status.published || 0),
                0,
              )}{" "}
              条已发布
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            申报书目标②的「跨文明对话案例库」。每条都引用经典原文与多文明立场，
            可用于课堂教学、跨文化对话与公开传播。
          </p>
        </section>
      )}

      {/* 议题筛选 + 搜索 */}
      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">议题：</span>
          <button
            onClick={() => {
              setTopicId(null);
              setPage(1);
            }}
            className={`rounded-full px-2.5 py-1 text-xs ${
              topicId === null ? "bg-accent text-white" : "border border-line text-muted"
            }`}
          >
            全部
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTopicId(t.id);
                setPage(1);
              }}
              className={`rounded-full px-2.5 py-1 text-xs ${
                topicId === t.id ? "text-white" : "border border-line text-muted"
              }`}
              style={topicId === t.id ? { background: t.color } : undefined}
            >
              {t.name}
            </button>
          ))}
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="搜索关键词…"
            className="ml-auto w-44 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-fg outline-none focus:border-accent"
          />
        </div>
      </section>

      {/* 列表 */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-36 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-faint">
          <div>暂无案例（默认只显示已审核发布的）</div>
          <div className="mt-2 text-xs">
            管理员可前往
            <Link href="/admin/cases" className="mx-1 text-accent hover:underline">/admin/cases</Link>
            评审发布。
          </div>
          <div className="mt-1 text-xs text-faint">
            管理员账号通过邮箱白名单授予 ·
            <Link href="/login" className="ml-1 text-accent hover:underline">用管理员邮箱登录 →</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => {
            const topic = topics.find((t) => t.id === c.topic_id);
            return (
              <Link
                key={c.id}
                href={`/cases/${c.id}`}
                className="group rounded-2xl border border-line bg-surface p-4 transition hover:shadow-md"
              >
                {topic && (
                  <span
                    className="mb-2 inline-block rounded-full px-2 py-0.5 text-[10px] text-white"
                    style={{ background: topic.color }}
                  >
                    {topic.name}
                  </span>
                )}
                <div className="font-serif text-base text-fg group-hover:text-accent">
                  {c.question}
                </div>
                <div className="mt-3 flex items-center gap-2 text-[10px] text-faint">
                  <span>{c.civ_count} 文明对照</span>
                  {c.quality > 0 && (
                    <span>·  {"★".repeat(c.quality)}</span>
                  )}
                  {c.tags.length > 1 && (
                    <span>· {c.tags[1]}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-full border border-line px-3 py-1 text-muted disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-faint">
            {page} / {totalPages}（共 {total} 条）
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-full border border-line px-3 py-1 text-muted disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
