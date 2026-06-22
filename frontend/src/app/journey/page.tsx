"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { checkin, completeTask, getGamifyProfile } from "@/lib/api";
import type { Badge, GamifyProfile, LiuyiItem } from "@/lib/types";

const TIER_RING: Record<string, string> = {
  gold: "#F4C430",
  silver: "#A8B0B8",
};

export default function JourneyPage() {
  const [p, setP] = useState<GamifyProfile | null>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () =>
    getGamifyProfile().then(setP).catch(() => setErr("无法连接后端 (8000)。"));
  useEffect(() => {
    load();
  }, []);

  const showAwards = (ids?: string[], badges?: Badge[]) => {
    if (!ids?.length || !badges) return;
    const names = ids
      .map((id) => badges.find((b) => b.id === id)?.name)
      .filter(Boolean) as string[];
    if (names.length) {
      setToast(names);
      setTimeout(() => setToast([]), 3200);
    }
  };

  const doCheckin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await checkin();
      setP(r);
      showAwards(r.awarded_badges, r.badges);
    } finally {
      setBusy(false);
    }
  };

  const doTask = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await completeTask(id);
      setP(r);
      showAwards(r.awarded_badges, r.badges);
    } finally {
      setBusy(false);
    }
  };

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;
  if (!p)
    return (
      <div className="space-y-4">
        <div className="skeleton h-28 w-full rounded-2xl" />
        <div className="skeleton h-24 w-full rounded-2xl" />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* 解锁提示 */}
      {toast.length > 0 && (
        <div className="rounded-xl border border-gold bg-accent-soft px-4 py-3 text-sm text-accent-ink">
          🎖 解锁勋章：{toast.join("、")}
        </div>
      )}

      {/* 段位卡 + 打卡 */}
      <section className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-end gap-2">
            <span className="font-serif text-3xl font-medium text-fg">{p.level.name}</span>
            <span className="mb-1 text-xs text-faint">lv · {p.level.xp} XP</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${Math.round(p.level.progress * 100)}%` }}
            />
          </div>
          <div className="mt-1.5 text-xs text-faint">
            {p.level.next_name
              ? `距「${p.level.next_name}」还差 ${(p.level.next_at ?? 0) - p.level.xp} XP`
              : "已至最高段位 · 翰林"}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-surface px-6 py-5">
          <div className="text-3xl">🔥</div>
          <div className="font-serif text-2xl font-medium text-fg">{p.streak_days}</div>
          <div className="mb-2 text-xs text-faint">连续打卡</div>
          <button
            onClick={doCheckin}
            disabled={busy || p.checked_in_today}
            className={`rounded-full px-4 py-1.5 text-sm ${
              p.checked_in_today
                ? "bg-surface-2 text-faint"
                : "bg-accent text-white hover:opacity-90"
            }`}
          >
            {p.checked_in_today ? "今日已打卡" : "今日打卡 +20"}
          </button>
        </div>
      </section>

      {/* 六艺进境 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="text-sm font-medium text-fg">六艺进境</div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/journey/li"
              className="rounded-full bg-accent px-3 py-1 text-xs text-white hover:opacity-90"
            >
              进入「礼」情境 →
            </Link>
            <Link
              href="/journey/she"
              className="rounded-full border border-gold bg-accent-soft px-3 py-1 text-xs text-accent-ink hover:opacity-90"
              title="3D 射场 · 反求诸己"
            >
              进入「射」3D 射场 →
            </Link>
            <Link
              href="/journey/shu"
              className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-fg hover:bg-accent-soft"
              title="字源图鉴 · 识字明义"
            >
              进入「书」字源图鉴 →
            </Link>
            <Link
              href="/journey/yue"
              className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-fg hover:bg-accent-soft"
              title="五音合鸣 · 为情志奏一段乐"
            >
              进入「乐」五音合鸣 →
            </Link>
            <Link
              href="/journey/math"
              className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-fg hover:bg-accent-soft"
              title="均输衰分 · 不患寡而患不均"
            >
              进入「数」均输衰分 →
            </Link>
            <Link
              href="/journey/yu"
              className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-fg hover:bg-accent-soft"
              title="五御 · 礼以行之，不极不躁"
            >
              进入「御」五御之礼 →
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {p.liuyi.map((a) => (
            <Ring key={a.key} item={a} />
          ))}
        </div>
      </section>

      {/* 今日修行 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">今日修行</div>
        <div className="space-y-2">
          {p.tasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3"
            >
              <div className="flex-1">
                <div className={`text-sm ${t.done ? "text-faint line-through" : "text-fg"}`}>
                  {t.title}
                </div>
                <div className="text-xs text-faint">{t.hint} · +{t.xp} XP</div>
              </div>
              <button
                onClick={() => doTask(t.id)}
                disabled={busy || t.done}
                className={`rounded-full px-3 py-1.5 text-xs ${
                  t.done ? "bg-cel-soft text-cel-ink" : "bg-accent text-white"
                }`}
              >
                {t.done ? "已完成" : "完成"}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 勋章墙 */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="mb-3 text-sm font-medium text-fg">
          勋章 · {p.badges.filter((b) => b.unlocked).length}/{p.badges.length}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {p.badges.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border p-3 text-center ${
                b.unlocked ? "border-gold bg-accent-soft" : "border-line bg-surface-2/40"
              }`}
            >
              <div
                className="mx-auto mb-1 flex h-10 w-10 items-center justify-center rounded-full text-lg"
                style={{
                  background: b.unlocked ? TIER_RING[b.tier] ?? "#ccc" : "var(--line)",
                  filter: b.unlocked ? "none" : "grayscale(1)",
                  opacity: b.unlocked ? 1 : 0.5,
                }}
              >
                {b.unlocked ? "🏅" : "🔒"}
              </div>
              <div className={`text-sm font-medium ${b.unlocked ? "text-accent-ink" : "text-faint"}`}>
                {b.name}
              </div>
              <div className="text-[10px] text-faint">{b.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Ring({ item }: { item: LiuyiItem }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const off = c * (1 - item.value / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="transition-all"
        />
      </svg>
      <span className="-mt-9 font-serif text-base text-fg">{item.label}</span>
      <span className="mt-6 text-[10px] text-faint">{item.value}</span>
    </div>
  );
}
