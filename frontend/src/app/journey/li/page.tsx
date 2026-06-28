"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { chooseLiOption, getLiProgress, getLiToday } from "@/lib/api";
import type { LiChooseResp, LiProgressResp, LiScenarioBrief } from "@/lib/types";

type View = "list" | "playing" | "result";
type Point = { x: number; y: number };
type Stats = { tension: number; trust: number; face: number; truth: number };
type Actor = {
  id: string;
  name: string;
  role: string;
  mood: string;
  color: string;
  x: number;
  y: number;
};
type Story = {
  title: string;
  kind: string;
  place: string;
  setting: string;
  lesson: string;
  scene: "transit" | "table" | "room" | "classroom" | "chat";
  actors: Actor[];
  bestKey: string;
  okayKey: string;
  failKey: string;
  special: string;
};
type SimSummary = {
  score: number;
  ending: string;
  stats: Stats;
  log: string[];
};

const CATEGORY_LABEL: Record<string, string> = {
  daily: "Everyday",
  work: "Work",
  friend: "Friends",
  family: "Family",
  school: "Campus",
  public: "Online",
};

const CATEGORY_COLOR: Record<string, string> = {
  daily: "#0F6E56",
  work: "#854F0B",
  friend: "#534AB7",
  family: "#993C1D",
  school: "#1E5F8E",
  public: "#7A4B36",
};

const DEFAULT_STORY: Story = {
  title: "Awkward Moment",
  kind: "Everyday",
  place: "a room under social pressure",
  setting: "A tense social moment is unfolding. Notice who is uncomfortable, move close enough to care, and respond without lying, attacking, or disappearing.",
  lesson: "Li is the art of making a tense moment livable.",
  scene: "table",
  bestKey: "B",
  okayKey: "A",
  failKey: "D",
  special: "Redirect",
  actors: [
    { id: "tense", name: "Tense Person", role: "at risk", mood: "defensive", color: "#993C1D", x: 34, y: 40 },
    { id: "bystander", name: "Bystander", role: "watching", mood: "uneasy", color: "#534AB7", x: 62, y: 43 },
    { id: "room", name: "Room", role: "social pressure", mood: "tight", color: "#854F0B", x: 50, y: 70 },
  ],
};

