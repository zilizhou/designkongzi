"use client";

/**
 * 乐艺·五音合鸣
 *
 * 流程：选场景 → 看情志提示 → 从五音库点选 8 个填入节奏槽 →
 *      试听 → 满意后提交 → 后端三维评分（和谐 / 合情志 / 节度）
 *
 * 音频：Web Audio API 实时合成 — 每音 sine + 2 泛音模拟编钟音色，
 *      无需预录素材，包体几乎不增加。
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getYueProgress, getYueToday, playYueScenario } from "@/lib/api";
import type {
  YueNote,
  YuePlayResp,
  YueProgressResp,
  YueRefBrief,
  YueTodayResp,
} from "@/lib/types";

// 五音对应频率（C4 大调五声音阶：宫=C 商=D 角=E 徵=G 羽=A）
const NOTE_FREQ: Record<YueNote, number> = {
  gong: 261.63,   // C4
  shang: 293.66,  // D4
  jue: 329.63,    // E4
  zhi: 392.00,    // G4
  yu: 440.00,     // A4
};
const NOTES: YueNote[] = ["gong", "shang", "jue", "zhi", "yu"];
// 休止符 token（与后端 REST 对齐）— 槽位可以填它表示留空一拍
const REST = "rest" as const;
type YueSlotValue = YueNote | typeof REST | null;
const NOTE_INFO: Record<YueNote, { label: string; pinyin: string; color: string; desc: string }> = {
  gong: { label: "宫", pinyin: "gōng", color: "#854F0B", desc: "中正沉稳" },
  shang: { label: "商", pinyin: "shāng", color: "#0F6E56", desc: "明朗肃然" },
  jue: { label: "角", pinyin: "jué", color: "#534AB7", desc: "舒展清扬" },
  zhi: { label: "徵", pinyin: "zhǐ", color: "#1E5F8E", desc: "明亮欢悦" },
  yu: { label: "羽", pinyin: "yǔ", color: "#993C1D", desc: "高亢悠远" },
};
const SLOTS = 32;
const TEMPO_MS = 320;   // 单拍时长（32 拍 × 320ms ≈ 10s）

// ── Web Audio 单例 ──
let _audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_audioCtx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    _audioCtx = new Ctor();
  }
  return _audioCtx;
}

/** 模拟编钟音色：基音 + 2 个泛音 + ADSR 包络 */
function playNote(note: YueNote, when: number = 0, duration: number = 0.5) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  // resume 一下（用户首次交互后才允许播放）
  if (ctx.state === "suspended") ctx.resume();
  const t0 = ctx.currentTime + when;
  const freq = NOTE_FREQ[note];

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  // ADSR
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.25, t0 + 0.02);            // attack 20ms
  gain.gain.exponentialRampToValueAtTime(0.15, t0 + 0.1);        // decay
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);  // release

  // 基音 + 二倍 + 三倍（递减振幅）
  [{ ratio: 1.0, gain: 1.0 }, { ratio: 2.0, gain: 0.35 }, { ratio: 3.0, gain: 0.18 }].forEach(({ ratio, gain: g }) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq * ratio;
    const subGain = ctx.createGain();
    subGain.gain.value = g;
    osc.connect(subGain).connect(gain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.1);
  });
}

function playSequence(seq: YueSlotValue[]) {
  let when = 0;
  for (const n of seq) {
    // null（未填）和 rest（休止）都不发声，但仍占一拍
    if (n && n !== REST) playNote(n, when, TEMPO_MS / 1000 * 0.95);
    when += TEMPO_MS / 1000;
  }
}

