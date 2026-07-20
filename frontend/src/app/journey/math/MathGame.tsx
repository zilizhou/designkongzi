"use client";

/**
 * 数艺·量仓分赈 — 3D 分粮（Three.js / React Three Fiber）
 *
 * 操作：←→/AD 切换目标村 · ↑/W 按住出粮 · ↓/S 按住回粮 · Enter 封仓验收
 *       手机：◀ ▶ 切换 + 出粮/回粮按住按钮 + 封仓验收
 *
 * 后端契约：POST /math/scenario/{sid}/solve（allocations 全项，三维评分）。
 * 游戏数值由 mathEngine 在场景 useFrame 推进；React 只管 HUD / 卡片。
 */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { getMathProgress, getMathToday, solveMathScenario } from "@/lib/api";
import type {
  MathProgressResp,
  MathScenarioBrief,
  MathSolveResp,
  MathTodayResp,
} from "@/lib/types";
import { allocatedSum, createEngine, finalizeAllocations, remaining, selectDelta, setAlloc } from "./mathEngine";
import { createMathRefs, MathScene, KIND_COLOR, type MathRefs } from "./mathScene";
import * as sfx from "./mathAudio";

type Phase = "idle" | "playing" | "submitting" | "scored";

const GRADE_COLOR: Record<string, string> = {
  衡均: "#0F6E56", 通算: "#1E5F8E", 中算: "#854F0B", 试算: "#993C1D", 学算: "#6b6046",
};

interface MathDebugHook {
  set: (name: string, v: number) => void;
  setAll: (obj: Record<string, number>) => void;
  select: (i: number) => void;
  state: () => { allocations: Record<string, number>; remaining: number; selected: number };
  submit: () => void;
}
declare global {
  interface Window { __math?: MathDebugHook }
}

