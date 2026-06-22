"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chooseLiOption, getLiProgress, getLiToday } from "@/lib/api";
import type {
  LiChooseResp,
  LiProgressResp,
  LiScenarioBrief,
} from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  daily: "公共空间",
  work: "职场",
  friend: "朋友",
  family: "家庭",
  school: "校园",
  public: "公共讨论",
};
const CATEGORY_COLOR: Record<string, string> = {
  daily: "#0F6E56",
  work: "#854F0B",
  friend: "#534AB7",
  family: "#993C1D",
  school: "#1E5F8E",
  public: "#7A4B36",
};

type View = "list" | "playing" | "result";

export default function LiGamePage() {
  const [view, setView] = useState<View>("list");
  const [progress, setProgress] = useState<LiProgressResp | null>(null);
  const [scenarios, setScenarios] = useState<LiScenarioBrief[]>([]);
  const [current, setCurrent] = useState<LiScenarioBrief | null>(null);
  const [result, setResult] = useState<LiChooseResp | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const refresh = () => {
    getLiToday()
      .then((d) => setScenarios(d.scenarios))
      .catch(() => setErr("无法连接后端"));
    getLiProgress().then(setProgress).catch(() => {});
  };

  useEffect(refresh, []);

  const play = (s: LiScenarioBrief) => {
    setCurrent(s);
    setResult(null);
    setView("playing");
  };

  const choose = async (optionKey: string) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await chooseLiOption(current.id, optionKey);
      setResult(r);
      setView("result");
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setView("list");
    setCurrent(null);
    setResult(null);
    refresh();
  };

  if (err)
    return <div className="rounded-xl bg-accent-soft p-4 text-sm text-accent">{err}</div>;

  if (view === "playing" && current)
    return (
      <PlayingView
        s={current}
        hoverKey={hoverKey}
        setHoverKey={setHoverKey}
        onChoose={choose}
        onBack={goBack}
        busy={busy}
      />
    );

  if (view === "result" && current && result)
    return <ResultView s={current} r={result} onBack={goBack} />;

  return <ListView progress={progress} scenarios={scenarios} onPlay={play} />;
}