const STORY_COPY: Record<string, Story> = {
  "地铁让座": {
    title: "The Last Seat",
    kind: "Everyday",
    place: "crowded train",
    setting: "You finally got a seat. An elderly passenger with a cane gets on. Another exhausted rider sits beside you. You are late for an interview.",
    lesson: "Li begins by noticing who needs ease most, then acting without forcing others to perform your virtue.",
    scene: "transit",
    bestKey: "D",
    okayKey: "A",
    failKey: "B",
    special: "Offer Seat",
    actors: [
      { id: "elder", name: "Stranger", role: "needs care", mood: "exhausted", color: "#993C1D", x: 34, y: 38 },
      { id: "rider", name: "Rider", role: "also tired", mood: "burnt out", color: "#534AB7", x: 58, y: 45 },
      { id: "crowd", name: "Crowd", role: "watching", mood: "quiet pressure", color: "#854F0B", x: 48, y: 70 },
    ],
  },
  "聚餐听老板": {
    title: "The Endless Boss Story",
    kind: "Work",
    place: "team dinner",
    setting: "Your boss has been telling a founder story for 25 minutes. Everyone is quietly eating. The boss keeps looking at you for a reaction.",
    lesson: "Li is respect without flattery: stay present, then move the room toward something real.",
    scene: "table",
    bestKey: "C",
    okayKey: "B",
    failKey: "D",
    special: "Ask Real Question",
    actors: [
      { id: "boss", name: "Boss", role: "status holder", mood: "wants recognition", color: "#854F0B", x: 34, y: 38 },
      { id: "team", name: "Team", role: "audience", mood: "drained", color: "#534AB7", x: 64, y: 44 },
      { id: "table", name: "Table", role: "room mood", mood: "stuck", color: "#993C1D", x: 50, y: 70 },
    ],
  },
  "同事邀功": {
    title: "The Credit Grab",
    kind: "Work",
    place: "project review",
    setting: "A teammate presents your core work as a shared effort and spends most of the time on their own part. Now it is your turn.",
    lesson: "Li does not erase truth. It lets truth appear without turning the room into a battlefield.",
    scene: "table",
    bestKey: "B",
    okayKey: "D",
    failKey: "A",
    special: "State Facts",
    actors: [
      { id: "peer", name: "Peer", role: "face at risk", mood: "guarded", color: "#534AB7", x: 34, y: 40 },
      { id: "lead", name: "Lead", role: "decision maker", mood: "listening", color: "#854F0B", x: 62, y: 42 },
      { id: "team", name: "Team", role: "audience", mood: "watching", color: "#993C1D", x: 50, y: 70 },
    ],
  },
  "失恋朋友的质问": {
    title: "The Breakup Question",
    kind: "Friends",
    place: "late-night table",
    setting: "A friend has cried about a breakup for an hour. Suddenly they ask: 'Be honest. Did you always think they were bad for me?'",
    lesson: "Li receives the person before judging the event.",
    scene: "table",
    bestKey: "D",
    okayKey: "B",
    failKey: "A",
    special: "Ask What Hurts",
    actors: [
      { id: "friend", name: "Friend", role: "emotion center", mood: "fragile", color: "#534AB7", x: 36, y: 40 },
      { id: "memory", name: "Ex", role: "topic", mood: "charged", color: "#993C1D", x: 64, y: 42 },
      { id: "silence", name: "Silence", role: "pressure", mood: "heavy", color: "#854F0B", x: 50, y: 72 },
    ],
  },
  "朋友炫富": {
    title: "The Flexing Friend",
    kind: "Friends",
    place: "reunion table",
    setting: "An old classmate keeps talking about their car and new apartment. Other people at the table are getting uncomfortable.",
    lesson: "Li gives someone an exit ramp without humiliating them.",
    scene: "table",
    bestKey: "B",
    okayKey: "D",
    failKey: "C",
    special: "Change Topic",
    actors: [
      { id: "friend", name: "Friend", role: "unaware", mood: "performing", color: "#854F0B", x: 35, y: 38 },
      { id: "others", name: "Others", role: "audience", mood: "uncomfortable", color: "#534AB7", x: 64, y: 44 },
      { id: "room", name: "Room", role: "mood", mood: "awkward", color: "#993C1D", x: 50, y: 72 },
    ],
  },
  "父母的旧错": {
    title: "The Old Family Story",
    kind: "Family",
    place: "family meal",
    setting: "A parent brings up an old failure in front of relatives. Everyone is listening.",
    lesson: "Li is hardest with people close to us: it protects dignity without denying pain.",
    scene: "room",
    bestKey: "C",
    okayKey: "B",
    failKey: "A",
    special: "Acknowledge",
    actors: [
      { id: "parent", name: "Parent", role: "elder bond", mood: "hurt memory", color: "#993C1D", x: 35, y: 40 },
      { id: "family", name: "Family", role: "audience", mood: "listening", color: "#854F0B", x: 64, y: 44 },
      { id: "memory", name: "Old Story", role: "trigger", mood: "repeating", color: "#534AB7", x: 50, y: 72 },
    ],
  },
  "父母过度操心": {
    title: "The Too-Many Calls Problem",
    kind: "Family",
    place: "video call",
    setting: "Your parent calls several times a week with repeated reminders. You are busy and starting to feel trapped.",
    lesson: "Li can create a rhythm for care so love does not become pressure.",
    scene: "room",
    bestKey: "C",
    okayKey: "D",
    failKey: "A",
    special: "Set Rhythm",
    actors: [
      { id: "parent", name: "Parent", role: "worried", mood: "anxious", color: "#993C1D", x: 35, y: 40 },
      { id: "phone", name: "Phone", role: "pressure", mood: "buzzing", color: "#854F0B", x: 62, y: 44 },
      { id: "self", name: "Boundary", role: "need", mood: "thin", color: "#534AB7", x: 50, y: 72 },
    ],
  },
  "同学考试求看": {
    title: "The Exam Whisper",
    kind: "Campus",
    place: "quiet exam room",
    setting: "A close classmate silently asks to see your answer. The teacher is new and not watching closely.",
    lesson: "Li protects the shared order while trying not to shame the person.",
    scene: "classroom",
    bestKey: "C",
    okayKey: "A",
    failKey: "B",
    special: "Signal No",
    actors: [
      { id: "classmate", name: "Classmate", role: "friend", mood: "panicking", color: "#534AB7", x: 35, y: 42 },
      { id: "teacher", name: "Teacher", role: "rule keeper", mood: "unaware", color: "#854F0B", x: 64, y: 38 },
      { id: "room", name: "Room", role: "shared order", mood: "quiet", color: "#993C1D", x: 50, y: 72 },
    ],
  },
  "群里被攻击": {
    title: "The Group Chat Attack",
    kind: "Online",
    place: "large group chat",
    setting: "You share an article. Someone publicly replies: 'People still believe this? So shallow,' and tags you.",
    lesson: "Li moves conflict from ego back to reason, often by changing the channel.",
    scene: "chat",
    bestKey: "B",
    okayKey: "C",
    failKey: "A",
    special: "Private DM",
    actors: [
      { id: "critic", name: "Critic", role: "provoker", mood: "sharp", color: "#534AB7", x: 35, y: 40 },
      { id: "chat", name: "Chat", role: "audience", mood: "watching", color: "#854F0B", x: 64, y: 44 },
      { id: "ego", name: "Ego", role: "trigger", mood: "hot", color: "#993C1D", x: 50, y: 72 },
    ],
  },
  "网约车的等待": {
    title: "The Late Ride",
    kind: "Everyday",
    place: "rideshare car",
    setting: "Your ride arrives 20 minutes late. The driver starts complaining about traffic. You are rushing to a meeting.",
    lesson: "Li sees the person inside the service role.",
    scene: "transit",
    bestKey: "C",
    okayKey: "B",
    failKey: "D",
    special: "Human Reply",
    actors: [
      { id: "driver", name: "Driver", role: "stranger", mood: "frustrated", color: "#854F0B", x: 35, y: 40 },
      { id: "clock", name: "Clock", role: "pressure", mood: "urgent", color: "#993C1D", x: 64, y: 44 },
      { id: "car", name: "Car", role: "room", mood: "tense", color: "#534AB7", x: 50, y: 72 },
    ],
  },
};

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, n));
}

