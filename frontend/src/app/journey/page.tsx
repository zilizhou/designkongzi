"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  checkin,
  completeTask,
  getGamifyProfile,
  getJourneyLeaderboard,
  getJourneyOverview,
} from "@/lib/api";
import type {
  Badge,
  GamifyProfile,
  JourneyArtBrief,
  JourneyBadge,
  JourneyLeaderboardResp,
  JourneyOverviewResp,
} from "@/lib/types";

const BADGE_TIER_COLOR: Record<string, string> = {
  normal: "#9CA3AF",
  gold: "#D4A017",
  treasure: "#B45309",
};
const BADGE_TIER_BG: Record<string, string> = {
  normal: "#F3F4F6",
  gold: "#FEF3C7",
  treasure: "#FED7AA",
};

export default function JourneyPage() {
  const [p, setP] = useState<GamifyProfile | null>(null);
  const [ov, setOv] = useState<JourneyOverviewResp | null>(null);
  const [lb, setLb] = useState<JourneyLeaderboardResp | null>(null);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => {
    getGamifyProfile().then(setP).catch(() => setErr("无法连接后端 (8000)。"));
    getJourneyOverview().then(setOv).catch(() => {});
    getJourneyLeaderboard(10).then(setLb).catch(() => {});
  };
  useEffect(load, []);

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
      getJourneyOverview().then(setOv).catch(() => {});
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
      getJourneyOverview().then(setOv).catch(() => {});
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
            {ov && (
              <span className="mb-1 ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent-ink">
                六艺称号 · {ov.title}
              </span>
            )}
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

      {/* 君子之路总览：六艺总分 + 6 张艺卡（带进度条+入口） */}
      {ov && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-sm font-medium text-fg">君子之路 · 六艺总览</div>
              <div className="mt-0.5 text-xs text-muted">
                总分 <span className="font-serif text-lg text-accent">{ov.total_score}</span>
                <span className="text-faint"> / 600</span>
                <span className="ml-2 text-faint">·</span>
                <span className="ml-2">最高 {ov.max_art} · 最低 {ov.min_art}</span>
              </div>
            </div>
            <div className="text-[10px] text-faint">
              勋章 {ov.badges_unlocked} / {ov.badges_total}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ov.arts.map((a) => (
              <ArtCard key={a.key} a={a} />
            ))}
          </div>
        </section>
      )}

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

      {/* 君子勋章墙 */}
      {ov && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 text-sm font-medium text-fg">
            君子勋章 · {ov.badges_unlocked} / {ov.badges_total}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {ov.badges.map((b) => (
              <BadgeCell key={b.key} b={b} />
            ))}
          </div>
          <p className="mt-3 text-[10px] text-faint">
            「六艺通才」需六艺每艺 ≥ 40；「君子大成」需每艺 ≥ 60 且任一艺 ≥ 80。
          </p>
        </section>
      )}

      {/* 群体排行榜 */}
      {lb && lb.items.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium text-fg">群体排行 · 君子之路 Top 10</div>
            <div className="text-[10px] text-faint">
              共 {lb.total_players} 位君子
              {lb.self && lb.self.rank > 10 && (
                <span className="ml-2 text-accent">· 你第 {lb.self.rank} 位</span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            {lb.items.map((row) => (
              <LeaderRow key={row.user_id} row={row} />
            ))}
            {/* 自己不在 Top 10 时单独显示 */}
            {lb.self && lb.self.rank > 10 && (
              <>
                <div className="text-center text-[10px] text-faint">···</div>
                <LeaderRow row={lb.self} />
              </>
            )}
          </div>
        </section>
      )}

      {/* 旧 GamifyProfile 勋章（保留作系统勋章，但放底部） */}
      {p.badges.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 text-sm font-medium text-fg">
            系统勋章 · {p.badges.filter((b) => b.unlocked).length} / {p.badges.length}
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {p.badges.map((b) => (
              <div
                key={b.id}
                className={`rounded-xl border p-2 text-center ${
                  b.unlocked ? "border-gold bg-accent-soft" : "border-line bg-surface-2/40"
                }`}
              >
                <div
                  className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-full text-base"
                  style={{
                    background: b.unlocked ? "#F4C430" : "var(--line)",
                    filter: b.unlocked ? "none" : "grayscale(1)",
                    opacity: b.unlocked ? 1 : 0.5,
                  }}
                >
                  {b.unlocked ? "🏅" : "🔒"}
                </div>
                <div className={`text-[11px] ${b.unlocked ? "text-accent-ink" : "text-faint"}`}>
                  {b.name}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 六艺卡 ─────────────────────────────────────────────────
function ArtCard({ a }: { a: JourneyArtBrief }) {
  const pct = Math.max(0, Math.min(100, a.score));
  const grade = a.score >= 80 ? "神" : a.score >= 60 ? "妙" : a.score >= 40 ? "中" : a.score >= 20 ? "试" : "未起";
  return (
    <Link
      href={a.path}
      className="group block rounded-xl border border-line bg-surface-2/40 p-3 transition-all hover:shadow-md"
      style={{ borderLeftColor: a.color, borderLeftWidth: 4 }}
    >
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="font-serif text-2xl" style={{ color: a.color }}>{a.label}</span>
          <span className="text-[10px] text-muted">{a.subtitle}</span>
        </div>
        <div className="text-right">
          <span className="font-serif text-lg" style={{ color: a.color }}>{a.score}</span>
          <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[10px]" style={{ color: a.color }}>
            {grade}
          </span>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/50">
        <div
          className="h-full transition-all"
          style={{ width: `${pct}%`, background: a.color }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] text-muted opacity-0 group-hover:opacity-100">
        进入 →
      </div>
    </Link>
  );
}

// ─── 勋章 ───────────────────────────────────────────────────
function BadgeCell({ b }: { b: JourneyBadge }) {
  const color = BADGE_TIER_COLOR[b.tier] || "#9CA3AF";
  const bg = BADGE_TIER_BG[b.tier] || "#F3F4F6";
  return (
    <div
      className={`rounded-xl border-2 p-3 text-center transition-all ${
        b.unlocked ? "" : "opacity-50"
      }`}
      style={{
        borderColor: b.unlocked ? color : "var(--line)",
        background: b.unlocked ? bg : "transparent",
      }}
      title={b.desc}
    >
      <div
        className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full text-xl"
        style={{
          background: b.unlocked ? color : "var(--surface-2)",
          color: "#fff",
          filter: b.unlocked ? "none" : "grayscale(1)",
        }}
      >
        {b.unlocked ? (b.tier === "treasure" ? "💎" : b.tier === "gold" ? "🏆" : "🏅") : "🔒"}
      </div>
      <div
        className={`text-sm font-medium ${b.unlocked ? "" : "text-faint"}`}
        style={{ color: b.unlocked ? color : undefined }}
      >
        {b.name}
      </div>
      <div className="text-[10px] text-faint">{b.desc}</div>
    </div>
  );
}

// ─── 排行行 ─────────────────────────────────────────────────
function LeaderRow({ row }: { row: { rank: number; name: string; total: number; by_art: Record<string, number>; is_self: boolean } }) {
  const medal = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : `${row.rank}`;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
        row.is_self ? "border border-accent bg-accent-soft" : "bg-surface-2/40"
      }`}
    >
      <div className="w-7 text-center font-serif text-sm" style={{ color: row.is_self ? "var(--accent)" : undefined }}>
        {medal}
      </div>
      <div className="flex-1">
        <div className={`text-sm ${row.is_self ? "font-medium text-accent-ink" : "text-fg"}`}>
          {row.name}{row.is_self && " · 你"}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-1 text-[9px] text-muted">
          {[
            { k: "li", lbl: "礼" },
            { k: "yue", lbl: "乐" },
            { k: "she", lbl: "射" },
            { k: "yu", lbl: "御" },
            { k: "shu", lbl: "书" },
            { k: "shu2", lbl: "数" },
          ].map(({ k, lbl }) => {
            const v = row.by_art[k] ?? 0;
            return (
              <span
                key={k}
                className="rounded bg-white/70 px-1 py-0.5"
                style={{ opacity: v > 0 ? 1 : 0.4 }}
              >
                {lbl} {v}
              </span>
            );
          })}
        </div>
      </div>
      <div className="text-right">
        <div className="font-serif text-lg text-fg">{row.total}</div>
        <div className="text-[9px] text-faint">/ 600</div>
      </div>
    </div>
  );
}