export default function YueJourneyPage() {
  const [today, setToday] = useState<YueTodayResp | null>(null);
  const [progress, setProgress] = useState<YueProgressResp | null>(null);
  const [idx, setIdx] = useState(0);
  const [slots, setSlots] = useState<YueSlotValue[]>(Array(SLOTS).fill(null));
  const [result, setResult] = useState<YuePlayResp | null>(null);
  const [playingIdx, setPlayingIdx] = useState<number>(-1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getYueToday().then(setToday).catch(() => setErr("无法加载乐题 — 请先登录"));
    getYueProgress().then(setProgress).catch(() => {});
  }, []);

  const current = today?.scenarios[idx];

  // 切换场景时清空槽位
  useEffect(() => {
    if (current) {
      setSlots(Array(SLOTS).fill(null));
      setResult(null);
    }
  }, [current?.id]);

  const pickNote = (note: YueNote) => {
    if (result) return;
    const i = slots.findIndex((s) => s === null);
    if (i < 0) return;
    setSlots((prev) => {
      const next = [...prev];
      next[i] = note;
      return next;
    });
    playNote(note, 0, 0.4);   // 单音试听
  };

  const pickRest = () => {
    if (result) return;
    const i = slots.findIndex((s) => s === null);
    if (i < 0) return;
    setSlots((prev) => {
      const next = [...prev];
      next[i] = REST;
      return next;
    });
    // 休止不发声
  };

  const clearSlot = (i: number) => {
    if (result) return;
    setSlots((prev) => {
      const next = [...prev];
      next[i] = null;
      return next;
    });
  };
  const clearAll = () => {
    if (result) return;
    setSlots(Array(SLOTS).fill(null));
  };

  // 全部填满（无 null）即可提交；但若全是 rest 后端会拒
  const allFilled = slots.every((s) => s !== null);
  const noteCount = slots.filter((s) => s && s !== REST).length;

  const playPreview = async () => {
    // 视觉同步：依次高亮播放位；rest/null 不发声但仍占一拍
    setPlayingIdx(-1);
    for (let i = 0; i < slots.length; i++) {
      const n = slots[i];
      setPlayingIdx(i);
      if (n && n !== REST) playNote(n, 0, TEMPO_MS / 1000 * 0.95);
      await new Promise((r) => setTimeout(r, TEMPO_MS));
    }
    setPlayingIdx(-1);
  };

  const onSubmit = async () => {
    if (!current || !allFilled || busy) return;
    if (noteCount < 4) {
      setErr("至少要有 4 个音 — 不能几乎全是休止");
      return;
    }
    setBusy(true);
    try {
      // 把 slots（YueSlotValue[]）当作 string[] 传给后端 — 含 "rest"
      const r = await playYueScenario(current.id, slots as YueNote[]);
      setResult(r);
      playSequence(slots);
      getYueProgress().then(setProgress).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy(false);
    }
  };

  const onNext = () => {
    if (!today) return;
    setIdx((i) => (i < today.scenarios.length - 1 ? i + 1 : 0));
  };

  const distribution = useMemo(() => {
    const d: Record<string, number> = {};
    const n = slots.filter((s) => s && s !== REST).length;   // 分母只算五音，不含 rest
    if (n === 0) return d;
    for (const note of NOTES) {
      d[note] = slots.filter((s) => s === note).length / n;
    }
    return d;
  }, [slots]);

  if (err) return <div className="rounded-2xl bg-accent-soft p-6 text-sm text-accent">{err}</div>;
  if (!today || !current) return <div className="skeleton h-60 w-full rounded-2xl" />;

  return (
    <div className="space-y-4">
      {/* HUD */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-accent">六艺 · 乐</div>
            <div className="font-serif text-lg text-fg">五音合鸣 · 为情志奏一段乐</div>
            <div className="mt-1 text-[10px] text-muted">
              「乐而不淫，哀而不伤」— 和而不同，方为雅正
            </div>
          </div>
          {progress && (
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <Stat label="称号" value={progress.title} />
              <Stat label="乐艺" value={`${progress.liuyi_yue}`} />
              <Stat label="奏过" value={`${progress.played_count}/${progress.total_scenarios}`} />
              <Stat label="最高" value={`${progress.best_score}`} />
            </div>
          )}
          <Link
            href="/journey"
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
          >
            ← 六艺
          </Link>
        </div>
      </section>

      {/* 主关卡 */}
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        {/* 场景卡 */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="rounded-xl bg-accent-soft px-4 py-3 min-w-[140px]">
            <div className="text-[10px] uppercase tracking-widest text-accent">SCENARIO {idx + 1}</div>
            <div className="mt-1 font-serif text-xl text-accent-ink">{current.title}</div>
            <div className="mt-1 text-xs text-accent">{current.mood_label}</div>
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-fg">{current.setting}</p>
            <p className="text-[11px] text-muted">💡 {current.hint}</p>
          </div>
        </div>

        {/* 8 拍节奏槽 */}
        <div className="rounded-xl border border-line bg-surface-2/40 p-4">
          <div className="mb-2 flex items-center justify-between text-[10px] text-muted">
            <span>三十二拍节奏槽（点空槽 → 五音填入；点已填可清空）</span>
            <span>{slots.filter((s) => s).length} / {SLOTS}</span>
          </div>
          <div className="grid grid-cols-8 gap-1 sm:gap-1.5 sm:grid-cols-[repeat(16,minmax(0,1fr))]">
            {slots.map((s, i) => (
              <button
                key={i}
                onClick={() => clearSlot(i)}
                disabled={!!result}
                className={`flex aspect-square items-center justify-center rounded-md border font-serif text-base transition-all sm:text-lg ${
                  playingIdx === i
                    ? "scale-125 border-amber-500 bg-amber-100 shadow-lg z-10"
                    : s === REST
                    ? "border-line bg-surface-2/60 text-muted"
                    : s
                    ? "border-line bg-white"
                    : "border-dashed border-line bg-surface-2/30 text-faint"
                } ${i % 8 === 0 && i > 0 ? "ml-1" : ""}`}
                style={s && s !== REST ? { color: NOTE_INFO[s].color } : undefined}
                title={`第 ${i + 1} 拍${
                  s === REST
                    ? "：休止（留空）"
                    : s
                    ? `：${NOTE_INFO[s].label} ${NOTE_INFO[s].pinyin}`
                    : "（未填）"
                }`}
              >
                {s === REST ? (
                  <span className="text-xl text-muted">·</span>
                ) : s ? (
                  NOTE_INFO[s].label
                ) : (
                  <span className="text-[8px] opacity-60">{i + 1}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 五音库 + 休止 */}
        {!result && (
          <div className="rounded-xl border border-line bg-surface-2/30 p-4">
            <div className="mb-2 text-[10px] text-muted">
              五音库（点击填入下一个空槽，同时试听）· 末尾「歇」是休止符（留空一拍）
            </div>
            <div className="grid grid-cols-6 gap-2">
              {NOTES.map((n) => {
                const info = NOTE_INFO[n];
                return (
                  <button
                    key={n}
                    onClick={() => pickNote(n)}
                    className="group flex flex-col items-center gap-1 rounded-lg border-2 bg-white px-2 py-3 transition-all hover:shadow-md active:scale-95"
                    style={{ borderColor: info.color }}
                  >
                    <span className="font-serif text-3xl" style={{ color: info.color }}>
                      {info.label}
                    </span>
                    <span className="text-[10px]" style={{ color: info.color }}>{info.pinyin}</span>
                    <span className="text-[9px] text-faint">{info.desc}</span>
                  </button>
                );
              })}
              {/* 休止符按钮 */}
              <button
                onClick={pickRest}
                className="group flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-muted bg-surface-2/40 px-2 py-3 transition-all hover:shadow-md hover:border-fg active:scale-95"
                title="休止 — 留空一拍"
              >
                <span className="font-serif text-3xl text-muted">·</span>
                <span className="text-[10px] text-muted">xiē</span>
                <span className="text-[9px] text-faint">歇 留白</span>
              </button>
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap justify-center gap-3">
          <button
            onClick={playPreview}
            disabled={!slots.some((s) => s)}
            className="rounded-full border border-line bg-surface-2 px-5 py-2 text-sm text-muted hover:bg-surface disabled:opacity-40"
          >
            ▶ 试听
          </button>
          {!result && (
            <>
              <button
                onClick={clearAll}
                disabled={!slots.some((s) => s)}
                className="rounded-full border border-line bg-surface-2 px-5 py-2 text-sm text-muted hover:bg-surface disabled:opacity-40"
              >
                清空
              </button>
              <button
                disabled={!allFilled || busy}
                onClick={onSubmit}
                className={`rounded-full px-6 py-2 text-sm font-medium ${
                  allFilled
                    ? "bg-accent text-white hover:opacity-90"
                    : "bg-surface-2 text-faint"
                }`}
              >
                {busy ? "评判中…" : "提交并评分"}
              </button>
            </>
          )}
          {result && (
            <button
              onClick={onNext}
              className="rounded-full bg-accent px-6 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              下一场景 →
            </button>
          )}
        </div>

        {/* 当前分布（未提交也实时显示） */}
        {Object.keys(distribution).length > 0 && !result && (
          <div className="rounded-lg bg-surface-2/30 p-3">
            <div className="mb-1 text-[10px] text-muted">当前五音分布</div>
            <div className="flex h-3 overflow-hidden rounded-full">
              {NOTES.map((n) => {
                const w = (distribution[n] || 0) * 100;
                if (w === 0) return null;
                return (
                  <div
                    key={n}
                    style={{ width: `${w}%`, background: NOTE_INFO[n].color }}
                    title={`${NOTE_INFO[n].label} ${w.toFixed(0)}%`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 评分展开 */}
      {result && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
          {/* 评分大牌 */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white/70 p-4">
            <div className="flex items-baseline gap-3">
              <span
                className="font-serif leading-none"
                style={{ fontSize: "3.5rem", color: gradeColor(result.grade) }}
              >
                {result.score}
              </span>
              <span className="text-xs text-muted">/ 100</span>
              <span
                className="rounded-full px-3 py-1 text-sm text-white"
                style={{ background: gradeColor(result.grade) }}
              >
                {result.grade}
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <MetricBar label="和谐（五音相生）" value={result.harmony} color={gradeColor(result.grade)} />
              <MetricBar label="合情志（贴近目标）" value={result.mood_match} color={gradeColor(result.grade)} />
              <MetricBar label="节度（乐而不淫）" value={result.moderation} color={gradeColor(result.grade)} />
            </div>
          </div>

          <div className="mb-2 text-sm font-medium text-emerald-900">
            乐艺 +{result.yue_delta} · xp +{result.xp_delta}
          </div>

          {/* 解锁经典 */}
          {result.new_unlocked_refs.length > 0 ? (
            <div className="mt-3 rounded-lg border border-gold bg-amber-50 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-amber-700">🎖 新解锁经典</div>
              {result.new_unlocked_refs.map((r: YueRefBrief) => (
                <div key={r.ref_id} className="mt-1 border-l-2 border-amber-500 pl-2 text-sm text-amber-900">
                  <div className="text-[10px] opacity-70">{r.ref_label}</div>
                  <div className="font-serif">{r.text}</div>
                </div>
              ))}
            </div>
          ) : result.refs.length > 0 ? (
            <div className="mt-3 rounded-lg border border-line bg-surface-2/30 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-faint">关联经典</div>
              {result.refs.map((r) => (
                <div key={r.ref_id} className="mt-1 text-xs">
                  <span className="text-faint">{r.ref_label}：</span>
                  <span className="font-serif text-fg">{r.text}</span>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      )}

      {/* 已奏场景一览 */}
      {progress && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-fg">乐艺进境 · 场景一览</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {progress.scenarios.map((s) => (
              <div
                key={s.id}
                className={`rounded-lg border p-2 text-center text-xs ${
                  s.answered ? "border-gold bg-accent-soft" : "border-line bg-surface-2/40 text-faint"
                }`}
                title={s.setting}
              >
                <div className="font-serif text-sm text-fg">{s.title}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.mood_label}</div>
                <div className="mt-0.5 text-[10px]">
                  {s.answered ? `🏅 最高 ${s.best_score}` : "未奏"}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1">
      <div className="text-[10px] text-faint">{label}</div>
      <div className="font-serif text-sm text-fg">{value}</div>
    </div>
  );
}
function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className="min-w-[180px]">
      <div className="mb-0.5 flex justify-between text-[10px] text-muted">
        <span>{label}</span>
        <span style={{ color }}>{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
function gradeColor(grade: string): string {
  switch (grade) {
    case "神和": return "#b45309";
    case "协律": return "#0F6E56";
    case "中和": return "#1E5F8E";
    case "试律": return "#534AB7";
    default:     return "#737373";
  }
}
