"use client";

/**
 * 礼 ·「执礼 · 宾至如归」— 第一人称 3D 宾主厅
 * 复用 React Three Fiber（与射艺同栈）：揖礼蓄力、迎宾顺序、安席、席间时机 + 全场气氛
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LiHostScores } from "@/lib/types";
import {
  liHostScenario,
  RANK_META,
  SEAT_NAMES,
  type LiHostGuestCfg,
  type LiHostRoundDetail,
  type LiHostScenarioCfg,
} from "./liHostData";
import {
  buildRoundDetail,
  checkGreetOrder,
  clamp,
  detailToScores,
  scoreBow,
  scoreEventTiming,
  scoreSeats,
} from "./liHostLogic";

/** 宾主厅视觉：纸壁 · 木构 · 席地 · 灯笼暖光（与平台朱砂主色呼应） */
const PAL = {
  sky: "#d8d2c8",
  fog: "#c9c0b4",
  paper: "#ebe4d8",
  wood: "#5c4636",
  woodDark: "#3f2f24",
  mat: "#b8a48a",
  matEdge: "#8f7358",
  ink: "#2c241c",
  skin: "#dcc4a8",
  lantern: "#fff6e8",
  glow: "#e8b87a",
  trim: "#993C1D",
  highlight: "#c45a3a",
} as const;

type Phase = "intro" | "greet" | "bow" | "seat" | "banquet" | "done";
type GuestState = LiHostGuestCfg & {
  greeted: boolean;
  seatIdx: number | null;
  mood: number; // -1..1
  bowFlash: number;
};

type LiveEv = {
  cfg: LiHostScenarioCfg["events"][0];
  guestId: string;
  startMs: number;
  resolved: boolean;
};

