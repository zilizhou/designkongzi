"use client";

import { useEffect, useState } from "react";
import {
  getTopics,
  listContribs,
  myContribs,
  submitContrib,
  voteContrib,
} from "@/lib/api";
import type { Contribution, TopicBrief } from "@/lib/types";

const CIVS = [
  { code: "confucian", label: "儒家" },
  { code: "christian", label: "基督教伦理" },
  { code: "enlightenment", label: "启蒙理性" },
  { code: "kantian", label: "康德义务论" },
  { code: "buddhist", label: "佛教/印度思想" },
  { code: "daoist", label: "道家" },
  { code: "islamic", label: "伊斯兰思想" },
  { code: "secular_humanism", label: "世俗人文主义" },
  { code: "other", label: "其他" },
];

export default function CoCreatePage() {
  const [topics, setTopics] = useState<TopicBrief[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<"score" | "new">("score");
  const [items, setItems] = useState<Contribution[]>([]);
  const [mine, setMine] = useState<Contribution[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    topic_id: "climate",
    civilization: "daoist",
    headline: "",
    detail: "",
  });

  const refresh = () => {
    listContribs({ topic_id: filter || undefined, sort })
      .then((r) => setItems(r.items))
      .catch(() => {});
    myContribs().then(setMine).catch(() => {});
  };

  useEffect(() => {
    getTopics().then(setTopics).catch(() => {});
  }, []);
  useEffect(refresh, [filter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.headline.trim()) return;
    await submitContrib({
      kind: "cross_civ",
      topic_id: form.topic_id,
      civilization: form.civilization,
      headline: form.headline,
      detail: form.detail,
    });
    setForm({ ...form, headline: "", detail: "" });
    setShowForm(false);
    refresh();
  };

  const vote = async (id: number, v: 1 | -1) => {
    setBusyId(id);
    try {
      await voteContrib(id, v);
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <section className="rounded-2xl border border-line bg-accent-soft p-5">
        <div className="text-xs tracking-widest text-accent">共创广场</div>
        <h1 className="mt-1 font-serif text-xl text-accent-ink">
          可提问 · 可互动 · 可共创
        </h1>
        <p className="mt-1 text-xs text-muted">
          欢迎来自任何文化传统的研究者、教育者、学习者，补充跨文明立场、对话与注解。
          经审核后将进入「跨文明立场库」与 AI 对话引擎。
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-accent px-4 py-1.5 text-sm text-white"
          >
            {showForm ? "收起" : "+ 提交立场"}
          </button>
        </div>
      </section>

      {/* 提交表单 */}
      {showForm && (
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted">
              所属议题
              <select
                value={form.topic_id}
                onChange={(e) => setForm({ ...form, topic_id: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg"
              >
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted">
              文化传统
              <select
                value={form.civilization}
                onChange={(e) => setForm({ ...form, civilization: e.target.value })}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-sm text-fg"
              >
                {CIVS.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="block text-xs text-muted">
            立场（一句话）
            <input
              value={form.headline}
              onChange={(e) => setForm({ ...form, headline: e.target.value })}
              required
              placeholder="例：无为而治，顺自然之道"
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </label>
          <label className="block text-xs text-muted">
            详细论证（可空）
            <textarea
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
              rows={3}
              placeholder="思想源流、经典出处、当代启示…"
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg outline-none focus:border-accent"
            />
          </label>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm text-white">
            提交（待审核）
          </button>
        </form>
      )}

      {/* 我的贡献 */}
      {mine.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-xs text-faint">我的贡献 · {mine.length}</div>
          <div className="space-y-1">
            {mine.slice(0, 3).map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                  c.status === "published"
                    ? "bg-cel-soft text-cel-ink"
                    : c.status === "pending"
                    ? "bg-surface-2 text-faint"
                    : "bg-accent-soft text-accent"
                }`}>{c.status}</span>
                <span className="truncate text-muted">{c.headline}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 筛选 + 排序 */}
      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">议题：</span>
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-2.5 py-1 text-xs ${
              filter === null ? "bg-accent text-white" : "border border-line text-muted"
            }`}
          >
            全部
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                filter === t.id ? "text-white" : "border border-line text-muted"
              }`}
              style={filter === t.id ? { background: t.color } : undefined}
            >
              {t.name}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-line" />
          {(["score", "new"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                sort === s ? "bg-accent-soft text-accent" : "bg-surface-2 text-faint"
              }`}
            >
              {s === "score" ? "高热度" : "最新"}
            </button>
          ))}
        </div>
      </section>

      {/* 列表 */}
      <section className="space-y-2">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-faint">
            还没有已发布的共创内容。提交你的第一条立场？
          </div>
        ) : (
          items.map((c) => (
            <div key={c.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 text-xs">
                  <button
                    disabled={busyId === c.id}
                    onClick={() => vote(c.id, 1)}
                    className="text-faint hover:text-accent"
                  >
                    ▲
                  </button>
                  <span className="font-medium text-fg">{c.score}</span>
                  <button
                    disabled={busyId === c.id}
                    onClick={() => vote(c.id, -1)}
                    className="text-faint hover:text-accent"
                  >
                    ▼
                  </button>
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-faint">
                    {c.topic_id && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5">
                        {topics.find((t) => t.id === c.topic_id)?.name ?? c.topic_id}
                      </span>
                    )}
                    {c.civilization && (
                      <span className="rounded-full bg-surface-2 px-2 py-0.5">
                        {CIVS.find((x) => x.code === c.civilization)?.label ?? c.civilization}
                      </span>
                    )}
                  </div>
                  <div className="font-serif text-sm text-fg">{c.headline}</div>
                  {c.detail && (
                    <p className="mt-1 text-xs text-muted">{c.detail}</p>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
