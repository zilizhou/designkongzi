"use client";

/**
 * 射 · 反求诸己 — 3D 射场 MVP
 *
 * 阶段：idle → breath → aim → charge → fly → scored → (reflect) → unlocked → idle
 *
 * 物理（简化、可解释）：
 *   理想瞄准 aimIdeal = -wind * 0.3        （应该往风的反向偏，反风差为零）
 *   理想力度 powerIdeal = 0.55              （满力的 55%）
 *   横向偏差 = aim + wind * 0.3
 *   纵向偏差 = (power - 0.55) * 4
 *   距靶心 drift = sqrt(横^2 + 纵^2) （米）
 *   环数 score = max(0, round(10 - drift * 5))   ← 0.2 米一环
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import {
  getSheProgress,
  startSheRound,
  submitSheResult,
} from "@/lib/api";
import type {
  SheProgressResp,
  SheRefBrief,
  SheReflection,
  SheRoundResp,
} from "@/lib/types";

type Phase = "idle" | "breath" | "aim" | "charge" | "fly" | "scored" | "reflect" | "unlocked";

const REFLECTION_OPTIONS: { key: SheReflection; label: string; hint: string }[] = [
  { key: "calm", label: "心未静，气未沉", hint: "呼吸太快、抢射、未守静" },
  { key: "force", label: "力度过 / 不及", hint: "蓄力没到位或拉得太满" },
  { key: "wind", label: "估风错了", hint: "外部条件读不准也是自己的事" },
  { key: "win", label: "求胜心切", hint: "想赢的念头压倒了平和" },
];

export default function She3DGame() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [round, setRound] = useState<SheRoundResp | null>(null);
  const [progress, setProgress] = useState<SheProgressResp | null>(null);

  const [breathCount, setBreathCount] = useState(0);
  const [aim, setAim] = useState(0);            // 横向 -2..+2
  const [power, setPower] = useState(0);        // 0..1

  // 飞行帧动画状态（仅给 3D 用）
  const [arrowFlight, setArrowFlight] = useState<null | {
    aim: number; power: number; wind: number; distance: number;
  }>(null);

  // 落地后才有
  const [lastScore, setLastScore] = useState<{ score: number; drift: number } | null>(null);
  const [lastResultMsg, setLastResultMsg] = useState<string>("");
  const [newUnlocked, setNewUnlocked] = useState<SheRefBrief[]>([]);
  const [, setReflectionChoice] = useState<SheReflection | null>(null);
  const [reflectionNote, setReflectionNote] = useState("");

  // ── 首次加载进度 ──
  useEffect(() => {
    getSheProgress().then(setProgress).catch(() => {});
  }, []);

  // ── 开局 ──
  const openRound = async () => {
    try {
      const r = await startSheRound();
      setRound(r);
      setBreathCount(0);
      setAim(0);
      setPower(0);
      setLastScore(null);
      setLastResultMsg("");
      setNewUnlocked([]);
      setReflectionChoice(null);
      setReflectionNote("");
      setPhase("aim");  // 直接进入瞄准（跳过静心）
    } catch {
      setLastResultMsg("无法开始 — 请确认已登录后端");
    }
  };

  // ── 静心：3 次点击 ──
  const tapBreath = () => {
    const next = breathCount + 1;
    setBreathCount(next);
    if (next >= 3) setPhase("aim");
  };

  // ── 触屏 / 桌面 分流 ──
  // 桌面（鼠标）：hover 瞄准；按下蓄力；松开发射
  // 触屏（手指）：拖动手指瞄准（按下也不蓄力）；底部专用按钮按住蓄力 / 松开发射
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsTouch(window.matchMedia?.("(pointer: coarse)").matches ?? false);
    }
  }, []);

  const sectionRef = useRef<HTMLDivElement>(null);
  const lastMoveRef = useRef(0);

  const updateAimFromEvent = (e: React.PointerEvent) => {
    const now = performance.now();
    if (now - lastMoveRef.current < 16) return;
    lastMoveRef.current = now;
    const rect = sectionRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xRel = (e.clientX - rect.left) / rect.width;
    setAim(Math.max(-2, Math.min(2, (xRel - 0.5) * 4)));
  };

  const onCanvasPointerMove = (e: React.PointerEvent) => {
    if (phase !== "aim" && phase !== "charge") return;
    // 触屏：必须按下才更新瞄准（手指拖）；鼠标：hover 即更新
    if (e.pointerType === "touch" && e.buttons === 0) return;
    updateAimFromEvent(e);
  };
  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (phase !== "aim") return;
    if (e.pointerType === "touch") {
      // 触屏：按下只是开始瞄准（更新到当前手指位置），不进蓄力
      updateAimFromEvent(e);
      return;
    }
    // 鼠标：直接进蓄力
    setPower(0);
    setPhase("charge");
  };
  const onCanvasPointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;   // 触屏松开手指不发射
    if (phase !== "charge") return;
    if (!round) return;
    setArrowFlight({ aim, power, wind: round.wind, distance: round.distance_m });
    setPhase("fly");
  };

  // ── 触屏专用：底部按钮按住=蓄力，松开=发射 ──
  const startChargeTouch = () => {
    if (phase !== "aim") return;
    setPower(0);
    setPhase("charge");
  };
  const releaseArrowTouch = () => {
    if (phase !== "charge" || !round) return;
    setArrowFlight({ aim, power, wind: round.wind, distance: round.distance_m });
    setPhase("fly");
  };

  // ── 蓄力：按住 → power 上涨 ──
  useEffect(() => {
    if (phase !== "charge") return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000;
      // 2s 拉满；超过 2.5s 还按着 → 弓颤抖（power 在 0.95-1.0 抖）
      const p = elapsed < 2 ? elapsed / 2 : Math.min(1, 0.95 + Math.sin(elapsed * 12) * 0.05);
      setPower(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // ── 飞行结束 → 计算环数 → 上报 ──
  const onArrowLanded = async () => {
    if (!round || !arrowFlight) return;
    const { aim: a, power: p, wind, distance } = arrowFlight;
    const horizontal = a + wind * 0.3;          // 米：落点横偏靶心
    const vertical = (p - 0.55) * 4;            // 米：落点纵偏靶心（力度太大太小都偏）
    const drift = Math.sqrt(horizontal ** 2 + vertical ** 2);
    const score = Math.max(0, Math.round(10 - drift * 5));
    setLastScore({ score, drift });
    setPhase("scored");

    // 上报（先记下 ；如果未中，进入 reflect；中靶 + zhupi 警告，给玩家选择「克己」）
    if (score > 0 && !round.zhupi_warning) {
      // 中靶且非「主皮」时刻：直接上报
      try {
        const res = await submitSheResult({
          score,
          distance_m: distance,
          wind,
          aim_drift: Number(drift.toFixed(3)),
          streak_before: round.streak,
          zhupi_warned: round.zhupi_warning,
        });
        setLastResultMsg(buildScoreMsg(score, res.she_delta, false));
        setNewUnlocked(res.new_unlocked_refs);
        const next = await getSheProgress();
        setProgress(next);
        if (res.new_unlocked_refs.length > 0) setPhase("unlocked");
      } catch {
        setLastResultMsg("结果上报失败");
      }
    }
  };

  const submitWithReflection = async (choice: SheReflection) => {
    if (!round || !lastScore) return;
    setReflectionChoice(choice);
    try {
      const res = await submitSheResult({
        score: lastScore.score,
        distance_m: round.distance_m,
        wind: round.wind,
        aim_drift: Number(lastScore.drift.toFixed(3)),
        reflection_choice: choice,
        reflection_note: reflectionNote.trim() || undefined,
        streak_before: round.streak,
        zhupi_warned: round.zhupi_warning,
      });
      setLastResultMsg(
        choice === "abstain"
          ? `克己：选择不主皮，得射艺 +${res.she_delta}`
          : buildScoreMsg(lastScore.score, res.she_delta, true),
      );
      setNewUnlocked(res.new_unlocked_refs);
      const next = await getSheProgress();
      setProgress(next);
      setPhase(res.new_unlocked_refs.length > 0 ? "unlocked" : "idle");
    } catch {
      setLastResultMsg("结果上报失败");
    }
  };

  const buildScoreMsg = (score: number, sheDelta: number, reflected: boolean) => {
    if (score >= 9) return `🎯 ${score} 环 · 射艺 +${sheDelta}`;
    if (score >= 6) return `⊙ ${score} 环 · 射艺 +${sheDelta}`;
    if (score > 0) return `· ${score} 环 · 射艺 +${sheDelta}`;
    return reflected ? `未中 · 反求诸己 · 射艺 +${sheDelta}` : "未中";
  };

  // ── 3D 场景 ──
  const showArrow = phase === "fly" && !!arrowFlight;

  return (
    <div className="space-y-3">
      {/* 顶部 HUD */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-accent">六艺 · 射</div>
            <div className="font-serif text-xl text-fg">反求诸己 · 射场 MVP</div>
            <div className="mt-1 text-xs text-muted">
              射不主皮 · 揖让而升 · 不怨胜己者
            </div>
          </div>
          {progress && (
            <div className="flex flex-wrap gap-3 text-xs text-muted">
              <Stat label="称号" value={progress.title} />
              <Stat label="射艺" value={`${progress.liuyi_she}`} />
              <Stat label="射次" value={`${progress.total_rounds}`} />
              <Stat
                label="命中"
                value={`${progress.hits} · ${(progress.hit_rate * 100).toFixed(0)}%`}
              />
              <Stat label="省分" value={`${progress.reflect_count + progress.deep_reflect_count}`} />
            </div>
          )}
          <Link
            href="/journey"
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
          >
            ← 六艺
          </Link>
        </div>
        {round && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <Chip label="风" value={`${round.wind > 0 ? "→" : round.wind < 0 ? "←" : "·"} ${Math.abs(round.wind).toFixed(1)} m/s`} />
            <Chip label="靶距" value={`${round.distance_m} m`} />
            <Chip label="连击" value={`${round.streak}`} accent={round.streak >= 3} />
            {round.zhupi_warning && (
              <span
                className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800"
                title="《论语·八佾·3.16》「射不主皮，为力不同科，古之道也」"
              >
                ⚠ 射不主皮 — 此局可选「克己」
              </span>
            )}
          </div>
        )}
      </section>

      {/* 3D 射场 + 控制层 */}
      <section
        ref={sectionRef}
        className="relative overflow-hidden rounded-2xl border border-line bg-[#dcdac8] select-none"
        style={{ height: "60vh", minHeight: 420, touchAction: "none", cursor: phase === "aim" || phase === "charge" ? "crosshair" : "default" }}
        onPointerMove={onCanvasPointerMove}
        onPointerDown={onCanvasPointerDown}
        onPointerUp={onCanvasPointerUp}
        onPointerCancel={onCanvasPointerUp}
        onPointerLeave={onCanvasPointerUp}
      >
        <Canvas
          camera={{ position: [0, 1.65, 0], fov: 55, near: 0.05, far: 300 }}
          shadows={false}
          dpr={[1, 2]}
          onCreated={({ camera }) => {
            // R3F 默认会 lookAt(0,0,0)，导致相机朝地面下倾。
            // 强制把视线放到 -z 水平方向（靶心高度）。
            camera.lookAt(0, 1.55, -10);
            camera.updateMatrixWorld();
          }}
        >
          <Suspense fallback={null}>
            <Sky />
            <ambientLight intensity={0.7} />
            <directionalLight position={[8, 10, 5]} intensity={0.8} />
            <Ground />
            <FarMountains />
            <Range />
            <Target distance={round?.distance_m || 30} />
            <BowFP aim={aim} power={power} phase={phase} />
            {(phase === "aim" || phase === "charge") && round && (
              <SightCrosshair
                aim={aim}
                power={power}
                wind={round.wind}
                distance={round.distance_m}
              />
            )}
            {showArrow && arrowFlight && (
              <FlyingArrow
                aim={arrowFlight.aim}
                power={arrowFlight.power}
                wind={arrowFlight.wind}
                distance={arrowFlight.distance}
                onLanded={onArrowLanded}
              />
            )}
          </Suspense>
        </Canvas>

        {/* 右上角放大靶 — 实时看到落点（aim 阶段：跟鼠标；charge：随力度上下；fly/scored：定格） */}
        {round && (phase === "aim" || phase === "charge" || phase === "fly" || phase === "scored") && (
          <MiniTarget
            aim={(phase === "fly" || phase === "scored") && arrowFlight ? arrowFlight.aim : aim}
            power={(phase === "fly" || phase === "scored") && arrowFlight ? arrowFlight.power : power}
            wind={round.wind}
            distance={round.distance_m}
            score={phase === "scored" && lastScore ? lastScore.score : null}
            drift={phase === "scored" && lastScore ? lastScore.drift : null}
            live={phase === "aim" || phase === "charge"}
          />
        )}

        {/* 阶段控制层 — HTML overlay */}
        <PhaseOverlay
          phase={phase}
          breathCount={breathCount}
          aim={aim}
          power={power}
          round={round}
          lastScore={lastScore}
          lastResultMsg={lastResultMsg}
          newUnlocked={newUnlocked}
          reflectionNote={reflectionNote}
          onSetReflectionNote={setReflectionNote}
          onOpenRound={openRound}
          onTapBreath={tapBreath}
          onChooseReflection={submitWithReflection}
          onSkipReflectIfHit={() => setPhase("idle")}
          onCloseUnlock={() => setPhase("idle")}
          isTouch={isTouch}
          onTouchChargeDown={startChargeTouch}
          onTouchChargeUp={releaseArrowTouch}
        />
      </section>

      {/* 解锁经典图鉴 — 已解锁数 / 总数 */}
      {progress && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-fg">
            射艺经典图鉴 · {progress.unlocked_refs.length} / {progress.all_she_refs.length}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {progress.all_she_refs.map((r) => (
              <div
                key={r.ref_id}
                className={`rounded-lg border p-3 text-xs ${
                  r.unlocked
                    ? "border-gold bg-accent-soft text-accent-ink"
                    : "border-line bg-surface-2/40 text-faint"
                }`}
              >
                <div className="text-[10px] uppercase tracking-widest">
                  {r.unlocked ? "✓ 已解锁" : "🔒 未解锁"}
                </div>
                <div className="mt-0.5 font-medium">{r.ref_label || r.ref_id}</div>
                {r.unlocked && r.text && <div className="mt-1 font-serif text-fg">{r.text}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 归因分布（≥3 次反省后才有意义） */}
      {progress && progress.reflect_count >= 3 && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-fg">反省归因分布</div>
          <p className="mb-2 text-[10px] text-faint">
            你最常勾选的失误来源（这本身就是镜子）
          </p>
          <div className="grid grid-cols-4 gap-2 text-xs">
            {REFLECTION_OPTIONS.map((o) => {
              const n = progress.attribution[o.key] || 0;
              const pct = progress.reflect_count
                ? Math.round((n / progress.reflect_count) * 100)
                : 0;
              return (
                <div key={o.key} className="rounded-lg border border-line bg-surface-2/40 p-2">
                  <div className="font-serif text-lg text-fg">{n}</div>
                  <div className="text-[10px] text-muted">{o.label}</div>
                  <div className="text-[10px] text-faint">{pct}%</div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────── 阶段 Overlay ───────────────────
function PhaseOverlay(props: {
  phase: Phase;
  breathCount: number;
  aim: number;
  power: number;
  round: SheRoundResp | null;
  lastScore: { score: number; drift: number } | null;
  lastResultMsg: string;
  newUnlocked: SheRefBrief[];
  reflectionNote: string;
  onSetReflectionNote: (v: string) => void;
  onOpenRound: () => void;
  onTapBreath: () => void;
  onChooseReflection: (k: SheReflection) => void;
  onSkipReflectIfHit: () => void;
  onCloseUnlock: () => void;
  isTouch: boolean;
  onTouchChargeDown: () => void;
  onTouchChargeUp: () => void;
}) {
  const {
    phase, breathCount, aim, power, round, lastScore, lastResultMsg, newUnlocked,
    reflectionNote, onSetReflectionNote,
    onOpenRound, onTapBreath,
    onChooseReflection, onSkipReflectIfHit, onCloseUnlock,
    isTouch, onTouchChargeDown, onTouchChargeUp,
  } = props;

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      {/* idle / breath / scored / unlocked — 全居中弹窗 */}
      {phase === "idle" && (
        <div className="m-auto pointer-events-auto rounded-2xl bg-black/65 p-6 text-center text-white backdrop-blur max-w-md">
          <div className="font-serif text-2xl">进入射场</div>
          <div className="mt-2 text-xs opacity-70 leading-relaxed">
            鼠标移动 = 瞄准方向<br />
            按下鼠标 = 拉弓蓄力（按越久力越足）<br />
            松开鼠标 = 放箭<br /><br />
            排行按「反省深度」 — 射不主皮
          </div>
          {lastResultMsg && (
            <div className="mt-3 rounded-lg bg-white/10 p-2 text-xs">上一轮：{lastResultMsg}</div>
          )}
          <button
            onClick={onOpenRound}
            className="mt-4 rounded-full bg-accent px-6 py-2.5 text-base hover:opacity-90"
          >
            开始一射
          </button>
        </div>
      )}

      {phase === "breath" && (
        <div className="m-auto pointer-events-auto rounded-2xl bg-black/65 p-6 text-center text-white backdrop-blur">
          <div className="text-xs opacity-70">第一步 · 静心</div>
          <div className="mt-1 font-serif text-base">
            随呼吸圈点 3 次（{breathCount}/3）
          </div>
          <div className="mx-auto my-3 flex items-center justify-center">
            <BreathRing onTap={onTapBreath} />
          </div>
          <div className="text-[10px] opacity-60">「正己而后发」</div>
        </div>
      )}

      {/* aim / charge / fly — 不挡画面，只在顶部和底部贴提示，事件穿透 */}
      {phase === "aim" && (
        <>
          <div className="m-3 self-center rounded-full bg-black/55 px-4 py-1.5 text-[11px] text-white backdrop-blur">
            {isTouch ? "🎯 拖动手指瞄准 · 按下面按钮蓄力" : "🎯 移动鼠标瞄准 · 按下鼠标拉弓"}
          </div>
          <div className="flex-1" />
          <div className="m-3 self-center rounded-lg bg-black/55 px-3 py-1.5 text-[10px] text-white/80 backdrop-blur">
            横向 {aim >= 0 ? "+" : ""}{aim.toFixed(2)} ·
            风 {round && round.wind > 0 ? "→" : round && round.wind < 0 ? "←" : "·"} {round && Math.abs(round.wind).toFixed(1)} m/s
          </div>
          {isTouch && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); onTouchChargeDown(); }}
              className="pointer-events-auto m-3 self-center rounded-full bg-rose-500 px-8 py-4 text-base font-medium text-white shadow-lg active:bg-rose-600"
              style={{ touchAction: "manipulation" }}
            >
              按住蓄力
            </button>
          )}
        </>
      )}

      {phase === "charge" && (
        <>
          <div className="m-3 self-center rounded-full bg-black/55 px-4 py-1.5 text-[11px] text-white backdrop-blur">
            ⚡ 蓄力中 · 松开{isTouch ? "按钮" : "鼠标"}发射（最佳约 55%）
          </div>
          <div className="flex-1" />
          {/* 屏幕底部大力度条，事件穿透 */}
          <div className="mx-6 mb-3 rounded-full bg-black/55 p-3 backdrop-blur">
            <div className="mb-1 flex items-center justify-between text-[10px] text-white/80">
              <span>力度 {Math.round(power * 100)}%</span>
              <span>「射不主皮，为力不同科」</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full transition-all"
                style={{
                  width: `${Math.round(power * 100)}%`,
                  background:
                    power < 0.45 ? "#fbbf24"
                    : power < 0.7 ? "#10b981"
                    : "#ef4444",
                }}
              />
            </div>
            {/* 55% 标线 */}
            <div className="relative -mt-3 h-3 pointer-events-none">
              <div className="absolute h-3 w-0.5 bg-white/70" style={{ left: "55%" }} />
            </div>
          </div>
          {isTouch && (
            <button
              onPointerUp={(e) => { e.stopPropagation(); onTouchChargeUp(); }}
              onPointerLeave={(e) => { e.stopPropagation(); onTouchChargeUp(); }}
              onPointerCancel={(e) => { e.stopPropagation(); onTouchChargeUp(); }}
              className="pointer-events-auto m-3 self-center rounded-full bg-rose-500 px-8 py-4 text-base font-medium text-white shadow-lg active:bg-rose-600"
              style={{ touchAction: "manipulation" }}
            >
              松开 · 发射
            </button>
          )}
        </>
      )}

      {phase === "fly" && (
        <div className="m-3 self-center pointer-events-none rounded-full bg-black/40 px-4 py-1.5 text-xs text-white backdrop-blur">
          🏹 箭出 · 看其所至
        </div>
      )}

      {phase === "scored" && lastScore && (
        <div className="m-auto pointer-events-auto max-w-md space-y-3 rounded-2xl bg-black/75 p-6 text-center text-white backdrop-blur shadow-2xl">
          <div className="text-[10px] tracking-widest opacity-60">RESULT</div>
          <div
            className="font-serif"
            style={{
              fontSize: lastScore.score > 0 ? "4.5rem" : "2.5rem",
              lineHeight: 1,
              color:
                lastScore.score >= 9 ? "#fbbf24"
                : lastScore.score >= 6 ? "#10b981"
                : lastScore.score > 0 ? "#e5e7eb"
                : "#f87171",
            }}
          >
            {lastScore.score > 0 ? `${lastScore.score} 环` : "未中"}
          </div>
          <div className="text-xs opacity-70">
            距靶心 {lastScore.drift.toFixed(2)} 米
          </div>
          {lastResultMsg && <div className="text-sm">{lastResultMsg}</div>}

          {/* 未中 → 反省卡；中靶且 zhupi → 给「克己」按钮；中靶常规 → 「继续」*/}
          {lastScore.score === 0 ? (
            <ReflectionCard
              note={reflectionNote}
              onSetNote={onSetReflectionNote}
              onChoose={onChooseReflection}
              showAbstain={false}
            />
          ) : round?.zhupi_warning ? (
            <div className="space-y-2">
              <p className="text-[11px] opacity-80">
                你已连击 {round.streak} 次。「射不主皮」 —
                此时主动停射、不再求中，是克己复礼。
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  onClick={() => onChooseReflection("abstain")}
                  className="rounded-full bg-amber-500 px-4 py-1.5 text-xs"
                >
                  ⊙ 克己 · 接受 +5 射艺
                </button>
                <button
                  onClick={onSkipReflectIfHit}
                  className="rounded-full border border-white/40 px-4 py-1.5 text-xs"
                >
                  继续刷分（不解锁经典）
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={onSkipReflectIfHit}
              className="rounded-full bg-accent px-5 py-1.5 text-sm"
            >
              继续
            </button>
          )}
        </div>
      )}

      {phase === "unlocked" && newUnlocked.length > 0 && (
        <div className="m-auto pointer-events-auto max-w-md space-y-3 rounded-2xl border-2 border-amber-500 bg-amber-50/95 p-6 text-amber-900 backdrop-blur shadow-2xl">
          <div className="text-xs tracking-widest">🎖 解锁经典</div>
          {newUnlocked.map((u) => (
            <div key={u.ref_id} className="border-l-2 border-amber-500 pl-3">
              <div className="text-xs opacity-70">{u.ref_label}</div>
              <div className="font-serif text-base">{u.text}</div>
            </div>
          ))}
          <button
            onClick={onCloseUnlock}
            className="mt-1 rounded-full bg-accent px-4 py-1.5 text-xs text-white"
          >
            收下，继续
          </button>
        </div>
      )}
    </div>
  );
}

function ReflectionCard({
  note,
  onSetNote,
  onChoose,
  showAbstain,
}: {
  note: string;
  onSetNote: (v: string) => void;
  onChoose: (k: SheReflection) => void;
  showAbstain: boolean;
}) {
  return (
    <div className="space-y-2 text-left">
      <p className="text-center text-[11px] opacity-80">
        为什么没中？—— <span className="italic">「不怨胜己者，反求诸己」</span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {REFLECTION_OPTIONS.map((o) => (
          <button
            key={o.key}
            onClick={() => onChoose(o.key)}
            className="rounded-lg border border-white/30 bg-white/10 p-2 text-left text-xs hover:bg-white/20"
          >
            <div className="font-medium">{o.label}</div>
            <div className="text-[10px] opacity-70">{o.hint}</div>
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => onSetNote(e.target.value)}
        rows={2}
        placeholder="（可选）写一句更具体的反思 · ≥5 字给省分 +2"
        className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs placeholder-white/40 outline-none"
      />
      {showAbstain && (
        <button
          onClick={() => onChoose("abstain")}
          className="mt-1 w-full rounded-full bg-amber-500 px-4 py-1.5 text-xs"
        >
          克己 · 不射
        </button>
      )}
    </div>
  );
}

// ─────────────────── 小组件 ───────────────────
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-1">
      <div className="text-[10px] text-faint">{label}</div>
      <div className="font-serif text-sm text-fg">{value}</div>
    </div>
  );
}
function Chip({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] ${
        accent ? "bg-amber-100 text-amber-800" : "bg-surface-2 text-muted"
      }`}
    >
      {label}：{value}
    </span>
  );
}

function BreathRing({ onTap }: { onTap: () => void }) {
  // 呼吸圈：4s 一个周期，玩家在圈最大时点击算「合拍」
  const [scale, setScale] = useState(0.6);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const t = ((performance.now() - t0) / 1000) % 4;
      const s = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((t / 4) * Math.PI * 2 - Math.PI / 2));
      setScale(s);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <button
      onClick={onTap}
      className="relative flex h-24 w-24 items-center justify-center rounded-full bg-white/10"
      style={{ touchAction: "manipulation" }}
    >
      <div
        className="absolute h-24 w-24 rounded-full border-2 border-white/80 transition-transform"
        style={{ transform: `scale(${scale})` }}
      />
      <span className="text-xs opacity-80">点</span>
    </button>
  );
}

/** 右上角放大靶 — 2D SVG，显示实时落点 / 最终命中点 + 环数。
 *  物理与 3D 场景对齐：horiz = aim + wind*0.3；vert = -(power-0.55)*4。
 *  靶尺寸：半径 1m，按 1m → 60px 缩放（直径 120px）。 */
function MiniTarget({
  aim, power, wind, distance, score, drift, live,
}: {
  aim: number; power: number; wind: number; distance: number;
  score: number | null; drift: number | null; live: boolean;
}) {
  const horizM = aim + wind * 0.3;
  // power=0 时未蓄力，先不算 vertical 偏移
  const vertM = power > 0 ? -(power - 0.55) * 4 : 0;
  const PX_PER_M = 60;
  const cx = 80 + horizM * PX_PER_M;  // 中心 (80,80)
  const cy = 80 - vertM * PX_PER_M;
  // 限制可见范围在 SVG 内（落点超出靶时画在边缘）
  const cxClamp = Math.max(6, Math.min(154, cx));
  const cyClamp = Math.max(6, Math.min(154, cy));
  const outOfFrame = cx < 6 || cx > 154 || cy < 6 || cy > 154;

  return (
    <div className="pointer-events-none absolute right-3 top-3 rounded-xl bg-black/70 p-2 text-white backdrop-blur shadow-lg">
      <div className="mb-1 flex items-center justify-between text-[10px] opacity-80">
        <span>放大靶 · {distance}m</span>
        <span>{live ? "瞄准中" : "已落点"}</span>
      </div>
      <svg width={160} height={160} className="block">
        {/* 同心圆（与 3D Target 颜色一致） */}
        <circle cx={80} cy={80} r={60} fill="#f4f1e6" />
        <circle cx={80} cy={80} r={48} fill="#222" />
        <circle cx={80} cy={80} r={36} fill="#3a7bd5" />
        <circle cx={80} cy={80} r={24} fill="#e63946" />
        <circle cx={80} cy={80} r={12} fill="#ffd166" />
        <circle cx={80} cy={80} r={5} fill="#1a1a1a" />
        {/* 环线（淡） */}
        {[60, 48, 36, 24, 12].map((r) => (
          <circle key={r} cx={80} cy={80} r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={0.5} />
        ))}
        {/* 十字辅助线 */}
        <line x1={80} y1={0} x2={80} y2={160} stroke="rgba(255,255,255,0.18)" strokeDasharray="2,3" />
        <line x1={0} y1={80} x2={160} y2={80} stroke="rgba(255,255,255,0.18)" strokeDasharray="2,3" />
        {/* 落点 */}
        <g>
          <circle
            cx={cxClamp}
            cy={cyClamp}
            r={live ? 5 : 7}
            fill={live ? "#facc15" : score && score >= 9 ? "#fbbf24" : score && score >= 6 ? "#10b981" : score ? "#ffffff" : "#f87171"}
            stroke="#000"
            strokeWidth={1.5}
            opacity={outOfFrame ? 0.5 : 1}
          />
          {/* 已命中时画一根从中心到落点的细线 */}
          {!live && (
            <line x1={80} y1={80} x2={cxClamp} y2={cyClamp} stroke="rgba(255,255,255,0.6)" strokeWidth={1} strokeDasharray="2,2" />
          )}
        </g>
      </svg>
      {!live && score !== null && (
        <div className="mt-1 text-center">
          <span
            className="font-serif"
            style={{
              fontSize: "1.5rem",
              color: score >= 9 ? "#fbbf24" : score >= 6 ? "#10b981" : score > 0 ? "#fff" : "#f87171",
            }}
          >
            {score > 0 ? `${score} 环` : "未中"}
          </span>
          {drift !== null && (
            <span className="ml-1 text-[10px] opacity-70">{drift.toFixed(2)}m</span>
          )}
        </div>
      )}
      {live && (
        <div className="mt-1 text-center text-[10px] opacity-60">
          风 {wind > 0 ? "→" : wind < 0 ? "←" : "·"} {Math.abs(wind).toFixed(1)} · 力度 {Math.round(power * 100)}%
        </div>
      )}
    </div>
  );
}

// ─────────────────── 3D 元素 ───────────────────
function Sky() {
  return (
    <>
      <color attach="background" args={["#e4dfc5"]} />
      <fog attach="fog" args={["#e4dfc5", 50, 180]} />
    </>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#b7c293" />
    </mesh>
  );
}

function FarMountains() {
  // 三层远山（淡墨）
  return (
    <>
      {[
        { z: -80, color: "#9aab9d", h: 14, w: 220, y: 0 },
        { z: -60, color: "#8ea298", h: 9, w: 180, y: 0 },
        { z: -45, color: "#7e9690", h: 6, w: 160, y: 0 },
      ].map((m, i) => (
        <mesh key={i} position={[0, m.h / 2 + m.y, m.z]}>
          <planeGeometry args={[m.w, m.h]} />
          <meshBasicMaterial color={m.color} transparent opacity={0.85} />
        </mesh>
      ))}
    </>
  );
}

function Range() {
  // 简易木质射台 — 一条窄长 plane
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.5]}>
      <planeGeometry args={[4, 3]} />
      <meshStandardMaterial color="#7a5d3f" />
    </mesh>
  );
}

function Target({ distance }: { distance: number }) {
  // 同心圆 plane 叠加
  const z = -distance;
  const y = 1.55;
  return (
    <group position={[0, y, z]}>
      {/* 立柱 */}
      <mesh position={[0, -y / 2, 0]}>
        <boxGeometry args={[0.08, y, 0.08]} />
        <meshStandardMaterial color="#5a4a36" />
      </mesh>
      {/* 同心圆 */}
      {[
        { r: 1.0, color: "#f4f1e6" },
        { r: 0.8, color: "#222" },
        { r: 0.6, color: "#3a7bd5" },
        { r: 0.4, color: "#e63946" },
        { r: 0.2, color: "#ffd166" },
        { r: 0.08, color: "#1a1a1a" },
      ].map((c, i) => (
        <mesh key={i} position={[0, 0, 0.001 * i]}>
          <circleGeometry args={[c.r, 48]} />
          <meshBasicMaterial color={c.color} />
        </mesh>
      ))}
    </group>
  );
}

function BowFP({ aim, power, phase }: { aim: number; power: number; phase: Phase }) {
  // 第一人称弓 — 跟随相机，挂在画面左下角，避免遮挡正中靶面
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const cam = state.camera;
    ref.current.position.copy(cam.position);
    ref.current.quaternion.copy(cam.quaternion);
    ref.current.translateX(-0.55);  // 左下
    ref.current.translateY(-0.55);
    ref.current.translateZ(-1.4);
    const idleJitter = phase === "aim" ? Math.sin(state.clock.elapsedTime * 6) * 0.015 : 0;
    ref.current.rotation.y += aim * 0.04 + idleJitter;
  });

  // 弓弦根据 power 拉开（朝玩家方向 = +z 本地坐标）
  const stringPull = power * 0.22;
  return (
    <group ref={ref}>
      {/* 弓臂 */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.045, 0.7, 0.045]} />
        <meshStandardMaterial color="#5a3b1d" />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.045, 0.7, 0.045]} />
        <meshStandardMaterial color="#5a3b1d" />
      </mesh>
      {/* 弓弦 — 拉满时偏向玩家 */}
      <mesh position={[0, 0, stringPull]}>
        <boxGeometry args={[0.005, 1.4, 0.005]} />
        <meshBasicMaterial color="#f5f5f5" />
      </mesh>
      {/* 已搭的箭：沿 -z 朝前；蓄力时箭尾被拉向玩家（stringPull） */}
      <group position={[0, 0, stringPull - 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.014, 0.014, 0.8, 8]} />
          <meshStandardMaterial color="#caa472" />
        </mesh>
        <mesh position={[0, -0.42, 0]}>
          <coneGeometry args={[0.025, 0.08, 8]} />
          <meshStandardMaterial color="#7a3a2e" />
        </mesh>
      </group>
    </group>
  );
}

/** 实时落点预测十字 — 在靶面前 5cm 显示一个红色圆环 + 十字。
 *  让玩家明确看到自己当前的瞄准点在哪。 */
function SightCrosshair({
  aim, power, wind, distance,
}: { aim: number; power: number; wind: number; distance: number }) {
  const sightX = aim + wind * 0.3;
  // power=0 时尚未蓄力，先不偏；蓄力时按公式偏
  const sightY = 1.55 + (power > 0 ? -(power - 0.55) * 4 : 0);
  return (
    <group position={[sightX, sightY, -distance + 0.05]}>
      <mesh>
        <ringGeometry args={[0.07, 0.09, 24]} />
        <meshBasicMaterial color="#ef4444" transparent opacity={0.85} />
      </mesh>
      <mesh>
        <boxGeometry args={[0.18, 0.01, 0.001]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh>
        <boxGeometry args={[0.01, 0.18, 0.001]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function FlyingArrow({
  aim, power, wind, distance, onLanded,
}: {
  aim: number; power: number; wind: number; distance: number; onLanded: () => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const t0Ref = useRef<number>(performance.now());
  const landedRef = useRef(false);

  // 起点：弓口附近，画面靠左前一点；终点：靶面落点
  const start = useMemo(() => new THREE.Vector3(-0.35, 1.45, -1.0), []);
  const end = useMemo(() => {
    const horiz = aim + wind * 0.3;
    const vert = -((power - 0.55) * 4);
    return new THREE.Vector3(horiz, 1.55 + vert, -distance);
  }, [aim, power, wind, distance]);

  const flightDuration = 2.0;   // 慢一些，肉眼能跟住
  const apexHeight = 0.9;       // 抛物线高一点，便于看到弧

  useFrame(() => {
    if (!ref.current || landedRef.current) return;
    const elapsed = (performance.now() - t0Ref.current) / 1000;
    const t = Math.min(1, elapsed / flightDuration);
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    const y = start.y + (end.y - start.y) * t + Math.sin(t * Math.PI) * apexHeight;
    ref.current.position.set(x, y, z);
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    ref.current.rotation.set(0, Math.atan2(dx, -dz), 0);
    if (t >= 1) {
      landedRef.current = true;
      setTimeout(onLanded, 300);
    }
  });

  // 箭由 group 组装：主体 cylinder + 红色箭头 cone + 尾羽 plane
  // 整体绕 x 转 90° 让长轴沿 z（朝飞行方向）
  return (
    <group ref={ref} position={start.toArray()}>
      <group rotation={[Math.PI / 2, 0, 0]}>
        {/* 杆 — 比之前粗 3 倍，颜色用酱色对比草地 */}
        <mesh>
          <cylinderGeometry args={[0.04, 0.04, 1.0, 10]} />
          <meshStandardMaterial color="#a86a3c" />
        </mesh>
        {/* 箭头 — 大红，最显眼 */}
        <mesh position={[0, -0.55, 0]}>
          <coneGeometry args={[0.08, 0.18, 12]} />
          <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.4} />
        </mesh>
        {/* 尾羽 — 两片 plane 十字 */}
        <mesh position={[0, 0.45, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.12, 0.18]} />
          <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.45, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.12, 0.18]} />
          <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}