export default function Li3DGame({
  scenarioKey,
  onExit,
  onFinish,
}: {
  scenarioKey: string;
  onExit: () => void;
  onFinish: (scores: LiHostScores, detail: LiHostRoundDetail) => void;
}) {
  const scenario = useMemo(() => liHostScenario(scenarioKey), [scenarioKey]);
  const [phase, setPhase] = useState<Phase>("intro");
  const [guests, setGuests] = useState<GuestState[]>(() =>
    scenario.guests.map((g) => ({ ...g, greeted: false, seatIdx: null, mood: 0, bowFlash: 0 })),
  );
  const [focusId, setFocusId] = useState<string | null>(null);
  const [orderHits, setOrderHits] = useState(0);
  const [bows, setBows] = useState<LiHostRoundDetail["bows"]>([]);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [seatGuestIdx, setSeatGuestIdx] = useState(0);
  const [seatScoreVal, setSeatScoreVal] = useState(0);

  const [bowDepth, setBowDepth] = useState(0);
  const [bowDir, setBowDir] = useState(1);
  const [charging, setCharging] = useState(false);
  const bowRaf = useRef<number | null>(null);

  const [banquetStart, setBanquetStart] = useState(0);
  const [eventCursor, setEventCursor] = useState(0);
  const [liveEvents, setLiveEvents] = useState<LiveEv[]>([]);
  const [eventResults, setEventResults] = useState<LiHostRoundDetail["events"]>([]);
  const [overActs, setOverActs] = useState(0);
  const [atmosphere, setAtmosphere] = useState(62);
  const [toast, setToast] = useState("");
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    setIsTouch(typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches ?? false));
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1400);
  };

  const remaining = guests.filter((g) => !g.greeted);

  const pickGuest = (id: string) => {
    if (phase !== "greet" || remaining.length === 0) return;
    const ok = checkGreetOrder(scenario.guests, guests.filter((g) => g.greeted).map((g) => g.id), id);
    if (ok) {
      setOrderHits((h) => h + 1);
      showToast("先后得宜");
    } else {
      showToast("失了先后");
      setAtmosphere((a) => clamp(a - 8, 20, 100));
    }
    setFocusId(id);
    setPhase("bow");
    setBowDepth(0);
    setBowDir(1);
  };

  useEffect(() => {
    if (phase !== "bow" || !charging) {
      if (bowRaf.current) cancelAnimationFrame(bowRaf.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setBowDepth((d) => {
        let nd = d + bowDir * scenario.gaugeSpeed * dt;
        let dir = bowDir;
        if (nd >= 1) { nd = 1; dir = -1; }
        if (nd <= 0) { nd = 0; dir = 1; }
        setBowDir(dir);
        return nd;
      });
      bowRaf.current = requestAnimationFrame(tick);
    };
    bowRaf.current = requestAnimationFrame(tick);
    return () => { if (bowRaf.current) cancelAnimationFrame(bowRaf.current); };
  }, [phase, charging, bowDir, scenario.gaugeSpeed]);

  const releaseBow = () => {
    if (phase !== "bow" || !focusId) return;
    setCharging(false);
    const guest = scenario.guests.find((g) => g.id === focusId)!;
    const { score, verdict } = scoreBow(guest, bowDepth, scenario);
    setBows((b) => [...b, { guest: guest.name, verdict, score }]);
    setGuests((gs) =>
      gs.map((g) =>
        g.id === focusId
          ? { ...g, greeted: true, mood: score >= 70 ? 0.8 : score >= 50 ? 0.2 : -0.6, bowFlash: 1 }
          : g,
      ),
    );
    setAtmosphere((a) => clamp(a + (score >= 70 ? 6 : score >= 50 ? 0 : -10), 20, 100));
    showToast(`${verdict} · ${score}`);
    setFocusId(null);
    const left = guests.filter((g) => !g.greeted && g.id !== focusId).length;
    if (left > 0) setPhase("greet");
    else {
      setSeatGuestIdx(0);
      setPhase("seat");
    }
  };

  const assignSeat = (seatIdx: number) => {
    if (phase !== "seat") return;
    const g = guests[seatGuestIdx];
    if (!g) return;
    const taken = Object.values(assignments);
    if (taken.includes(seatIdx)) {
      showToast("此席已有宾客");
      return;
    }
    const next = { ...assignments, [g.id]: seatIdx };
    setAssignments(next);
    setGuests((gs) => gs.map((x) => (x.id === g.id ? { ...x, seatIdx } : x)));
    const nextIdx = seatGuestIdx + 1;
    if (nextIdx >= guests.length) {
      const ss = scoreSeats(scenario.guests, next);
      setSeatScoreVal(ss);
      setAtmosphere((a) => clamp(a + (ss >= 75 ? 8 : ss >= 50 ? 0 : -12), 20, 100));
      showToast(ss >= 75 ? "位次尽合于礼" : "位次略有出入");
      window.setTimeout(() => {
        setBanquetStart(performance.now());
        setEventCursor(0);
        setLiveEvents([]);
        setPhase("banquet");
      }, 900);
    } else {
      setSeatGuestIdx(nextIdx);
    }
  };

  const tapGuestBanquet = (id: string) => {
    if (phase !== "banquet") return;
    const ev = liveEvents.find((e) => !e.resolved && e.guestId === id);
    if (!ev) {
      setOverActs((o) => o + 1);
      setAtmosphere((a) => clamp(a - 5, 20, 100));
      showToast("过度殷勤 · 失于节");
      return;
    }
    const t = (performance.now() - ev.startMs) / (ev.cfg.duration * 1000);
    const { score, verdict } = scoreEventTiming(t, ev.cfg.window);
    setEventResults((r) => [...r, { label: ev.cfg.label, verdict, score }]);
    setLiveEvents((le) => le.map((e) => (e === ev ? { ...e, resolved: true } : e)));
    setAtmosphere((a) => clamp(a + (score >= 80 ? 8 : score >= 55 ? 2 : -6), 20, 100));
    showToast(`${verdict} · ${score}`);
  };

  useEffect(() => {
    if (phase !== "banquet") return;
    const id = window.setInterval(() => {
      const elapsed = (performance.now() - banquetStart) / 1000;
      while (eventCursor < scenario.events.length && scenario.events[eventCursor].at <= elapsed) {
        const cfg = scenario.events[eventCursor];
        setLiveEvents((le) => [
          ...le,
          { cfg, guestId: cfg.guest, startMs: performance.now(), resolved: false },
        ]);
        setEventCursor((c) => c + 1);
      }
      setLiveEvents((le) => {
        let changed = false;
        const next = le.map((e) => {
          if (e.resolved) return e;
          const t = (performance.now() - e.startMs) / (e.cfg.duration * 1000);
          if (t >= 1) {
            changed = true;
            setEventResults((r) => [...r, { label: e.cfg.label, verdict: "怠慢了", score: 30 }]);
            setAtmosphere((a) => clamp(a - 8, 20, 100));
            return { ...e, resolved: true };
          }
          return e;
        });
        return changed ? next : le;
      });
      if (elapsed >= scenario.banquetSeconds && phase === "banquet") {
        setPhase("done");
      }
    }, 120);
    return () => clearInterval(id);
  }, [phase, banquetStart, eventCursor, scenario]);

  useEffect(() => {
    if (phase !== "done") return;
    const detail = buildRoundDetail({
      bows,
      orderHits,
      orderTotal: scenario.guests.length,
      seatScore: seatScoreVal,
      events: eventResults,
      overActs,
      atmosphere,
    });
    const scores = detailToScores(detail);
    window.setTimeout(() => onFinish(scores, detail), 600);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const focusGuest = focusId ? guests.find((g) => g.id === focusId) : null;
  const seatTarget = phase === "seat" ? guests[seatGuestIdx] : null;
  const activeEventGuest = liveEvents.find((e) => !e.resolved)?.guestId ?? null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onExit} className="text-xs text-faint hover:text-accent">← 退出修行</button>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs text-accent">
          3D 宾主厅 · {scenario.title}
        </span>
      </div>

      <section
        className="relative overflow-hidden rounded-2xl border border-line bg-[#d8d2c8] select-none shadow-inner"
        style={{ height: "min(68vh, 520px)", minHeight: 380, touchAction: "none" }}
      >
        <Canvas
          camera={{ position: [0, 1.58, 2.6], fov: 52, near: 0.1, far: 80 }}
          dpr={[1, 1.75]}
          onCreated={({ camera }) => {
            camera.lookAt(0, 1.25, -5.5);
            camera.updateMatrixWorld();
          }}
        >
          <Suspense fallback={null}>
            <HallScene atmosphere={atmosphere} />
            {guests.map((g, i) => (
              <GuestFigure
                key={g.id}
                guest={g}
                index={i}
                total={guests.length}
                phase={phase}
                highlighted={
                  g.id === focusId ||
                  g.id === activeEventGuest ||
                  (phase === "greet" && !g.greeted) ||
                  (phase === "seat" && seatTarget?.id === g.id)
                }
                seated={g.seatIdx != null && phase !== "greet" && phase !== "bow"}
              />
            ))}
            <SeatMarkers visible={phase === "seat"} count={guests.length} />
            <BowCamera depth={phase === "bow" ? bowDepth : 0} />
            {phase === "bow" && <BowSleeves depth={bowDepth} />}
          </Suspense>
        </Canvas>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-[#2c241c]/45 to-transparent p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-serif text-sm text-[#f5efe6]">{scenario.place}</div>
              <div className="text-[11px] text-[#f5efe6]/75">
                {phase === "intro" && "入场"}
                {phase === "greet" && "一幕 · 迎宾"}
                {phase === "bow" && "作揖"}
                {phase === "seat" && "二幕 · 安席"}
                {phase === "banquet" && "三幕 · 席间"}
                {phase === "done" && "礼成"}
              </div>
            </div>
            <div className="rounded-lg bg-[#2c241c]/55 px-2.5 py-1 text-right backdrop-blur-sm">
              <div className="text-[10px] text-[#f5efe6]/65">全场气氛</div>
              <div className="font-serif text-lg text-[#e8b87a]">{atmosphere}</div>
            </div>
          </div>
        </div>

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full border border-[#993C1D]/30 bg-[#2c241c]/80 px-4 py-1.5 text-sm text-[#f5efe6] backdrop-blur-sm">
            {toast}
          </div>
        )}

        {/* Phase overlays */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#2c241c]/88 via-[#2c241c]/55 to-transparent p-4 pt-16">
          {phase === "intro" && (
            <div className="mx-auto max-w-md text-center">
              <p className="text-sm leading-relaxed text-[#f5efe6]/90">{scenario.intro}</p>
              <p className="mt-2 text-xs text-[#e8b87a]/90">要诀：{scenario.tip}</p>
              <button
                type="button"
                onClick={() => setPhase("greet")}
                className="pointer-events-auto mt-4 w-full rounded-xl bg-accent py-3 text-sm font-medium text-white shadow-md hover:opacity-95"
              >
                入 场
              </button>
            </div>
          )}

          {phase === "greet" && (
            <div>
              <p className="mb-2 text-center text-xs text-[#f5efe6]/80">
                点选此刻最当先迎的宾客（先尊后卑）· 还剩 {remaining.length} 位
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {remaining.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGuest(g.id)}
                    className="pointer-events-auto rounded-lg border border-[#e8b87a]/35 bg-[#f5efe6]/10 px-3 py-2 text-left text-xs text-[#f5efe6] backdrop-blur-sm hover:border-accent hover:bg-accent/80"
                  >
                    <div className="font-medium">{g.name}</div>
                    <div className="text-[10px] text-[#f5efe6]/60">{RANK_META[g.rank].label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "bow" && focusGuest && (
            <div className="mx-auto max-w-sm">
              <p className="text-center text-xs text-[#f5efe6]/80">
                向{RANK_META[focusGuest.rank].label} {focusGuest.name} 行揖礼
              </p>
              <p className="mt-1 text-center text-[10px] text-[#e8b87a]/85">{focusGuest.note}</p>
              <div className="relative mx-auto mt-3 h-3 w-full overflow-hidden rounded-full bg-[#f5efe6]/15">
                <div
                  className="absolute inset-y-0 rounded-full bg-accent/70 transition-[left] duration-75"
                  style={{
                    left: `${Math.max(0, (RANK_META[focusGuest.rank].depth - (focusGuest.zoneW ?? scenario.zoneW)) * 100)}%`,
                    width: `${(focusGuest.zoneW ?? scenario.zoneW) * 200}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-1 bg-[#f5efe6] shadow"
                  style={{ left: `${bowDepth * 100}%` }}
                />
              </div>
              <button
                type="button"
                className="pointer-events-auto mt-3 w-full rounded-xl bg-accent py-3 text-sm font-medium text-white shadow-md active:scale-[0.98]"
                onPointerDown={() => setCharging(true)}
                onPointerUp={releaseBow}
                onPointerLeave={() => charging && releaseBow()}
              >
                {isTouch ? "按住作揖 · 松手定深浅" : "按住作揖 · 松手定深浅"}
              </button>
            </div>
          )}

          {phase === "seat" && seatTarget && (
            <div>
              <p className="mb-2 text-center text-xs text-[#f5efe6]/80">
                为 <span className="text-[#e8b87a]">{seatTarget.name}</span> 安排席位
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SEAT_NAMES.slice(0, guests.length).map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => assignSeat(idx)}
                    disabled={Object.values(assignments).includes(idx)}
                    className="pointer-events-auto rounded-lg border border-[#f5efe6]/25 bg-[#f5efe6]/10 px-4 py-2 text-xs text-[#f5efe6] backdrop-blur-sm disabled:opacity-40 hover:border-accent hover:bg-accent/70"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "banquet" && (
            <div>
              <p className="mb-2 text-center text-xs text-[#f5efe6]/80">
                金色时机内点按有需求的宾客；无事频扰反失「节」
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {guests.map((g) => {
                  const ev = liveEvents.find((e) => !e.resolved && e.guestId === g.id);
                  const t = ev ? (performance.now() - ev.startMs) / (ev.cfg.duration * 1000) : 0;
                  const inWin = ev && t >= ev.cfg.window[0] && t <= ev.cfg.window[1];
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => tapGuestBanquet(g.id)}
                      className={`pointer-events-auto rounded-lg border px-3 py-2 text-xs backdrop-blur-sm ${
                        ev
                          ? inWin
                            ? "border-[#e8b87a] bg-[#e8b87a]/20 text-[#f5efe6]"
                            : "border-accent bg-accent/35 text-[#f5efe6] animate-pulse"
                          : "border-[#f5efe6]/20 bg-[#f5efe6]/8 text-[#f5efe6]/75"
                      }`}
                    >
                      {ev ? `${ev.cfg.icon} ${ev.cfg.label}` : g.name.slice(0, 4)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {phase === "done" && (
            <p className="text-center font-serif text-lg text-[#e8b87a]">宾主尽欢 · 礼成</p>
          )}
        </div>
      </section>
    </div>
  );
}

function HallScene({ atmosphere }: { atmosphere: number }) {
  const warm = atmosphere / 100;
  const lanternIntensity = 0.55 + warm * 0.35;

  return (
    <>
      <color attach="background" args={[PAL.sky]} />
      <fog attach="fog" args={[PAL.fog, 10, 32]} />
      <hemisphereLight args={[PAL.sky, PAL.mat, 0.55 + warm * 0.15]} />
      <directionalLight position={[4, 9, 3]} intensity={0.45 + warm * 0.15} color="#fff8ef" />
      <pointLight position={[-2.2, 3.1, -1.5]} intensity={lanternIntensity} color={PAL.glow} distance={11} decay={2} />
      <pointLight position={[2.2, 3.1, -1.5]} intensity={lanternIntensity} color={PAL.glow} distance={11} decay={2} />
      <pointLight position={[0, 2.4, -4.8]} intensity={0.25 + warm * 0.2} color="#ffd8a8" distance={8} decay={2} />

      {/* 木地板 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2.5]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color={PAL.woodDark} roughness={0.92} metalness={0.02} />
      </mesh>
      {/* 席地圆毯 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, -3.6]}>
        <circleGeometry args={[3.45, 64]} />
        <meshStandardMaterial color={PAL.mat} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, -3.6]}>
        <ringGeometry args={[3.15, 3.45, 64]} />
        <meshStandardMaterial color={PAL.matEdge} roughness={0.9} />
      </mesh>

      {/* 四根立柱 */}
      {([-4.2, 4.2] as const).flatMap((x) =>
        [-1.2, -6.5].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 1.35, 0]}>
              <cylinderGeometry args={[0.14, 0.16, 2.7, 12]} />
              <meshStandardMaterial color={PAL.wood} roughness={0.78} />
            </mesh>
            <mesh position={[0, 2.72, 0]}>
              <boxGeometry args={[0.38, 0.12, 0.38]} />
              <meshStandardMaterial color={PAL.trim} roughness={0.65} />
            </mesh>
          </group>
        )),
      )}

      {/* 横梁 */}
      {[-1.2, -6.5].map((z) => (
        <mesh key={`beam-${z}`} position={[0, 2.75, z]}>
          <boxGeometry args={[8.8, 0.14, 0.22]} />
          <meshStandardMaterial color={PAL.woodDark} roughness={0.82} />
        </mesh>
      ))}

      {/* 纸壁 + 后墙 */}
      <mesh position={[0, 2.1, -7.8]}>
        <boxGeometry args={[10.5, 4.4, 0.12]} />
        <meshStandardMaterial color={PAL.paper} roughness={0.98} />
      </mesh>
      <mesh position={[-5.1, 2.1, -3.5]}>
        <boxGeometry args={[0.12, 4.4, 9]} />
        <meshStandardMaterial color={PAL.paper} roughness={0.98} />
      </mesh>
      <mesh position={[5.1, 2.1, -3.5]}>
        <boxGeometry args={[0.12, 4.4, 9]} />
        <meshStandardMaterial color={PAL.paper} roughness={0.98} />
      </mesh>

      {/* 屏风：三扇 + 朱砂边 */}
      {[-2.4, 0, 2.4].map((x) => (
        <group key={`screen-${x}`} position={[x, 0, -7.65]}>
          <mesh position={[0, 1.55, 0]}>
            <boxGeometry args={[1.85, 3.1, 0.06]} />
            <meshStandardMaterial color={PAL.paper} roughness={0.96} />
          </mesh>
          <mesh position={[0, 1.55, 0.04]}>
            <boxGeometry args={[1.65, 2.7, 0.02]} />
            <meshStandardMaterial color="#d4c4ae" roughness={1} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[1.9, 0.08, 0.12]} />
            <meshStandardMaterial color={PAL.woodDark} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* 低案几 + 酒器 */}
      <group position={[0, 0, -4.35]}>
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[2.6, 0.1, 1.2]} />
          <meshStandardMaterial color={PAL.wood} roughness={0.72} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 0.18, 0.35]}>
            <boxGeometry args={[0.1, 0.36, 0.1]} />
            <meshStandardMaterial color={PAL.woodDark} roughness={0.8} />
          </mesh>
        ))}
        {[-0.55, 0, 0.55].map((x) => (
          <mesh key={`cup-${x}`} position={[x, 0.48, 0]}>
            <cylinderGeometry args={[0.06, 0.05, 0.12, 10]} />
            <meshStandardMaterial color="#8b4513" roughness={0.55} metalness={0.15} />
          </mesh>
        ))}
      </group>

      {/* 灯笼 */}
      {[-2.2, 2.2].map((x) => (
        <group key={`lantern-${x}`} position={[x, 2.95, -1.5]}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.28, 0.55, 12, 1, true]} />
            <meshStandardMaterial color={PAL.lantern} emissive={PAL.glow} emissiveIntensity={0.15 + warm * 0.12} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.34, 0]}>
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial color={PAL.trim} roughness={0.5} metalness={0.2} />
          </mesh>
        </group>
      ))}

      {/* 门槛 / 前阶 */}
      <mesh position={[0, 0.06, 1.2]}>
        <boxGeometry args={[6.5, 0.12, 0.35]} />
        <meshStandardMaterial color={PAL.wood} roughness={0.8} />
      </mesh>
    </>
  );
}

function GuestFigure({
  guest,
  index,
  total,
  phase,
  highlighted,
  seated,
}: {
  guest: GuestState;
  index: number;
  total: number;
  phase: Phase;
  highlighted: boolean;
  seated: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const meta = RANK_META[guest.rank];

  const pos = useMemo(() => {
    if (seated && guest.seatIdx != null) {
      const angles = [-0.8, -0.25, 0.25, 0.8];
      const a = angles[guest.seatIdx] ?? 0;
      return new THREE.Vector3(Math.sin(a) * 2.8, 0, -3.8 + Math.cos(a) * 1.2);
    }
    const spread = (index - (total - 1) / 2) * 1.35;
    return new THREE.Vector3(spread, 0, -5.5);
  }, [index, total, seated, guest.seatIdx]);

  const robe = useMemo(() => new THREE.MeshStandardMaterial({
    color: meta.hex,
    roughness: 0.82,
    metalness: 0.03,
    emissive: highlighted ? PAL.highlight : "#000000",
    emissiveIntensity: highlighted ? 0.08 : 0,
  }), [meta.hex, highlighted]);

  const trim = useMemo(() => new THREE.MeshStandardMaterial({
    color: guest.rank === "honored" ? "#c9a227" : PAL.trim,
    roughness: 0.55,
    metalness: 0.12,
  }), [guest.rank]);

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.lerp(pos, 1 - Math.exp(-4 * dt));
    const bob = Math.sin(performance.now() / 900 + index) * 0.012;
    group.current.position.y = bob;

    const bowT = guest.bowFlash > 0 ? 0.38 * guest.bowFlash : 0;
    if (upper.current) {
      upper.current.rotation.x = THREE.MathUtils.lerp(upper.current.rotation.x, -bowT, 0.14);
    }
    group.current.rotation.y = THREE.MathUtils.lerp(
      group.current.rotation.y,
      seated ? Math.atan2(-group.current.position.x, 4) : 0,
      0.06,
    );
  });

  return (
    <group ref={group} position={pos.toArray()}>
      {/* 脚下光晕 */}
      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.42, 0.62, 32]} />
          <meshBasicMaterial color={PAL.glow} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* 坐席蒲团 */}
      {seated && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <circleGeometry args={[0.55, 24]} />
          <meshStandardMaterial color={PAL.matEdge} roughness={0.95} />
        </mesh>
      )}

      {/* 袍裙 */}
      <mesh position={[0, 0.52, 0]} material={robe}>
        <cylinderGeometry args={[0.28, 0.46, 1.05, 10]} />
      </mesh>
      {/* 腰带 */}
      <mesh position={[0, 0.92, 0.02]} material={trim}>
        <boxGeometry args={[0.52, 0.08, 0.24]} />
      </mesh>

      <group ref={upper}>
        {/* 上身 */}
        <mesh position={[0, 1.18, 0]} material={robe}>
          <boxGeometry args={[0.48, 0.42, 0.22]} />
        </mesh>
        {/* 广袖 */}
        <mesh position={[-0.38, 1.08, 0.04]} rotation={[0, 0, 0.22]} material={robe}>
          <boxGeometry args={[0.32, 0.1, 0.2]} />
        </mesh>
        <mesh position={[0.38, 1.08, 0.04]} rotation={[0, 0, -0.22]} material={robe}>
          <boxGeometry args={[0.32, 0.1, 0.2]} />
        </mesh>
        {/* 交叠双手 */}
        <mesh position={[0, 0.98, 0.14]}>
          <boxGeometry args={[0.18, 0.08, 0.1]} />
          <meshStandardMaterial color={PAL.skin} roughness={0.85} />
        </mesh>
        {/* 头 */}
        <mesh position={[0, 1.52, 0]}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial color={PAL.skin} roughness={0.88} />
        </mesh>
        {/* 冠 / 巾 */}
        {guest.rank === "honored" && (
          <mesh position={[0, 1.68, 0]}>
            <boxGeometry args={[0.34, 0.1, 0.22]} />
            <meshStandardMaterial color="#2c241c" roughness={0.7} />
          </mesh>
        )}
        {guest.rank === "elder" && (
          <mesh position={[0, 1.66, -0.02]}>
            <boxGeometry args={[0.28, 0.06, 0.24]} />
            <meshStandardMaterial color="#4a3728" roughness={0.75} />
          </mesh>
        )}
        {(guest.rank === "peer" || guest.rank === "junior") && (
          <mesh position={[0, 1.64, 0]}>
            <cylinderGeometry args={[0.12, 0.14, 0.08, 10]} />
            <meshStandardMaterial color="#5c4636" roughness={0.8} />
          </mesh>
        )}
        {/* 长者白须暗示 */}
        {guest.rank === "elder" && (
          <mesh position={[0, 1.38, 0.12]}>
            <boxGeometry args={[0.08, 0.12, 0.04]} />
            <meshStandardMaterial color="#e8e0d4" roughness={0.95} />
          </mesh>
        )}
      </group>

      {/* 姓名牌（仅高亮时） */}
      {highlighted && (phase === "greet" || phase === "banquet" || phase === "seat") && (
        <mesh position={[0, 1.95, 0]}>
          <planeGeometry args={[0.7, 0.18]} />
          <meshBasicMaterial color={PAL.ink} transparent opacity={0.72} />
        </mesh>
      )}
    </group>
  );
}

function SeatMarkers({ visible, count }: { visible: boolean; count: number }) {
  if (!visible) return null;
  const angles = [-0.8, -0.25, 0.25, 0.8].slice(0, count);
  return (
    <>
      {angles.map((a, i) => (
        <group key={i} position={[Math.sin(a) * 2.8, 0, -3.8 + Math.cos(a) * 1.2]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
            <ringGeometry args={[0.38, 0.58, 32]} />
            <meshBasicMaterial color={PAL.glow} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
            <circleGeometry args={[0.36, 24]} />
            <meshStandardMaterial color={PAL.mat} transparent opacity={0.35} roughness={1} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function BowSleeves({ depth }: { depth: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.rotation.x = -depth * 0.55;
    ref.current.position.y = 0.95 - depth * 0.25;
  });
  return (
    <group ref={ref} position={[0, 0.95, 0.35]}>
      <mesh position={[-0.28, 0, 0]} rotation={[0.3, 0.15, 0.25]}>
        <boxGeometry args={[0.22, 0.06, 0.38]} />
        <meshStandardMaterial color="#4a3728" roughness={0.85} />
      </mesh>
      <mesh position={[0.28, 0, 0]} rotation={[0.3, -0.15, -0.25]}>
        <boxGeometry args={[0.22, 0.06, 0.38]} />
        <meshStandardMaterial color="#4a3728" roughness={0.85} />
      </mesh>
      <mesh position={[0, -0.08, 0.12]}>
        <boxGeometry args={[0.14, 0.06, 0.1]} />
        <meshStandardMaterial color={PAL.skin} roughness={0.88} />
      </mesh>
    </group>
  );
}

function BowCamera({ depth }: { depth: number }) {
  useFrame(({ camera }) => {
    const target = -depth * 0.38;
    camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, target, 0.14);
  });
  return null;
}
