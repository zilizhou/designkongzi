"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { getLiHostLeaderboard, getLiHostToday, submitLiHostResult } from "@/lib/api";
import type {
  LiHostLeaderboardResp,
  LiHostResultResp,
  LiHostScores,
  LiHostStateItem,
  LiHostTodayResp,
} from "@/lib/types";
import { LI_HOST_SCENARIOS, liHostScenario } from "./liHostData";
import type { LiHostRoundDetail } from "./liHostData";
import { geomTotal } from "./liHostLogic";

const Li3DGame = dynamic(() => import("./Li3DGame"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-line bg-surface p-12 text-center">
      <div className="font-serif text-lg text-fg">礼部修行场准备中…</div>
      <div className="mt-2 text-xs text-faint">正在加载 3D 宾主厅</div>
    </div>
  ),
});

type View = "hub" | "playing" | "result";

const DIFF_LABEL = ["", "入门", "初阶", "进阶", "高阶", "终局"];

const GRADE_COLOR: Record<string, string> = {
  礼之大成: "#993C1D",
  君子儒: "#854F0B",
  守礼君子: "#0F6E56",
  通情达人: "#1E5F8E",
  习礼者: "#6b7280",
};

export default function LiGamePage() {
  const [view, setView] = useState<View>("hub");
  const [today, setToday] = useState<LiHostTodayResp | null>(null);
  const [board, setBoard] = useState<LiHostLeaderboardResp | null>(null);
  const [currentKey, setCurrentKey] = useState("");
  const [scores, setScores] = useState<LiHostScores | null>(null);
  const [detail, setDetail] = useState<LiHostRoundDetail | null>(null);
  const [result, setResult] = useState<LiHostResultResp | null>(null);
  const [err, setErr] = useState("");
  const [shareMsg, setShareMsg] = useState("");

  const refresh = useCallback(() => {
    getLiHostToday().then(setToday).catch(() => setErr("无法连接后端"));
    getLiHostLeaderboard(8).then(setBoard).catch(() => {});
  }, []);

  useEffect(refresh, [refresh]);

  const play = (key: string) => {
    setCurrentKey(key);
    setScores(null);
    setDetail(null);
    setResult(null);
    setShareMsg("");
    setView("playing");
  };

  const backToHub = () => {
    setView("hub");
    setCurrentKey("");
    refresh();
  };

  const handleFinish = async (s: LiHostScores, d: LiHostRoundDetail) => {
    setScores(s);
    setDetail(d);
    setView("result");
    try {
      const r = await submitLiHostResult(currentKey, s);
      setResult(r);
    } catch {
      setErr("结算上报失败，分数未入账");
    }
  };

  const shareResult = async () => {
    if (!scores || !result) return;
    const cfg = liHostScenario(currentKey);
    const text = `执礼 · ${cfg.title} — ${result.grade} ${result.total} 分（敬${scores.jing}·序${scores.xu}·节${scores.jie}）`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "执礼 · 宾至如归", text });
      } else {
        await navigator.clipboard.writeText(text);
        setShareMsg("成绩已复制到剪贴板");
      }
    } catch {
      setShareMsg("分享已取消");
    }
  };

  if (view === "playing" && currentKey) {
    return <Li3DGame scenarioKey={currentKey} onExit={backToHub} onFinish={handleFinish} />;
  }

  if (view === "result" && currentKey && scores && detail) {
    return (
      <div className="space-y-3">
        {err && <div className="rounded-lg bg-accent-soft p-3 text-xs text-accent">{err}</div>}
        <ResultView
          scenarioKey={currentKey}
          scores={scores}
          detail={detail}
          result={result}
          shareMsg={shareMsg}
          onShare={shareResult}
          onBack={backToHub}
        />
      </div>
    );
  }

  return (
    <HubView
      today={today}
      board={board}
      err={err}
      onPlay={play}
    />
  );
}