function storyFor(s: LiScenarioBrief): Story {
  return STORY_COPY[s.title] ?? {
    ...DEFAULT_STORY,
    title: s.title,
    setting: s.setting,
    kind: CATEGORY_LABEL[s.category] ?? s.category,
  };
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function roomScore(stats: Stats) {
  return Math.round(
    (100 - stats.tension) * 0.35 +
      stats.trust * 0.25 +
      stats.face * 0.2 +
      stats.truth * 0.2,
  );
}

function chooseKey(story: Story, stats: Stats, usedSpecial: boolean, listened: boolean) {
  const score = roomScore(stats);
  if (usedSpecial || (score >= 68 && listened)) return story.bestKey;
  if (score >= 48) return story.okayKey;
  return story.failKey;
}

function applyStats(stats: Stats, patch: Partial<Stats>) {
  return {
    tension: clamp(stats.tension + (patch.tension ?? 0)),
    trust: clamp(stats.trust + (patch.trust ?? 0)),
    face: clamp(stats.face + (patch.face ?? 0)),
    truth: clamp(stats.truth + (patch.truth ?? 0)),
  };
}

export default function LiGamePage() {
  const [view, setView] = useState<View>("list");
  const [progress, setProgress] = useState<LiProgressResp | null>(null);
  const [scenarios, setScenarios] = useState<LiScenarioBrief[]>([]);
  const [current, setCurrent] = useState<LiScenarioBrief | null>(null);
  const [result, setResult] = useState<LiChooseResp | null>(null);
  const [summary, setSummary] = useState<SimSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => {
    getLiToday()
      .then((d) => setScenarios(d.scenarios))
      .catch(() => setErr("无法连接后端"));
    getLiProgress().then(setProgress).catch(() => {});
  };

  useEffect(refresh, []);

  const play = (scenario: LiScenarioBrief) => {
    setCurrent(scenario);
    setResult(null);
    setSummary(null);
    setView("playing");
  };

  const resolve = async (optionKey: string, nextSummary: SimSummary) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await chooseLiOption(current.id, optionKey);
      setResult(r);
      setSummary(nextSummary);
      setView("result");
    } finally {
      setBusy(false);
    }
  };

  const backToList = () => {
    setView("list");
    setCurrent(null);
    setResult(null);
    setSummary(null);
    refresh();
  };

  if (err) {
    return <div className="rounded-lg bg-accent-soft p-4 text-sm text-accent">{err}</div>;
  }

  if (view === "playing" && current) {
    return <Simulator scenario={current} busy={busy} onBack={backToList} onResolve={resolve} />;
  }

  if (view === "result" && current && result && summary) {
    return <ResultView scenario={current} result={result} summary={summary} onBack={backToList} />;
  }

  return <ListView progress={progress} scenarios={scenarios} onPlay={play} />;
}