// ── 列表（首页） ─────────────────────────────────────────────────
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
      {/* 顶部：返回 + 标题 */}
      <div className="flex items-center justify-between">
        <Link href="/journey" className="text-xs text-faint hover:text-accent">
          ← 君子之路
        </Link>
        <div className="font-serif text-lg text-fg">礼 · 情境抉择</div>
        <div className="w-16" />
      </div>

      {/* 进度卡 */}
      {progress && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-end gap-x-5 gap-y-2 flex-wrap">
            <div>
              <div className="font-serif text-3xl text-fg">{progress.title}</div>
              <div className="text-xs text-faint">
                完成 {progress.total_played} / {progress.total_scenarios} 情境
              </div>
            </div>
            <div className="ml-auto flex gap-3 text-right">
              <ScoreBlock label="儒分" value={progress.ru_score} color="#993C1D" hint="是否合于经典之礼" />
              <ScoreBlock label="情分" value={progress.qing_score} color="#0F6E56" hint="他人感受" />
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            儒家讲「礼之本」在「敬」与「情境合宜」。两个分数会冲突——这正是礼在当代最难的地方。
          </p>
        </section>
      )}

      {/* 今日 3 场景 */}
      <section>
        <div className="mb-2 text-xs text-faint">今日情境（3）· 点选进入</div>
        <div className="grid gap-3 md:grid-cols-3">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => onPlay(s)}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left transition-all hover:-translate-y-1 hover:shadow-lg active:scale-[0.98]"
              style={{ borderLeftWidth: 4, borderLeftColor: CATEGORY_COLOR[s.category] ?? "#888" }}
            >
              <span
                className="inline-block rounded-full px-2 py-0.5 text-[10px] text-white"
                style={{ background: CATEGORY_COLOR[s.category] ?? "#888" }}
              >
                {CATEGORY_LABEL[s.category] ?? s.category}
              </span>
              <h3 className="mt-2 font-serif text-base font-medium text-fg">{s.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted">
                {s.setting}
              </p>
              {s.played && (
                <span className="absolute right-2 top-2 rounded-full bg-cel-soft px-2 py-0.5 text-[10px] text-cel-ink">
                  ✓ 已玩
                </span>
              )}
            </button>
          ))}
        </div>
        {scenarios.length === 0 && (
          <div className="rounded-2xl border border-line bg-surface p-8 text-center text-xs text-faint">
            场景准备中…
          </div>
        )}
      </section>

      {/* 已解锁经典 */}
      {progress && progress.unlocked_refs.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 text-sm font-medium text-fg">
            🏛  已解锁经典 · {progress.unlocked_refs.length}
          </div>
          <div className="space-y-2">
            {progress.unlocked_refs.map((r) => (
              <div
                key={r.ref_id}
                className="rounded-r-lg border-l-[3px] border-accent bg-accent-soft px-3 py-2"
              >
                <div className="font-serif text-sm text-accent-ink">{r.text}</div>
                <div className="mt-1 text-[10px] text-accent">{r.ref_label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ScoreBlock({
  label,
  value,
  color,
  hint,
}: {
  label: string;
  value: number;
  color: string;
  hint: string;
}) {
  return (
    <div className="text-right" title={hint}>
      <div className="font-serif text-2xl" style={{ color }}>
        {value > 0 ? `+${value}` : value}
      </div>
      <div className="text-[10px] text-faint">{label}</div>
    </div>
  );
}

// ── 玩 ─────────────────────────────────────────────
function PlayingView({
  s,
  hoverKey,
  setHoverKey,
  onChoose,
  onBack,
  busy,
}: {
  s: LiScenarioBrief;
  hoverKey: string | null;
  setHoverKey: (k: string | null) => void;
  onChoose: (k: string) => void;
  onBack: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-faint hover:text-accent">
          ← 返回
        </button>
        <span
          className="rounded-full px-2 py-0.5 text-[10px] text-white"
          style={{ background: CATEGORY_COLOR[s.category] ?? "#888" }}
        >
          {CATEGORY_LABEL[s.category] ?? s.category}
        </span>
      </div>

      {/* 情境卡：放大、纸质感 */}
      <section className="rounded-2xl border border-line bg-accent-soft p-6 shadow-sm">
        <h2 className="mb-4 font-serif text-xl text-accent-ink">{s.title}</h2>
        <p className="font-serif leading-loose tracking-wide text-fg">{s.setting}</p>
      </section>

      <div className="text-xs text-faint">你会怎么做？</div>

      {/* 4 选项：悬停放大，按下缩小，焦点感强 */}
      <div className="grid gap-3 sm:grid-cols-2">
        {s.options.map((o) => {
          const isHover = hoverKey === o.key;
          const isOther = hoverKey !== null && !isHover;
          return (
            <button
              key={o.key}
              onMouseEnter={() => setHoverKey(o.key)}
              onMouseLeave={() => setHoverKey(null)}
              onTouchStart={() => setHoverKey(o.key)}
              onClick={() => onChoose(o.key)}
              disabled={busy}
              className={`group flex gap-3 rounded-2xl border bg-surface p-4 text-left transition-all duration-200 ${
                isHover
                  ? "scale-[1.03] border-accent shadow-lg"
                  : isOther
                  ? "scale-[0.98] border-line opacity-50"
                  : "border-line hover:-translate-y-0.5"
              } active:scale-[0.96] disabled:opacity-40`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-serif text-sm font-medium transition-colors ${
                  isHover ? "bg-accent text-white" : "bg-surface-2 text-muted"
                }`}
              >
                {o.key}
              </span>
              <span className="flex-1 text-sm leading-relaxed text-fg">{o.text}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-[10px] text-faint">
        提示：每个选择都会同时影响「儒分」与「情分」——很多时候两者会冲突。
      </p>
    </div>
  );
}

// ── 结果 ────────────────────────────────────────────
function ResultView({
  s,
  r,
  onBack,
}: {
  s: LiScenarioBrief;
  r: LiChooseResp;
  onBack: () => void;
}) {
  const [showAll, setShowAll] = useState(false);

  return (
    <div className="animate-fadein space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="text-xs text-faint hover:text-accent">
          ← 返回今日
        </button>
        <div className="text-xs text-faint">{s.title}</div>
      </div>

      {/* 你的选择 + 双视角 */}
      <section className="rounded-2xl border-2 border-accent bg-accent-soft p-5">
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent font-serif text-white">
            {r.chosen.key}
          </span>
          <div className="font-serif text-base text-accent-ink">{r.chosen.text}</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DeltaBlock
            label="儒分"
            delta={r.chosen.ru_delta}
            color="#993C1D"
            comment={r.chosen.comment_ru}
          />
          <DeltaBlock
            label="情分"
            delta={r.chosen.qing_delta}
            color="#0F6E56"
            comment={r.chosen.comment_others}
          />
        </div>
      </section>

      {/* 经典依据：解锁卡 */}
      {r.chosen.refs.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2 text-xs text-faint">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {r.new_unlocked_refs.length > 0
              ? `新解锁 ${r.new_unlocked_refs.length} 句经典依据`
              : "本题相关经典"}
          </div>
          <div className="space-y-2">
            {r.chosen.refs.map((ref) => {
              const isNew = r.new_unlocked_refs.includes(ref.ref_id);
              return (
                <div
                  key={ref.ref_id}
                  className={`rounded-r-lg border-l-[3px] px-3 py-2 transition-all ${
                    isNew
                      ? "animate-unlock border-gold bg-gradient-to-r from-amber-50 to-accent-soft"
                      : "border-accent bg-accent-soft"
                  }`}
                >
                  {isNew && (
                    <span className="mb-1 inline-block rounded-full bg-gold/30 px-2 py-0.5 text-[10px] text-amber-700">
                      ★ 新解锁
                    </span>
                  )}
                  <div className="font-serif text-sm leading-relaxed text-accent-ink">
                    {ref.text}
                  </div>
                  <div className="mt-1 text-[10px] text-accent">{ref.ref_label}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 当前进度 */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-end justify-between gap-3 text-sm">
          <div>
            <div className="text-[10px] text-faint">累计</div>
            <div className="font-serif text-fg">
              儒 <span className="text-cinnabar">{r.progress.ru_score}</span> · 情{" "}
              <span className="text-cel">{r.progress.qing_score}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-faint">六艺·礼</div>
            <div className="font-serif text-fg">{r.progress.liuyi_li} / 100</div>
          </div>
          <div>
            <div className="text-[10px] text-faint">经典图鉴</div>
            <div className="font-serif text-fg">{r.progress.unlocked_count} 句</div>
          </div>
        </div>
      </section>

      {/* 看其他选项怎么样 */}
      <button
        onClick={() => setShowAll(!showAll)}
        className="w-full rounded-xl border border-line bg-surface p-3 text-sm text-muted hover:bg-surface-2"
      >
        {showAll ? "收起" : "看看其他选项会怎样 →"}
      </button>

      {showAll && (
        <section className="space-y-2">
          {r.all_options
            .filter((o) => o.key !== r.chosen.key)
            .map((o) => (
              <div
                key={o.key}
                className="rounded-xl border border-line bg-surface p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 font-serif text-xs text-muted">
                    {o.key}
                  </span>
                  <div className="text-sm text-fg">{o.text}</div>
                </div>
                <div className="ml-8 grid gap-1.5 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-cinnabar font-medium">
                      儒 {o.ru_delta > 0 ? `+${o.ru_delta}` : o.ru_delta}
                    </span>
                    <span className="ml-2 text-muted">{o.comment_ru}</span>
                  </div>
                  <div>
                    <span className="text-cel font-medium">
                      情 {o.qing_delta > 0 ? `+${o.qing_delta}` : o.qing_delta}
                    </span>
                    <span className="ml-2 text-muted">{o.comment_others}</span>
                  </div>
                </div>
              </div>
            ))}
        </section>
      )}

      <button
        onClick={onBack}
        className="w-full rounded-xl bg-accent py-3 text-sm font-medium text-white"
      >
        下一题 →
      </button>
    </div>
  );
}

function DeltaBlock({
  label,
  delta,
  color,
  comment,
}: {
  label: string;
  delta: number;
  color: string;
  comment: string;
}) {
  const positive = delta > 0;
  const negative = delta < 0;
  return (
    <div className="rounded-lg bg-surface p-3">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-xs text-faint">{label}</span>
        <span
          className={`font-serif text-xl font-medium ${
            positive ? "text-emerald-600" : negative ? "text-red-600" : "text-muted"
          }`}
          style={positive || negative ? undefined : { color }}
        >
          {positive ? "+" : ""}
          {delta}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted">{comment}</p>
    </div>
  );
}
