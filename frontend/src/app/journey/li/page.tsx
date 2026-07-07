"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getLiHostToday, submitLiHostResult } from "@/lib/api";
import type { LiHostResultResp, LiHostScores, LiHostStateItem, LiHostTodayResp } from "@/lib/types";
import LiPhaserGame, { LI_HOST_SCENARIOS, liHostScenario } from "./LiPhaserGame";
import type { LiHostRoundDetail } from "./LiPhaserGame";

type View = "list" | "playing" | "result";

const DIFF_LABEL = ["", "入门", "初阶", "进阶", "高阶", "终局"];

const GRADE_COLOR: Record<string, string> = {
  礼之大成: "#993C1D",
  君子儒: "#854F0B",
  守礼君子: "#0F6E56",
  通情达人: "#1E5F8E",
  习礼者: "#6b7280",
};

export default function LiGamePage() {
  const [view, setView] = useState<View>("list");
  const [today, setToday] = useState<LiHostTodayResp | null>(null);
  const [currentKey, setCurrentKey] = useState<string>("");
  const [scores, setScores] = useState<LiHostScores | null>(null);
  const [detail, setDetail] = useState<LiHostRoundDetail | null>(null);
  const [result, setResult] = useState<LiHostResultResp | null>(null);
  const [err, setErr] = useState("");

  const refresh = useCallback(() => {
    getLiHostToday().then(setToday).catch(() => setErr("无法连接后端"));
  }, []);

  useEffect(refresh, [refresh]);

  const play = (key: string) => {
    setCurrentKey(key);
    setScores(null);
    setDetail(null);
    setResult(null);
    setView("playing");
  };

  const backToList = () => {
    setView("list");
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

  if (err && view === "list") {
    return <div className="rounded-lg bg-accent-soft p-4 text-sm text-accent">{err}</div>;
  }

  if (view === "playing" && currentKey) {
    return <LiPhaserGame scenarioKey={currentKey} onExit={backToList} onFinish={handleFinish} />;
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
          onBack={backToList}
        />
      </div>
    );
  }

  return <ListView today={today} onPlay={play} />;
}

function ListView({
  today,
  onPlay,
}: {
  today: LiHostTodayResp | null;
  onPlay: (key: string) => void;
}) {
  const state = new Map<string, LiHostStateItem>(
    (today?.scenarios ?? []).map((s) => [s.key, s]),
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/journey" className="text-xs text-faint hover:text-accent">
          ← 君子之路
        </Link>
        <div className="font-serif text-lg text-fg">礼 · 执礼</div>
        <div className="w-16" />
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="font-serif text-3xl text-fg">执礼 · 宾至如归</div>
            <div className="mt-1 text-xs text-faint">迎宾有先后 · 揖礼有深浅 · 席位有尊卑 · 应对有时机</div>
          </div>
          {today && (
            <div className="ml-auto flex gap-5 text-right">
              <ScoreBlock label="儒分" value={today.progress.ru_score} color="#993C1D" />
              <ScoreBlock label="情分" value={today.progress.qing_score} color="#0F6E56" />
              <ScoreBlock label="六艺·礼" value={today.progress.liuyi_li} color="#854F0B" />
            </div>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          你是一场雅集的主人。礼不是选择题，而是手上的分寸：作揖过深近谄、过浅近慢；
          席间照应太急则躁、太慢则怠——而无事频频打扰，恰恰失于「节」。
          三维评分取几何平均：敬 · 序 · 节，任何一维短了，都成不了礼。
        </p>
      </section>

      <section>
        <div className="mb-2 text-xs text-faint">五场雅集 · 由浅入深</div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {LI_HOST_SCENARIOS.map((cfg) => {
            const st = state.get(cfg.key);
            return (
              <button
                key={cfg.key}
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
    </div>
  );
}

function ResultView({
  scenarioKey,
  scores,
  detail,
  result,
  onBack,
}: {
  scenarioKey: string;
  scores: LiHostScores;
  detail: LiHostRoundDetail;
  result: LiHostResultResp | null;
  onBack: () => void;
}) {
  const cfg = liHostScenario(scenarioKey);
  const total = result?.total ?? Math.round((Math.max(scores.jing, 1) * Math.max(scores.xu, 1) * Math.max(scores.jie, 1)) ** (1 / 3));
  const grade = result?.grade ?? "";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-faint hover:text-accent">
          ← 回到雅集
        </button>
        <div className="text-xs text-faint">{cfg.title} · 结算</div>
      </div>

      <section className="rounded-lg border-2 border-accent bg-accent-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent">礼成</div>
            <h2 className="mt-1 font-serif text-2xl text-accent-ink">
              {grade || "结算中…"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{cfg.lesson}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-accent">总分（敬·序·节 几何平均）</div>
            <div className="font-serif text-4xl text-accent-ink">{total}</div>
            {result && !result.score_applied && (
              <div className="mt-1 text-[10px] text-faint">今日此场已计过分，本局不重复入账</div>
            )}
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Meter label={`敬 · 揖礼深浅`} value={scores.jing} color="#993C1D" />
          <Meter label={`序 · 先后与位次`} value={scores.xu} color="#854F0B" />
          <Meter label={`节 · 时机与克己`} value={scores.jie} color="#0F6E56" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-faint">本局回看</div>
          <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
            <li>迎宾先后：{detail.orderScore} 分 · 席位安排：{detail.seatScore} 分</li>
            {detail.bows.map((b, i) => (
              <li key={`b${i}`}>揖 {b.guest} — {b.verdict}（{b.score}）</li>
            ))}
            {detail.events.map((e, i) => (
              <li key={`e${i}`}>{e.label} — {e.verdict}（{e.score}）</li>
            ))}
            {detail.overActs > 0 && (
              <li className="text-accent">殷勤过度 ×{detail.overActs} — 无事频扰，失于节</li>
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
          <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-faint">执礼何以为礼</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            你练的是分寸本身：躬身的深浅、迎送的先后、出手的时机。
            礼不是外在的规矩表演，而是把「把人放在心上」变成可以拿捏的动作。
          </p>
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
      {result && result.new_unlocked_refs.length === 0 && result.scenario_ref && total < 55 && (
        <section className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-faint">
          总分达到 55 可解锁本场经典《{result.scenario_ref.ref_label}》——再赴一局试试。
        </section>
      )}

      <button onClick={onBack} className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white">
        回到雅集
      </button>
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

function ScoreBlock({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="font-serif text-2xl" style={{ color }}>{value}</div>
      <div className="text-[10px] text-faint">{label}</div>
    </div>
  );
}
