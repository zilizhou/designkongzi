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
        className="relative overflow-hidden rounded-2xl border border-line bg-[#1a1208] select-none"
        style={{ height: "min(68vh, 520px)", minHeight: 380, touchAction: "none" }}
      >
        <Canvas
          camera={{ position: [0, 1.62, 2.2], fov: 58, near: 0.1, far: 80 }}
          dpr={[1, 1.75]}
          onCreated={({ camera }) => {
            camera.lookAt(0, 1.35, -6);
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
          </Suspense>
        </Canvas>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/55 to-transparent p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-serif text-sm text-[#fde68a]">{scenario.place}</div>
              <div className="text-[11px] text-white/70">
                {phase === "intro" && "入场"}
                {phase === "greet" && "一幕 · 迎宾"}
                {phase === "bow" && "作揖"}
                {phase === "seat" && "二幕 · 安席"}
                {phase === "banquet" && "三幕 · 席间"}
                {phase === "done" && "礼成"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-white/60">全场气氛</div>
              <div className="font-serif text-lg text-[#fde68a]">{atmosphere}</div>
            </div>
          </div>
        </div>

        {toast && (
          <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/75 px-4 py-1.5 text-sm text-[#fde68a]">
            {toast}
          </div>
        )}

        {/* Phase overlays */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent p-4 pt-16">
          {phase === "intro" && (
            <div className="mx-auto max-w-md text-center">
              <p className="text-sm leading-relaxed text-white/90">{scenario.intro}</p>
              <p className="mt-2 text-xs text-[#fde68a]/90">要诀：{scenario.tip}</p>
              <button
                type="button"
                onClick={() => setPhase("greet")}
                className="pointer-events-auto mt-4 w-full rounded-xl bg-accent py-3 text-sm font-medium text-white"
              >
                入 场
              </button>
            </div>
          )}

          {phase === "greet" && (
            <div>
              <p className="mb-2 text-center text-xs text-white/80">
                点选此刻最当先迎的宾客（先尊后卑）· 还剩 {remaining.length} 位
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {remaining.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => pickGuest(g.id)}
                    className="pointer-events-auto rounded-lg border border-[#fde68a]/40 bg-black/60 px-3 py-2 text-left text-xs text-white hover:bg-accent/80"
                  >
                    <div className="font-medium">{g.name}</div>
                    <div className="text-[10px] text-white/60">{RANK_META[g.rank].label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "bow" && focusGuest && (
            <div className="mx-auto max-w-sm">
              <p className="text-center text-xs text-white/80">
                向{RANK_META[focusGuest.rank].label} {focusGuest.name} 行揖礼
              </p>
              <p className="mt-1 text-center text-[10px] text-[#fde68a]/80">{focusGuest.note}</p>
              <div className="relative mx-auto mt-3 h-3 w-full overflow-hidden rounded-full bg-white/15">
                <div
                  className="absolute inset-y-0 rounded-full bg-accent transition-[left] duration-75"
                  style={{
                    left: `${Math.max(0, (RANK_META[focusGuest.rank].depth - (focusGuest.zoneW ?? scenario.zoneW)) * 100)}%`,
                    width: `${(focusGuest.zoneW ?? scenario.zoneW) * 200}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-1 bg-white shadow"
                  style={{ left: `${bowDepth * 100}%` }}
                />
              </div>
              <button
                type="button"
                className="pointer-events-auto mt-3 w-full rounded-xl bg-accent py-3 text-sm font-medium text-white active:scale-[0.98]"
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
              <p className="mb-2 text-center text-xs text-white/80">
                为 <span className="text-[#fde68a]">{seatTarget.name}</span> 安排席位
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {SEAT_NAMES.slice(0, guests.length).map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => assignSeat(idx)}
                    disabled={Object.values(assignments).includes(idx)}
                    className="pointer-events-auto rounded-lg border border-white/25 bg-black/50 px-4 py-2 text-xs text-white disabled:opacity-40 hover:bg-accent/70"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {phase === "banquet" && (
            <div>
              <p className="mb-2 text-center text-xs text-white/80">
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
                      className={`pointer-events-auto rounded-lg border px-3 py-2 text-xs ${
                        ev
                          ? inWin
                            ? "border-[#fde68a] bg-[#fde68a]/20 text-[#fde68a]"
                            : "border-accent bg-accent/30 text-white animate-pulse"
                          : "border-white/20 bg-black/40 text-white/70"
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
            <p className="text-center font-serif text-lg text-[#fde68a]">宾主尽欢 · 礼成</p>
          )}
        </div>
      </section>
    </div>
  );
}

function HallScene({ atmosphere }: { atmosphere: number }) {
  const warm = atmosphere / 100;
  return (
    <>
      <color attach="background" args={[`rgb(${Math.round(20 + warm * 30)},${Math.round(12 + warm * 8)},${Math.round(6 + warm * 4)})`]} />
      <fog attach="fog" args={["#1a1208", 8, 28]} />
      <ambientLight intensity={0.35 + warm * 0.25} color="#ffedd5" />
      <pointLight position={[0, 3.5, -2]} intensity={0.8 + warm * 0.4} color="#fde68a" distance={14} />
      <pointLight position={[-4, 2.5, -5]} intensity={0.35} color="#993c1d" distance={10} />
      <pointLight position={[4, 2.5, -5]} intensity={0.35} color="#993c1d" distance={10} />
      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -2]} receiveShadow>
        <planeGeometry args={[18, 18]} />
        <meshStandardMaterial color="#3d2b1a" roughness={0.9} />
      </mesh>
      {/* 席地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -3.5]}>
        <circleGeometry args={[3.2, 48]} />
        <meshStandardMaterial color="#5c4030" roughness={0.85} />
      </mesh>
      {/* 案几 */}
      <mesh position={[0, 0.45, -4.2]}>
        <boxGeometry args={[2.8, 0.12, 1.4]} />
        <meshStandardMaterial color="#6b4423" />
      </mesh>
      {/* 后墙屏风 */}
      <mesh position={[0, 2.2, -8]}>
        <boxGeometry args={[10, 4.2, 0.2]} />
        <meshStandardMaterial color="#2a1810" />
      </mesh>
      {[ -3.5, -1.2, 1.2, 3.5 ].map((x) => (
        <mesh key={x} position={[x, 2.2, -7.85]}>
          <boxGeometry args={[1.6, 3.2, 0.08]} />
          <meshStandardMaterial color="#854f0b" opacity={0.85} transparent />
        </mesh>
      ))}
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

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.lerp(pos, 1 - Math.exp(-4 * dt));
    if (guest.bowFlash > 0) {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -0.35 * guest.bowFlash, 0.12);
    } else {
      group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0, 0.08);
    }
    const bob = Math.sin(performance.now() / 900 + index) * 0.02;
    group.current.position.y = bob;
  });

  const scale = highlighted ? 1.08 : 1;
  const emissive = highlighted ? 0.35 : guest.mood > 0 ? 0.15 : 0;

  return (
    <group ref={group} position={pos.toArray()} scale={scale}>
      <mesh position={[0, 0.95, 0]}>
        <capsuleGeometry args={[0.22, 0.65, 4, 8]} />
        <meshStandardMaterial color={meta.hex} emissive={meta.hex} emissiveIntensity={emissive} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#f6d4b8" />
      </mesh>
      {(phase === "banquet" || phase === "greet") && highlighted && (
        <mesh position={[0, 2.1, 0]}>
          <ringGeometry args={[0.28, 0.38, 24]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.85} side={THREE.DoubleSide} />
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
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[Math.sin(a) * 2.8, 0.04, -3.8 + Math.cos(a) * 1.2]}
        >
          <ringGeometry args={[0.35, 0.55, 32]} />
          <meshBasicMaterial color="#fde68a" transparent opacity={0.45} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function BowCamera({ depth }: { depth: number }) {
  useFrame(({ camera }) => {
    const target = -depth * 0.42;
    camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, target, 0.14);
  });
  return null;
}