export default function MathGame() {
  const [today, setToday] = useState<MathTodayResp | null>(null);
  const [progress, setProgress] = useState<MathProgressResp | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [current, setCurrent] = useState<MathScenarioBrief | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [runId, setRunId] = useState(0);
  const [result, setResult] = useState<MathSolveResp | null>(null);
  const [toast, setToast] = useState<{ text: string; good: boolean } | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  const [g] = useState(() => createMathRefs());
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(() => {
    getMathToday().then(setToday).catch(() => setLoadErr("无法加载数艺题库 — 请先登录"));
    getMathProgress().then(setProgress).catch(() => {});
  }, []);
  useEffect(() => { loadAll(); }, [loadAll]);

  const say = useCallback((text: string, good: boolean) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ text, good });
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  }, []);

  // ── 开局 ──
  const startScenario = useCallback((s: MathScenarioBrief) => {
    g.engine = createEngine(s);
    g.input = { pour: false, scoop: false };
    g.running = true;
    setCurrent(s);
    setResult(null);
    setShowGuide(true);
    setRunId((i) => i + 1);
    setPhase("playing");
    setTimeout(() => setShowGuide(false), 6500);
  }, [g]);

  // ── 切换目标村 ──
  const switchVillage = useCallback((dir: number) => {
    if (phaseRef.current !== "playing" || !g.engine) return;
    selectDelta(g.engine, dir);
    sfx.switchVillage();
  }, [g]);

  // ── 封仓验收 → 提交 ──
  const submitRef = useRef<() => void>(() => {});
  const submit = useCallback(async () => {
    if (phaseRef.current !== "playing" || !current || !g.engine) return;
    g.running = false;
    g.input.pour = false;
    g.input.scoop = false;
    sfx.setPouring(false);
    sfx.bell();
    setPhase("submitting");
    try {
      const res = await solveMathScenario(current.id, finalizeAllocations(g.engine));
      setResult(res);
      sfx.finish(res.score);
      setPhase("scored");
      getMathProgress().then(setProgress).catch(() => {});
      getMathToday().then(setToday).catch(() => {});
    } catch {
      say("提交失败 — 请检查登录/网络", false);
      setPhase("playing");
      g.running = true;
    }
  }, [current, g, say]);
  submitRef.current = submit;

  // ── 调试钩子（CDP 测试用） ──
  useEffect(() => {
    window.__math = {
      set: (name, v) => { if (g.engine) setAlloc(g.engine, name, v); },
      setAll: (obj) => { if (g.engine) for (const [k, v] of Object.entries(obj)) setAlloc(g.engine, k, v); },
      select: (i) => {
        if (g.engine) {
          const n = g.engine.scenario.items.length;
          g.engine.selected = ((i % n) + n) % n;
        }
      },
      state: () => ({
        allocations: { ...(g.engine?.allocations ?? {}) },
        remaining: g.engine ? remaining(g.engine) : -1,
        selected: g.engine?.selected ?? -1,
      }),
      submit: () => submitRef.current(),
    };
    return () => { delete window.__math; };
  }, [g]);

  // ── 键盘 ──
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (phaseRef.current !== "playing") return;
      const el = document.activeElement;
      if (el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT")) return;
      switch (e.code) {
        case "ArrowUp": case "KeyW": g.input.pour = true; e.preventDefault(); break;
        case "ArrowDown": case "KeyS": g.input.scoop = true; e.preventDefault(); break;
        case "ArrowLeft": case "KeyA":
          if (!e.repeat) switchVillage(-1);
          e.preventDefault(); break;
        case "ArrowRight": case "KeyD":
          if (!e.repeat) switchVillage(1);
          e.preventDefault(); break;
        case "Enter":
          if (!e.repeat) void submitRef.current();
          e.preventDefault(); break;
      }
    };
    const ku = (e: KeyboardEvent) => {
      switch (e.code) {
        case "ArrowUp": case "KeyW": g.input.pour = false; break;
        case "ArrowDown": case "KeyS": g.input.scoop = false; break;
      }
    };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, [g, switchVillage]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    sfx.stopAll();
  }, []);

  const backToSelect = useCallback(() => {
    g.running = false;
    sfx.stopAll();
    setPhase("idle");
    setCurrent(null);
    setResult(null);
    loadAll();
  }, [g, loadAll]);

  const bestMap = new Map(progress?.scenarios.map((s) => [s.id, s.best_score]) ?? []);

  return (
    <div className="space-y-3">
      {/* 顶部 HUD */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-accent">六艺 · 数</div>
            <div className="font-serif text-xl text-fg">量仓分赈 · 均输衰分</div>
            <div className="mt-1 text-xs text-muted">出粮入斗 · 按权重均分 · 封仓验收定等第</div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            {progress && <Stat label="称号" value={progress.title} />}
            {progress && <Stat label="数艺" value={`${progress.liuyi_shu2}`} />}
            {progress && <Stat label="最佳" value={`${progress.best_score}`} />}
            <Link href="/journey" className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2">
              ← 六艺
            </Link>
          </div>
        </div>
      </section>

      {loadErr && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadErr} — <Link href="/login" className="underline">去登录</Link>
        </section>
      )}

      {/* 关卡选择（横向卡条） */}
      {phase === "idle" && today && (
        <section>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {today.scenarios.map((s) => {
              const best = bestMap.get(s.id) ?? 0;
              const color = KIND_COLOR[s.kind] ?? "#2b2925";
              return (
                <button
                  key={s.id}
                  onClick={() => startScenario(s)}
                  className="min-w-[230px] max-w-[230px] shrink-0 rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-accent hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: color }}>
                      {s.kind_label}
                    </span>
                    <span className="flex gap-1">
                      {s.done_today && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700">今日已校 ✓</span>}
                      {best > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted">最佳 {best}</span>}
                    </span>
                  </div>
                  <div className="mt-1.5 font-serif text-base" style={{ color }}>{s.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{s.setting}</div>
                  <div className="mt-2 flex items-center gap-2 text-[10px] text-faint">
                    <span className="rounded-full bg-surface-2 px-2 py-0.5">共 {s.total} {s.unit}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5">{s.items.length} 项</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-faint">
            七关皆可任算 · 今日已校 {today.today_done_count}/{today.daily_limit} · 每日每关首算计分，当日再算练手不加分
          </p>
        </section>
      )}

      {/* 分粮场 */}
      {(phase === "playing" || phase === "submitting" || phase === "scored") && current && (
        <section className="relative select-none overflow-hidden rounded-2xl border border-line" style={{ height: "min(64vh, 560px)", minHeight: 340 }}>
          <Canvas
            key={`${current.id}-${runId}`}
            dpr={[1, 2]}
            camera={{ position: [0, 5.4, 10.6], fov: 55, near: 0.1, far: 300 }}
            onCreated={({ camera }) => camera.lookAt(0, 1.2, -2.5)}
            className="block h-full w-full"
          >
            <MathScene g={g} />
          </Canvas>

          {/* 剩余量（顶部大字，rAF 直读 refs） */}
          <RemainingGauge g={g} />

          {/* 每村已分小条（左上） */}
          <VillageMeters g={g} scenario={current} />

          {/* 关卡提示 */}
          {showGuide && phase === "playing" && (
            <div className="pointer-events-none absolute left-1/2 top-16 w-[min(92%,430px)] -translate-x-1/2 rounded-2xl bg-black/60 px-5 py-4 text-center text-white backdrop-blur">
              <div className="font-serif text-lg" style={{ color: "#f0d9a0" }}>{current.title}</div>
              <div className="mt-1 text-xs leading-relaxed opacity-85">{current.setting}</div>
              <div className="mt-1 text-[11px] opacity-70">{current.hint}</div>
              {current.principle && <div className="mt-1.5 text-[11px] text-sky-200">法曰：{current.principle}</div>}
            </div>
          )}

          {/* toast */}
          {toast && (
            <div className={`pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 rounded-full px-4 py-1.5 font-serif text-lg backdrop-blur ${
              toast.good ? "bg-black/55 text-[#f0d9a0]" : "bg-red-900/70 text-white"
            }`}>
              {toast.text}
            </div>
          )}

          {/* 提交中 */}
          {phase === "submitting" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div className="rounded-2xl bg-surface px-6 py-4 font-serif text-lg text-fg">封仓核验中…</div>
            </div>
          )}

          {/* 结算卡 */}
          {phase === "scored" && result && (
            <ResultCard
              result={result}
              onRetry={() => startScenario(current)}
              onBack={backToSelect}
            />
          )}

          {/* 移动按钮 */}
          {phase === "playing" && (
            <div className="absolute inset-x-0 bottom-3 flex items-end justify-between px-3 sm:px-6">
              <div className="flex gap-2">
                <button
                  onClick={() => switchVillage(-1)}
                  className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl bg-black/50 text-lg text-white shadow-lg backdrop-blur active:scale-95"
                >◀</button>
                <button
                  onClick={() => switchVillage(1)}
                  className="flex h-14 w-14 touch-none items-center justify-center rounded-2xl bg-black/50 text-lg text-white shadow-lg backdrop-blur active:scale-95"
                >▶</button>
              </div>
              <button
                onClick={() => void submitRef.current()}
                className="h-14 rounded-full border-2 border-gold bg-[#fbf3dc]/90 px-5 font-serif text-base text-[#6b4e12] shadow-lg active:scale-95"
              >
                封仓验收
              </button>
              <div className="flex gap-2">
                <HoldBtn label="回粮" sub="↓" onHold={(v) => { g.input.scoop = v; }} />
                <HoldBtn label="出粮" sub="↑" accent onHold={(v) => { g.input.pour = v; }} />
              </div>
            </div>
          )}

          {/* 桌面键位提示 */}
          {phase === "playing" && (
            <div className="pointer-events-none absolute right-3 top-3 hidden rounded-full bg-black/45 px-3 py-1 text-[10px] text-white backdrop-blur sm:block">
              ←→ 选村 · ↑ 出粮 · ↓ 回粮 · Enter 验收
            </div>
          )}
        </section>
      )}

      {/* 数艺进度 */}
      {progress && phase === "idle" && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-fg">
            数艺进境 · {progress.played_count} / {progress.total_scenarios} 关 · 均分 {progress.avg_score} · 共算 {progress.total_plays} 次
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {progress.scenarios.map((s) => (
              <div key={s.id} className="rounded-lg border border-line bg-surface-2/40 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium" style={{ color: KIND_COLOR[s.kind] ?? "#2b2925" }}>{s.kind_label} · {s.title}</span>
                  <span className={s.best_score > 0 ? "text-fg" : "text-faint"}>
                    {s.best_score > 0 ? `最佳 ${s.best_score}` : "未算"}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-muted">{s.setting}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── 剩余量（rAF 直读 refs，不走 React 渲染） ──
function RemainingGauge({ g }: { g: MathRefs }) {
  const numRef = useRef<HTMLSpanElement>(null);
  const subRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = g.engine;
      if (st && numRef.current) {
        const rem = remaining(st);
        numRef.current.textContent = `${Math.round(rem)}`;
        numRef.current.style.color = rem <= 0.001 ? "#d9a521" : "#ffffff";
        if (subRef.current) {
          const used = allocatedSum(st);
          subRef.current.textContent = `已分 ${Math.round(used)} / ${st.scenario.total} ${st.scenario.unit}`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g]);
  return (
    <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-2xl bg-black/45 px-5 py-2 text-center backdrop-blur">
      <div className="text-[10px] tracking-widest text-white/60">仓中剩余</div>
      <div>
        <span ref={numRef} className="font-serif text-3xl font-bold text-white">0</span>
        <span className="ml-1 text-xs text-white/60">{g.engine?.scenario.unit ?? ""}</span>
      </div>
      <div ref={subRef} className="text-[10px] text-white/60" />
    </div>
  );
}

// ── 每村已分小条（rAF 驱动） ──
function VillageMeters({ g, scenario }: { g: MathRefs; scenario: MathScenarioBrief }) {
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const txtRefs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const st = g.engine;
      if (st) {
        scenario.items.forEach((it, i) => {
          const v = st.allocations[it.name] ?? 0;
          const pct = Math.min(100, (v / scenario.total) * 100);
          const bar = barRefs.current[i];
          if (bar) {
            bar.style.width = `${pct}%`;
            bar.style.background = st.selected === i ? "#d9a521" : "#8fae7a";
          }
          const txt = txtRefs.current[i];
          if (txt) txt.textContent = `${Math.round(v)} ${scenario.unit} · ${Math.round(pct)}%`;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [g, scenario]);
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-[190px] space-y-1.5 rounded-2xl bg-black/45 p-3 backdrop-blur">
      {scenario.items.map((it, i) => (
        <div key={it.name}>
          <div className="flex justify-between text-[10px] text-white/80">
            <span className="font-medium">{it.name}</span>
            <span ref={(el) => { txtRefs.current[i] = el; }} className="text-white/60" />
          </div>
          <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div ref={(el) => { barRefs.current[i] = el; }} className="h-full rounded-full" style={{ width: "0%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── 结算卡 ──
function ResultCard({ result, onRetry, onBack }: { result: MathSolveResp; onRetry: () => void; onBack: () => void }) {
  const sc = result.scenario;
  const ideals = new Map(sc.ideal_shares.map((x) => [x.name, x.ideal_share]));
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/45 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-2xl">
        <div className="text-center">
          <div className="text-[10px] tracking-widest text-faint">{sc.kind_label} · 核验</div>
          <div className="mt-1 font-serif text-5xl text-fg">{result.score}</div>
          <div
            className="mt-1 inline-block rounded-full px-3 py-0.5 font-serif text-sm text-white"
            style={{ background: GRADE_COLOR[result.grade] ?? "#6b6046" }}
          >
            {result.grade}
            {result.score_applied
              ? (result.shu_delta > 0 ? ` · 数艺 +${result.shu_delta}` : result.xp_delta > 0 ? ` · 修为 +${result.xp_delta}` : "")
              : "（今日已校，不再计分）"}
          </div>
        </div>
        {/* 三维条 */}
        <div className="mt-4 space-y-2">
          <DimBar label="合总 · 总量相合" v={result.sum_match} color="#0F6E56" />
          <DimBar label="均衡 · 各得其分" v={result.fairness} color="#1E5F8E" />
          <DimBar label="节度 · 不过其量" v={result.moderation} color="#854F0B" />
        </div>
        {/* 你的分配 vs 圣算 */}
        <div className="mt-3 overflow-hidden rounded-lg border border-line">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-surface-2/70 text-muted">
                <th className="px-2 py-1 text-left font-medium">对象</th>
                <th className="px-2 py-1 text-right font-medium">你的分配</th>
                <th className="px-2 py-1 text-right font-medium">圣算揭晓</th>
              </tr>
            </thead>
            <tbody>
              {sc.items.map((it) => {
                const mine = result.allocations[it.name] ?? 0;
                const ideal = ideals.get(it.name) ?? 0;
                const diff = Math.abs(mine - ideal);
                return (
                  <tr key={it.name} className="border-t border-line/60">
                    <td className="px-2 py-1 text-fg">{it.name}</td>
                    <td className="px-2 py-1 text-right text-fg">{Math.round(mine * 10) / 10} {sc.unit}</td>
                    <td className={`px-2 py-1 text-right ${diff / Math.max(1, sc.total) > 0.1 ? "text-amber-700" : "text-muted"}`}>
                      {Math.round(ideal * 10) / 10} {sc.unit}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* 评判 tips */}
        {result.feedback.length > 0 && (
          <div className="mt-3 rounded-lg bg-surface-2/60 p-3 text-[11px] leading-relaxed text-muted">
            {result.feedback.map((t, i) => <div key={i} className="mt-0.5">· {t}</div>)}
          </div>
        )}
        {/* 经典 */}
        {result.refs.length > 0 && (
          <div className="mt-3 rounded-lg border border-gold/50 bg-[#fbf3dc]/70 p-3 text-[11px] text-[#6b4e12]">
            {result.refs.slice(0, 2).map((r) => (
              <div key={r.ref_id} className="mt-1">
                <span className="opacity-70">{r.ref_label}：</span>
                <span className="font-serif">{r.text}</span>
                {result.new_unlocked_refs.some((u) => u.ref_id === r.ref_id) && (
                  <span className="ml-1 rounded-full bg-gold px-1.5 text-[9px] text-white">新解锁</span>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <button onClick={onRetry} className="flex-1 rounded-full bg-accent py-2.5 text-sm font-medium text-white hover:opacity-90">
            再算一次
          </button>
          <button onClick={onBack} className="flex-1 rounded-full border border-line py-2.5 text-sm text-muted hover:bg-surface-2">
            换一关
          </button>
        </div>
      </div>
    </div>
  );
}

function DimBar({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div>
      <div className="mb-0.5 flex justify-between text-[11px] text-muted">
        <span>{label}</span>
        <span>{Math.round(v * 100)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full" style={{ width: `${Math.round(v * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

function HoldBtn({ label, sub, accent, onHold }: { label: string; sub?: string; accent?: boolean; onHold: (v: boolean) => void }) {
  return (
    <button
      onPointerDown={(e) => { e.preventDefault(); onHold(true); }}
      onPointerUp={() => onHold(false)}
      onPointerLeave={() => onHold(false)}
      onPointerCancel={() => onHold(false)}
      className={`flex h-14 min-w-[64px] touch-none flex-col items-center justify-center rounded-2xl px-4 font-medium shadow-lg backdrop-blur active:scale-95 ${
        accent ? "bg-accent/90 text-white" : "bg-black/50 text-white"
      }`}
    >
      <span className="text-sm leading-none">{label}</span>
      {sub && <span className="mt-0.5 text-[9px] opacity-60">{sub}</span>}
    </button>
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