function HubView({
  today,
  board,
  err,
  onPlay,
}: {
  today: LiHostTodayResp | null;
  board: LiHostLeaderboardResp | null;
  err: string;
  onPlay: (key: string) => void;
}) {
  const state = new Map<string, LiHostStateItem>(
    (today?.scenarios ?? []).map((s) => [s.key, s]),
  );
  const liScore = today?.progress.liuyi_li ?? 0;

  if (err) {
    return <div className="rounded-lg bg-accent-soft p-4 text-sm text-accent">{err}</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/journey" className="text-xs text-faint hover:text-accent">
          ← 君子之路
        </Link>
        <div className="font-serif text-lg text-fg">礼 · 执礼</div>
        <div className="w-16" />
      </div>

      {/* 修行场 hub */}
      <section className="relative overflow-hidden rounded-xl border border-line bg-gradient-to-br from-[#5c5046] via-[#7a6b5c] to-[#4a4038] p-5 text-[#f5efe6]">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/15 blur-2xl" />
        <div className="relative flex flex-wrap items-end gap-4">
          <div className="flex-1">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#e8b87a]/80">礼部修行场</div>
            <div className="font-serif text-3xl">执礼 · 宾至如归</div>
            <div className="mt-1 text-xs text-[#f5efe6]/65">第一人称 3D 宾主厅 · 揖礼有深浅 · 席位有尊卑 · 席间有时机</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#ffffff22" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none" stroke="#e8b87a" strokeWidth="3"
                  strokeDasharray={`${liScore * 0.94} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="mt-1 text-[10px] text-[#e8b87a]">六艺·礼 {liScore}</div>
            </div>
            {today && (
              <div className="space-y-1 text-right text-xs">
                <div>儒分 <span className="font-serif text-base text-[#e8b87a]">{today.progress.ru_score}</span></div>
                <div>情分 <span className="font-serif text-base text-[#e8b87a]">{today.progress.qing_score}</span></div>
              </div>
            )}
          </div>
        </div>
        <p className="relative mt-3 max-w-2xl text-sm leading-relaxed text-[#f5efe6]/75">
          站在宾主厅中，对面就是宾客。按住作揖感受深浅，安排尊卑位次，在全场气氛里把握照应时机——
          无事频扰，反失于「节」。
        </p>
      </section>

      {/* 雅集列表 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-faint">五场雅集 · 由浅入深</div>
          <div className="text-[10px] text-faint">敬 · 序 · 节 几何平均计分</div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {LI_HOST_SCENARIOS.map((cfg) => {
            const st = state.get(cfg.key);
            return (
              <button
                key={cfg.key}
                type="button"
                onClick={() => onPlay(cfg.key)}
                className="group relative overflow-hidden rounded-lg border border-line bg-surface p-4 text-left transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                style={{ borderLeftWidth: 4, borderLeftColor: "#993C1D" }}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] text-accent">
                    {DIFF_LABEL[cfg.difficulty]}
                  </span>
                  {st?.ref_unlocked && (
                    <span className="rounded-full bg-cel-soft px-2 py-0.5 text-[10px] text-cel-ink">经典已解锁</span>
                  )}
                  {st?.played_today && (
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">今日已计分</span>
                  )}
                </div>
                <h3 className="mt-2 font-serif text-lg font-medium text-fg">{cfg.title}</h3>
                <div className="text-[11px] text-faint">{cfg.subtitle}</div>
                <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{cfg.intro}</p>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-[11px] text-faint">
                    {st && st.plays > 0 ? `已赴 ${st.plays} 局` : "尚未赴宴"}
                  </span>
                  {st?.best_total != null && (
                    <span
                      className="font-serif text-sm"
                      style={{ color: GRADE_COLOR[st.best_grade ?? ""] ?? "#6b7280" }}
                    >
                      最佳 {st.best_total} · {st.best_grade}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 排行 */}
      {board && board.items.length > 0 && (
        <section className="rounded-lg border border-line bg-surface p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <div className="font-serif text-base text-fg">执礼排行</div>
            <div className="text-[10px] text-faint">{board.note}</div>
          </div>
          <div className="space-y-1.5">
            {board.items.map((it) => (
              <div
                key={it.rank}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                  it.is_self ? "bg-accent-soft text-accent-ink" : "bg-surface-2/40 text-muted"
                }`}
              >
                <span className="w-6 font-serif text-faint">{it.rank}</span>
                <span className="flex-1 font-medium">{it.name}</span>
                <span className="font-serif" style={{ color: GRADE_COLOR[it.best_grade] ?? "#6b7280" }}>
                  {it.best_total}
                </span>
                <span className="text-[10px] text-faint">{it.best_grade}</span>
              </div>
            ))}
          </div>
          {board.self && !board.items.some((i) => i.is_self) && (
            <div className="mt-2 rounded-lg border border-dashed border-accent/40 px-3 py-2 text-xs text-accent">
              你的最佳：{board.self.best_total} · {board.self.best_grade}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ResultView({
  scenarioKey,
  scores,
  detail,
  result,
  shareMsg,
  onShare,
  onBack,
}: {
  scenarioKey: string;
  scores: LiHostScores;
  detail: LiHostRoundDetail;
  result: LiHostResultResp | null;
  shareMsg: string;
  onShare: () => void;
  onBack: () => void;
}) {
  const cfg = liHostScenario(scenarioKey);
  const total = result?.total ?? geomTotal(scores);
  const grade = result?.grade ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-faint hover:text-accent">
          ← 回到修行场
        </button>
        <div className="text-xs text-faint">{cfg.title} · 结算</div>
      </div>

      <section className="rounded-lg border-2 border-accent bg-accent-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent">礼成</div>
            <h2 className="mt-1 font-serif text-2xl text-accent-ink">{grade || "结算中…"}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{cfg.lesson}</p>
            {detail.highlight && (
              <p className="mt-2 rounded-lg bg-surface/60 px-3 py-2 text-xs text-accent-ink">{detail.highlight}</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] text-accent">总分 · 全场气氛 {detail.atmosphere}</div>
            <div className="font-serif text-4xl text-accent-ink">{total}</div>
            {result && !result.score_applied && (
              <div className="mt-1 text-[10px] text-faint">今日此场已计过分</div>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Meter label="敬 · 揖礼深浅" value={scores.jing} color="#993C1D" />
          <Meter label="序 · 先后与位次" value={scores.xu} color="#854F0B" />
          <Meter label="节 · 时机与克己" value={scores.jie} color="#0F6E56" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint">本局回看</div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
            <li>迎宾先后 {detail.orderScore} · 席位 {detail.seatScore}</li>
            {detail.bows.map((b, i) => (
              <li key={`b${i}`}>揖 {b.guest} — {b.verdict}（{b.score}）</li>
            ))}
            {detail.events.map((e, i) => (
              <li key={`e${i}`}>{e.label} — {e.verdict}（{e.score}）</li>
            ))}
            {detail.overActs > 0 && (
              <li className="text-accent">殷勤过度 ×{detail.overActs}</li>
            )}
          </ul>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint">入账</div>
          {result ? (
            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
              <li>儒分 +{result.ru_delta} · 情分 +{result.qing_delta}</li>
              <li>六艺·礼 +{result.li_delta}（当前 {result.progress.liuyi_li}）</li>
              <li>修行 XP +{result.xp_delta}</li>
            </ul>
          ) : (
            <div className="mt-2 text-xs text-faint">上报中…</div>
          )}
        </div>
      </section>

      {result && result.new_unlocked_refs.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs text-faint">解锁经典</div>
          {result.new_unlocked_refs.map((ref) => (
            <div key={ref.ref_id} className="rounded-r-lg border-l-[3px] border-accent bg-accent-soft px-3 py-2">
              <div className="font-serif text-sm leading-relaxed text-accent-ink">{ref.text}</div>
              <div className="mt-1 text-[10px] text-accent">{ref.ref_label}</div>
            </div>
          ))}
        </section>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onShare}
          className="flex-1 rounded-lg border border-line bg-surface py-3 text-sm text-fg hover:bg-surface-2"
        >
          分享成绩
        </button>
        <button type="button" onClick={onBack} className="flex-1 rounded-lg bg-accent py-3 text-sm font-medium text-white">
          回到修行场
        </button>
      </div>
      {shareMsg && <p className="text-center text-xs text-faint">{shareMsg}</p>}
    </div>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-faint">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
      </div>
    </div>
  );
}