function ListView({
  progress,
  scenarios,
  onPlay,
}: {
  progress: LiProgressResp | null;
  scenarios: LiScenarioBrief[];
  onPlay: (s: LiScenarioBrief) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/journey" className="text-xs text-faint hover:text-accent">
          ← 君子之路
        </Link>
        <div className="font-serif text-lg text-fg">礼 · Save the Room</div>
        <div className="w-16" />
      </div>

      <section className="rounded-lg border border-line bg-surface p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <div className="font-serif text-3xl text-fg">Li Simulator</div>
            <div className="text-xs text-faint">
              Move, pause, listen, speak, and step back before the room breaks.
            </div>
          </div>
          {progress && (
            <div className="ml-auto flex gap-4 text-right">
              <ScoreBlock label="Principle" value={progress.ru_score} color="#993C1D" />
              <ScoreBlock label="Care" value={progress.qing_score} color="#0F6E56" />
            </div>
          )}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
          Li is not a etiquette quiz. It is a real-time sense of distance, timing, attention,
          and speech. Save an awkward moment without lying, attacking, or disappearing.
        </p>
      </section>

      <section>
        <div className="mb-2 text-xs text-faint">Choose a social crisis</div>
        <div className="grid gap-3 md:grid-cols-3">
          {scenarios.map((scenario) => {
            const story = storyFor(scenario);
            return (
              <button
                key={scenario.id}
                onClick={() => onPlay(scenario)}
                className="group relative overflow-hidden rounded-lg border border-line bg-surface p-4 text-left transition hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
                style={{
                  borderLeftWidth: 4,
                  borderLeftColor: CATEGORY_COLOR[scenario.category] ?? "#888",
                }}
              >
                <span
                  className="inline-block rounded-full px-2 py-0.5 text-[10px] text-white"
                  style={{ background: CATEGORY_COLOR[scenario.category] ?? "#888" }}
                >
                  {story.kind}
                </span>
                <h3 className="mt-2 font-serif text-base font-medium text-fg">{story.title}</h3>
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                  {story.setting}
                </p>
                {scenario.played && (
                  <span className="absolute right-2 top-2 rounded-full bg-cel-soft px-2 py-0.5 text-[10px] text-cel-ink">
                    replay
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {scenarios.length === 0 && (
          <div className="rounded-lg border border-line bg-surface p-8 text-center text-xs text-faint">
            场景准备中…
          </div>
        )}
      </section>
    </div>
  );
}

function Simulator({
  scenario,
  busy,
  onBack,
  onResolve,
}: {
  scenario: LiScenarioBrief;
  busy: boolean;
  onBack: () => void;
  onResolve: (optionKey: string, summary: SimSummary) => void;
}) {
  const story = useMemo(() => storyFor(scenario), [scenario]);
  const [player, setPlayer] = useState<Point>({ x: 76, y: 70 });
  const [targetId, setTargetId] = useState(story.actors[0]?.id ?? "");
  const [stats, setStats] = useState<Stats>({ tension: 68, trust: 42, face: 55, truth: 45 });
  const [log, setLog] = useState<string[]>(["The room is tense. Notice before reacting."]);
  const [listened, setListened] = useState(false);
  const [usedSpecial, setUsedSpecial] = useState(false);
  const [lastLine, setLastLine] = useState("Click the floor to move. Click a person to focus.");

  const target = story.actors.find((a) => a.id === targetId) ?? story.actors[0];
  const near = target ? distance(player, target) < 18 : false;
  const score = roomScore(stats);

  const addLog = (line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 4));
    setLastLine(line);
  };

  const changeStats = (patch: Partial<Stats>, line: string) => {
    setStats((prev) => applyStats(prev, patch));
    addLog(line);
  };

  const pause = () => {
    changeStats({ tension: -6, truth: 5, face: 2 }, "You pause. The room gets a little less reactive.");
  };

  const listen = () => {
    if (!near) {
      changeStats({ tension: 4, trust: -3 }, "You are too far away to really listen.");
      return;
    }
    setListened(true);
    changeStats({ tension: -12, trust: 13, face: 6 }, `You listen to ${target.name}. They feel seen.`);
  };

  const speak = () => {
    if (!near) {
      changeStats({ tension: 8, face: -5, truth: 4 }, "You speak from across the room. It lands badly.");
      return;
    }
    changeStats({ tension: -7, trust: 5, truth: 12, face: 2 }, "You speak with measure. Truth enters without humiliation.");
  };

  const stepBack = () => {
    setPlayer((p) => ({ x: clamp(p.x + 9, 8, 92), y: clamp(p.y + 5, 18, 84) }));
    changeStats({ tension: -5, face: 5, trust: -1 }, "You step back and give the moment space.");
  };

  const special = () => {
    if (!near) {
      changeStats({ tension: 5, trust: -2 }, `Get closer before using ${story.special}.`);
      return;
    }
    setUsedSpecial(true);
    setListened(true);
    changeStats(
      { tension: -18, trust: 16, face: 14, truth: 8 },
      `${story.special}: you give the room a way forward.`,
    );
  };

  const finish = () => {
    const key = chooseKey(story, stats, usedSpecial, listened);
    const ending =
      score >= 72
        ? "You saved the room."
        : score >= 50
        ? "You kept the room from breaking."
        : "The room survived, but the tension stayed.";
    onResolve(key, { score, ending, stats, log });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-faint hover:text-accent">
          ← Back
        </button>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] text-white"
          style={{ background: CATEGORY_COLOR[scenario.category] ?? "#888" }}
        >
          {story.kind}
        </span>
      </div>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-faint">Li Simulator</div>
            <h2 className="mt-1 font-serif text-2xl text-fg">{story.title}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{story.setting}</p>
          </div>
          <div className="rounded-lg bg-accent-soft px-3 py-2 text-right">
            <div className="text-[10px] text-accent">Room score</div>
            <div className="font-serif text-3xl text-accent-ink">{score}</div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
          <StatusStrip stats={stats} />
          <div
            className="relative h-[620px] cursor-crosshair overflow-hidden bg-gradient-to-b from-slate-100 via-amber-50 to-emerald-100"
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              const rect = e.currentTarget.getBoundingClientRect();
              setPlayer({
                x: clamp(((e.clientX - rect.left) / rect.width) * 100, 6, 94),
                y: clamp(((e.clientY - rect.top) / rect.height) * 100, 12, 88),
              });
              addLog("You move. Distance changes what actions mean.");
            }}
          >
            <SceneBack scene={story.scene} />
            <button
              onClick={(e) => {
                e.stopPropagation();
                finish();
              }}
              disabled={busy}
              className="absolute right-4 top-4 z-10 rounded-full bg-accent px-4 py-2 text-xs font-medium text-white shadow-lg transition hover:brightness-105 disabled:opacity-50"
            >
              {busy ? "Resolving..." : "Finish"}
            </button>
            <div className="absolute left-4 top-4 max-w-[min(520px,calc(100%-160px))] rounded-full bg-white/85 px-3 py-1 text-[10px] text-muted shadow-sm">
              {lastLine}
            </div>
            {story.actors.map((actor) => (
              <ActorButton
                key={actor.id}
                actor={actor}
                active={actor.id === targetId}
                onClick={() => {
                  setTargetId(actor.id);
                  addLog(`You focus on ${actor.name}.`);
                }}
              />
            ))}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
              style={{ left: `${player.x}%`, top: `${player.y}%` }}
            >
              <div className="flex flex-col items-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-cel text-base font-semibold text-white shadow-lg">
                  You
                </div>
                <div className="mt-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-fg">
                  {near ? `near ${target.name}` : "move closer"}
                </div>
              </div>
            </div>

            <div className="absolute right-4 top-16 z-10 w-56 rounded-lg border border-line bg-white/90 p-3 shadow-lg backdrop-blur">
              <div className="text-[10px] uppercase tracking-[0.16em] text-faint">Focus</div>
              <div className="mt-1 font-serif text-lg text-fg">{target.name}</div>
              <div className="text-xs text-muted">{target.role}</div>
              <div className="mt-2 text-xs text-faint">{target.mood}</div>
              <div className={`mt-2 text-xs ${near ? "text-cel" : "text-accent"}`}>
                {near ? "In conversation range" : "Too far to connect"}
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 z-10 rounded-xl border border-line bg-white/90 p-3 shadow-xl backdrop-blur">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div>
                  <div className="font-serif text-sm text-fg">Act in the room</div>
                  <div className="text-[10px] text-faint">Move by clicking the floor. Then choose timing, attention, speech, or distance.</div>
                </div>
                <div className="hidden rounded-full bg-surface-2 px-3 py-1 text-[10px] text-muted sm:block">
                  {near ? `near ${target.name}` : "move closer to connect"}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <ControlButton label="Pause" onClick={pause} />
                <ControlButton label="Listen" onClick={listen} />
                <ControlButton label="Speak" onClick={speak} />
                <ControlButton label="Step Back" onClick={stepBack} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    special();
                  }}
                  className="rounded-lg border border-accent bg-accent-soft px-3 py-2 text-sm font-medium text-accent-ink hover:bg-accent hover:text-white"
                >
                  {story.special}
                </button>
              </div>
            </div>

            <div className="absolute bottom-32 left-4 z-10 hidden w-72 space-y-1 lg:block">
              {log.map((item, index) => (
                <div key={`${item}-${index}`} className="rounded-full bg-white/80 px-3 py-1.5 text-[10px] leading-relaxed text-muted shadow-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
      </section>
    </div>
  );
}

function StatusStrip({ stats }: { stats: Stats }) {
  return (
    <div className="grid gap-2 border-b border-line p-3 sm:grid-cols-4">
      <Meter label="Tension" value={stats.tension} color="#C2410C" invert />
      <Meter label="Trust" value={stats.trust} color="#0F6E56" />
      <Meter label="Face" value={stats.face} color="#854F0B" />
      <Meter label="Truth" value={stats.truth} color="#534AB7" />
    </div>
  );
}

function Meter({
  label,
  value,
  color,
  invert = false,
}: {
  label: string;
  value: number;
  color: string;
  invert?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] text-faint">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value}%`, background: invert && value > 70 ? "#DC2626" : color }}
        />
      </div>
    </div>
  );
}

function SceneBack({ scene }: { scene: Story["scene"] }) {
  if (scene === "chat") {
    return (
      <>
        <div className="absolute left-[16%] top-[18%] h-16 w-[68%] rounded-2xl bg-white/70 shadow-sm" />
        <div className="absolute left-[22%] top-[23%] h-3 w-[42%] rounded bg-violet-200/80" />
        <div className="absolute left-[28%] top-[54%] h-20 w-[44%] rounded-3xl bg-white/50" />
      </>
    );
  }
  if (scene === "classroom") {
    return (
      <>
        <div className="absolute left-[18%] top-[12%] h-16 w-[64%] rounded border border-slate-500/30 bg-emerald-900/70" />
        <div className="absolute left-[24%] top-[58%] h-12 w-[52%] rounded bg-amber-900/20" />
      </>
    );
  }
  if (scene === "transit") {
    return (
      <>
        <div className="absolute left-[8%] top-[14%] h-24 w-[84%] rounded-lg border border-slate-400/40 bg-white/40" />
        <div className="absolute left-[18%] top-[18%] h-16 w-[18%] rounded border border-slate-400/50 bg-sky-50/80" />
        <div className="absolute left-[42%] top-[18%] h-16 w-[18%] rounded border border-slate-400/50 bg-sky-50/80" />
        <div className="absolute left-[66%] top-[18%] h-16 w-[18%] rounded border border-slate-400/50 bg-sky-50/80" />
        <div className="absolute left-[12%] top-[58%] h-8 w-[76%] rounded-full bg-slate-300/70" />
      </>
    );
  }
  if (scene === "room") {
    return (
      <>
        <div className="absolute left-[10%] top-[12%] h-20 w-[80%] rounded-lg border border-red-900/10 bg-white/35" />
        <div className="absolute left-[30%] top-[48%] h-28 w-[40%] rounded-[50%] bg-amber-800/20 shadow-inner" />
      </>
    );
  }
  return (
    <>
      <div className="absolute left-[23%] top-[35%] h-32 w-[54%] rounded-[50%] border border-amber-900/20 bg-white/45 shadow-inner" />
      <div className="absolute left-[33%] top-[45%] h-12 w-[34%] rounded-[50%] bg-amber-900/20" />
    </>
  );
}

function ActorButton({
  actor,
  active,
  onClick,
}: {
  actor: Actor;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 transition ${
        active ? "scale-110" : "hover:scale-105"
      }`}
      style={{ left: `${actor.x}%`, top: `${actor.y}%` }}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-sm font-semibold text-white shadow-lg ${
          active ? "border-accent" : "border-white"
        }`}
        style={{ background: actor.color }}
      >
        {actor.name.slice(0, 1)}
      </span>
      <span className="mt-1 block rounded-full bg-white/90 px-2 py-0.5 text-[10px] text-fg shadow-sm">
        {actor.name}
      </span>
    </button>
  );
}

function ControlButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-fg hover:border-accent hover:bg-accent-soft"
    >
      {label}
    </button>
  );
}

function ResultView({
  scenario,
  result,
  summary,
  onBack,
}: {
  scenario: LiScenarioBrief;
  result: LiChooseResp;
  summary: SimSummary;
  onBack: () => void;
}) {
  const story = storyFor(scenario);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-faint hover:text-accent">
          ← Back to missions
        </button>
        <div className="text-xs text-faint">{story.title}</div>
      </div>

      <section className="rounded-lg border-2 border-accent bg-accent-soft p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-accent">Result</div>
            <h2 className="mt-1 font-serif text-2xl text-accent-ink">{summary.ending}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{story.lesson}</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-accent">Room score</div>
            <div className="font-serif text-4xl text-accent-ink">{summary.score}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <Meter label="Tension" value={summary.stats.tension} color="#C2410C" invert />
          <Meter label="Trust" value={summary.stats.trust} color="#0F6E56" />
          <Meter label="Face" value={summary.stats.face} color="#854F0B" />
          <Meter label="Truth" value={summary.stats.truth} color="#534AB7" />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <DeltaBlock label="Principle" delta={result.chosen.ru_delta} comment={result.chosen.comment_ru} />
        <DeltaBlock label="Care" delta={result.chosen.qing_delta} comment={result.chosen.comment_others} />
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-faint">What this teaches about Li</div>
        <div className="mt-2 font-serif text-lg text-fg">Li is embodied timing.</div>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          You practiced distance, pause, listening, speech, and retreat. In Confucian terms,
          Li is not decorative etiquette. It is the ability to protect dignity while bringing
          a tense relationship back into livable order.
        </p>
      </section>

      {result.chosen.refs.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs text-faint">Confucian clue unlocked</div>
          {result.chosen.refs.map((ref) => (
            <div key={ref.ref_id} className="rounded-r-lg border-l-[3px] border-accent bg-accent-soft px-3 py-2">
              <div className="font-serif text-sm leading-relaxed text-accent-ink">{ref.text}</div>
              <div className="mt-1 text-[10px] text-accent">{ref.ref_label}</div>
            </div>
          ))}
        </section>
      )}

      <button onClick={onBack} className="w-full rounded-lg bg-accent py-3 text-sm font-medium text-white">
        Next mission
      </button>
    </div>
  );
}

function ScoreBlock({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="font-serif text-2xl" style={{ color }}>
        {value > 0 ? `+${value}` : value}
      </div>
      <div className="text-[10px] text-faint">{label}</div>
    </div>
  );
}

function DeltaBlock({
  label,
  delta,
  comment,
}: {
  label: string;
  delta: number;
  comment: string;
}) {
  const positive = delta > 0;
  const negative = delta < 0;
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs text-faint">{label}</span>
        <span
          className={`font-serif text-xl font-medium ${
            positive ? "text-emerald-600" : negative ? "text-red-600" : "text-muted"
          }`}
        >
          {positive ? "+" : ""}
          {delta}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted">{comment}</p>
    </div>
  );
}
