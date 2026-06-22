"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getCaseStats,
  getCases,
  getMe,
  getTopics,
  reviewCase,
} from "@/lib/api";
import type {
  AuthUser,
  CaseBrief,
  CaseStats,
  TopicBrief,
} from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  draft: "待审",
  reviewed: "已审",
  published: "已发布",
  rejected: "已废弃",
};

export default function AdminCasesPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [topics, setTopics] = useState<TopicBrief[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [topicId, setTopicId] = useState<string | null>(null);
  const [status, setStatus] = useState("draft");
  const [review, setReview] = useState<string>("");  // "" | unreviewed | stamped | rated
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CaseBrief[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const refresh = () => {
    getCases({
      topic_id: topicId || undefined,
      status,
      review: review || undefined,
      page,
      page_size: 10,
    })
      .then((d) => {
        setItems(d.items);
        setTotal(d.total);
      })
      .catch(() => setErr("载入失败"));
    getCaseStats().then(setStats).catch(() => {});
  };

  useEffect(() => {
    getMe().then(setMe).catch(() => {});
    getTopics().then(setTopics).catch(() => {});
  }, []);
  useEffect(refresh, [topicId, status, review, page]);

  const update = async (
    id: number,
    body: { status?: string; quality?: number; review_note?: string },
  ) => {
    setBusy(id);
    try {
      await reviewCase(id, body);
      refresh();
    } finally {
      setBusy(null);
    }
  };

  if (!me)
    return <div className="skeleton h-40 w-full rounded-2xl" />;

  if (!me.is_admin)
    return (
      <div className="space-y-3">
        <div className="rounded-2xl border border-line bg-surface p-6">
          <div className="mb-2 text-sm font-medium text-fg">需要管理员权限</div>
          <p className="text-xs text-muted">
            管理员通过邮箱白名单授予。
            如果你是被授权的管理员，请用对应邮箱登录。
          </p>
          {me.is_guest ? (
            <Link
              href="/login"
              className="mt-3 inline-block rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90"
            >
              用管理员邮箱登录 →
            </Link>
          ) : (
            <div className="mt-3 text-xs text-muted">
              当前登录账号 <span className="font-mono">{me.email}</span> 不在管理员白名单。
              如需申请管理员权限，请联系平台运营。
            </div>
          )}
        </div>
      </div>
    );

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;

  return (
    <div className="space-y-4">
      {/* 统计 — 议题分布 */}
      {stats && (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {Object.entries(stats.by_topic).map(([id, t]) => (
            <div
              key={id}
              className="rounded-xl border border-line bg-surface px-3 py-2 text-xs"
            >
              <div className="text-muted">{t.name}</div>
              <div className="mt-0.5 font-serif text-lg text-fg">{t.total}</div>
              <div className="text-[10px] text-faint">
                已发 {t.by_status.published || 0}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* 审核质量分布 — 暴露"AI 一键盖章 vs 真正人审"区别 */}
      {stats?.review_quality && (
        <section className="rounded-xl border border-line bg-surface p-3">
          <div className="mb-2 text-xs font-medium text-fg">
            审核质量分布 · 共 {stats.total} 条
          </div>
          <div className="grid grid-cols-3 gap-2">
            <QualityCell
              label="完全未审"
              value={stats.review_quality.unreviewed}
              color="#888"
              hint="还没有 reviewer 字段，未走过任何审核流程"
            />
            <QualityCell
              label="AI 一键盖章"
              value={stats.review_quality.stamped}
              color="#854F0B"
              hint="有 reviewer 但未评星、无备注——多为批量发布产物"
            />
            <QualityCell
              label="已人审"
              value={stats.review_quality.rated}
              color="#0F6E56"
              hint="评了星或写了备注，可视作真正人工质检过"
            />
          </div>
          <p className="mt-2 text-[10px] text-faint">
            ⚠ 「AI 一键盖章」与「已人审」是两种完全不同的质量级别——前者只是流程过了，内容未必权威。
          </p>
        </section>
      )}

      {/* 筛选 */}
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
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="text-xs text-faint">状态：</span>
          {["draft", "reviewed", "published"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatus(s);
                setPage(1);
              }}
              className={`rounded-full px-2.5 py-1 text-xs ${
                status === s ? "bg-accent-soft text-accent" : "bg-surface-2 text-faint"
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">审核质量：</span>
          {[
            { v: "", label: "全部" },
            { v: "unreviewed", label: "完全未审" },
            { v: "stamped", label: "AI 一键盖章" },
            { v: "rated", label: "已人审" },
          ].map((r) => (
            <button
              key={r.v}
              onClick={() => {
                setReview(r.v);
                setPage(1);
              }}
              className={`rounded-full px-2.5 py-1 text-xs ${
                review === r.v ? "bg-accent text-white" : "border border-line text-muted"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      {/* 案例行 */}
      <section className="space-y-2">
        {items.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-line bg-surface p-3"
          >
            <div className="mb-1 flex items-start gap-2">
              <span className="text-[10px] text-faint">#{c.id}</span>
              <Link
                href={`/cases/${c.id}`}
                target="_blank"
                className="flex-1 font-serif text-sm text-fg hover:text-accent"
              >
                {c.question}
              </Link>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">
                {STATUS_LABELS[c.status] ?? c.status}
              </span>
            </div>
            {/* 审核来源徽章行：AI 协助 + 审核状态 + reviewer */}
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              {c.ai_generated && (
                <span
                  className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-faint"
                  title="内容由 AI 协助生成，可能含模板拼装"
                >
                  AI 协助
                </span>
              )}
              <ReviewBadge c={c} />
              {c.reviewer && (
                <span className="text-[10px] text-faint">
                  审核：{c.reviewer}
                  {c.reviewed_at && ` · ${c.reviewed_at.slice(0, 10)}`}
                </span>
              )}
              {c.review_note && (
                <span
                  className="rounded bg-cel-soft px-1.5 py-0.5 text-[10px] text-cel-ink"
                  title={c.review_note}
                >
                  💬 备注
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[10px] text-faint">质量：</span>
              {[1, 2, 3, 4, 5].map((q) => (
                <button
                  key={q}
                  disabled={busy === c.id}
                  onClick={() => update(c.id, { quality: q })}
                  className={`text-sm ${
                    q <= c.quality ? "text-amber-500" : "text-faint"
                  }`}
                  title={`${q} 星`}
                >
                  ★
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-line" />
              <button
                disabled={busy === c.id || c.status === "published"}
                onClick={() => update(c.id, { status: "published" })}
                className="rounded-full bg-accent px-3 py-1 text-xs text-white disabled:opacity-40"
              >
                发布
              </button>
              <button
                disabled={busy === c.id || c.status === "rejected"}
                onClick={() => update(c.id, { status: "rejected" })}
                className="rounded-full border border-line px-3 py-1 text-xs text-muted disabled:opacity-40"
              >
                废弃
              </button>
              {c.status !== "draft" && (
                <button
                  disabled={busy === c.id}
                  onClick={() => update(c.id, { status: "draft" })}
                  className="rounded-full border border-line px-3 py-1 text-xs text-muted"
                >
                  撤回
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-faint">
            该筛选下无案例
          </div>
        )}
      </section>

      {/* 分页 */}
      <div className="flex items-center justify-center gap-3 pt-2 text-xs">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-full border border-line px-3 py-1 text-muted disabled:opacity-40"
        >
          上一页
        </button>
        <span className="text-faint">
          {page} / {Math.max(1, Math.ceil(total / 10))}（共 {total} 条）
        </span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page * 10 >= total}
          className="rounded-full border border-line px-3 py-1 text-muted disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}

function QualityCell({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  hint: string;
}) {
  return (
    <div
      className="rounded-lg border border-line bg-surface-2/30 p-2"
      title={hint}
    >
      <div className="font-serif text-xl text-fg" style={{ color }}>
        {value.toLocaleString()}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function ReviewBadge({ c }: { c: CaseBrief }) {
  // 三态：完全未审 / AI 一键盖章 / 已人审
  if (!c.reviewer) {
    return (
      <span
        className="rounded-full border border-line px-1.5 py-0.5 text-[10px] text-faint"
        title="无 reviewer 字段，从未走过审核流程"
      >
        ◯ 未审
      </span>
    );
  }
  const hasNote = c.review_note && c.review_note.trim().length > 0;
  if (c.quality > 0 || hasNote) {
    return (
      <span
        className="rounded-full bg-cel-soft px-1.5 py-0.5 text-[10px] text-cel-ink"
        title="评了星或写了备注，可视作人工质检过"
      >
        ✓ 已人审
      </span>
    );
  }
  return (
    <span
      className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800"
      title="有 reviewer 但未评星、无备注——典型的批量发布产物，质量未必有保障"
    >
      ⚡ AI 一键盖章
    </span>
  );
}
