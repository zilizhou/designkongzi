"use client";

/**
 * 数艺·均输衰分
 *
 * 流程：选场景 → 每项一行（名称 + 属性 + 滑块 + 数字输入）→
 *      实时总和检验 → 提交 → 三维评分（合总 / 均输 / 节度）
 *
 * 滑块和数字输入双向绑定，触屏桌面通用。
 */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getMathProgress, getMathToday, solveMathScenario } from "@/lib/api";
import type {
  MathProgressResp,
  MathRefBrief,
  MathScenarioBrief,
  MathSolveResp,
  MathTodayResp,
} from "@/lib/types";

export default function MathJourneyPage() {
  const [today, setToday] = useState<MathTodayResp | null>(null);
  const [progress, setProgress] = useState<MathProgressResp | null>(null);
  const [idx, setIdx] = useState(0);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [result, setResult] = useState<MathSolveResp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    getMathToday().then(setToday).catch(() => setErr("无法加载题库 — 请先登录"));
    getMathProgress().then(setProgress).catch(() => {});
  }, []);

  const current = today?.scenarios[idx];

  // 切换场景时清零
  useEffect(() => {
    if (current) {
      const initWeights = current.default_weights ?? {};
      setWeights(initWeights);
      setAllocations(computeSuggestedAllocations(current, initWeights));
      setResult(null);
    }
  }, [current]);

  const setAlloc = (name: string, v: number) => {
    if (result || !current) return;
    setAllocations((prev) => ({ ...prev, [name]: Math.max(0, Math.min(current.total * 2, v)) }));
  };

  const sumActual = useMemo(
    () => Object.values(allocations).reduce((a, b) => a + b, 0),
    [allocations],
  );

  const hasMetrics = !!current?.items.some((it) => it.metrics && Object.keys(it.metrics).length > 0);
  const suggestedAllocations = useMemo(
    () => (current ? computeSuggestedAllocations(current, weights) : {}),
    [current, weights],
  );

  // 平均分 — 一键填入"理论平均"作为参考
  const distributeEqual = () => {
    if (!current || result) return;
    const per = current.total / current.items.length;
    const next: Record<string, number> = {};
    for (const it of current.items) next[it.name] = Math.round(per * 10) / 10;
    setAllocations(next);
  };

  const applySuggested = () => {
    if (!current || result) return;
    setAllocations(suggestedAllocations);
  };

  const setWeight = (key: string, value: number) => {
    if (result) return;
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const clearAll = () => {
    if (!current || result) return;
    const next: Record<string, number> = {};
    for (const it of current.items) next[it.name] = 0;
    setAllocations(next);
  };

  const onSubmit = async () => {
    if (!current || busy) return;
    setBusy(true);
    try {
      const r = await solveMathScenario(current.id, allocations);
      setResult(r);
      getMathProgress().then(setProgress).catch(() => {});
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

  if (err) return <div className="rounded-2xl bg-accent-soft p-6 text-sm text-accent">{err}</div>;
  if (!today || !current) return <div className="skeleton h-60 w-full rounded-2xl" />;

  const sumPct = current.total > 0 ? sumActual / current.total : 0;
  const sumColor =
    sumPct > 1.05 || sumPct < 0.95
      ? "#ef4444"
      : sumPct > 1.01 || sumPct < 0.99
      ? "#f59e0b"
      : "#10b981";

  return (
    <div className="space-y-4">
      {/* HUD */}
      <section className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-accent">六艺 · 数</div>
            <div className="font-serif text-lg text-fg">均输衰分 · 公平分配</div>
            <div className="mt-1 text-[10px] text-muted">
              「不患寡而患不均」— 数学之要在「分得公平」
            </div>
          </div>
          {progress && (
            <div className="flex flex-wrap gap-2 text-xs text-muted">
              <Stat label="称号" value={progress.title} />
              <Stat label="数艺" value={`${progress.liuyi_shu2}`} />
              <Stat label="解过" value={`${progress.played_count}/${progress.total_scenarios}`} />
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
            <div className="text-[10px] uppercase tracking-widest text-accent">
              {current.kind_label} · {idx + 1}/{today.scenarios.length}
            </div>
            <div className="mt-1 font-serif text-xl text-accent-ink">{current.title}</div>
            <div className="mt-1 text-xs text-accent">
              共 {current.total} {current.unit}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm text-fg">{current.setting}</p>
            <p className="text-[11px] text-muted">{current.hint}</p>
            {current.principle && (
              <p className="text-[11px] text-accent">{current.principle}</p>
            )}
          </div>
        </div>

        {/* 原则权重 */}
        {hasMetrics && (
          <div className="rounded-lg border border-line bg-surface-2/30 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-fg">分配原则</div>
                <div className="text-[10px] text-muted">调整权重，观察资源如何随治理判断改变</div>
              </div>
              {!result && (
                <button
                  onClick={applySuggested}
                  className="rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-xs text-accent hover:bg-surface"
                >
                  应用建议
                </button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(current.metric_labels ?? {}).map(([key, label]) => {
                const value = weights[key] ?? 0;
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted">{label}</span>
                      <span className="font-mono text-accent">{value.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.1}
                      value={value}
                      disabled={!!result}
                      onChange={(e) => setWeight(key, parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 每项分配行 */}
        <div className="space-y-3">
          {current.items.map((it) => {
            const v = allocations[it.name] ?? 0;
            const idealShare = result?.scenario.ideal_shares.find((x) => x.name === it.name)?.ideal_share ?? 0;
            const idealPct = current.total > 0 ? (idealShare / current.total) * 100 : 0;
            const actualPct = current.total > 0 ? (v / current.total) * 100 : 0;
            return (
              <div key={it.name} className="space-y-1.5 rounded-lg border border-line bg-surface-2/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="font-serif text-sm text-fg">{it.name}</span>
                    <span className="ml-2 text-[10px] text-muted">{it.attrs}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={v}
                      min={0}
                      max={current.total * 2}
                      step={0.5}
                      disabled={!!result}
                      onChange={(e) => setAlloc(it.name, parseFloat(e.target.value) || 0)}
                      className="w-20 rounded border border-line bg-white px-2 py-1 text-right text-sm text-fg outline-none focus:border-accent disabled:bg-surface-2"
                    />
                    <span className="text-[10px] text-muted">{current.unit}</span>
                  </div>
                </div>
                {hasMetrics && !result && (
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted">
                    <span>建议 {formatAmount(suggestedAllocations[it.name] ?? 0)} {current.unit}</span>
                    {Object.entries(it.metrics ?? {}).map(([key, value]) => (
                      <span key={key} className="rounded-full bg-surface px-2 py-0.5">
                        {(current.metric_labels ?? {})[key] ?? key}: {value}
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="range"
                  min={0}
                  max={current.total * 1.5}
                  step={0.5}
                  value={v}
                  disabled={!!result}
                  onChange={(e) => setAlloc(it.name, parseFloat(e.target.value))}
                  className="w-full"
                />
                {/* 答完显示对比 */}
                {result && (
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-muted">你的：</span>
                    <span className="font-mono" style={{ color: "#1E5F8E" }}>
                      {v.toFixed(1)} ({actualPct.toFixed(1)}%)
                    </span>
                    <span className="ml-2 text-muted">标答：</span>
                    <span className="font-mono" style={{ color: "#0F6E56" }}>
                      {idealShare.toFixed(1)} ({idealPct.toFixed(1)}%)
                    </span>
                    <span className="ml-auto text-muted">
                      差 {Math.abs(v - idealShare).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 实时总和条 */}
        <div className="rounded-lg bg-surface-2/40 p-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted">当前总和</span>
            <span className="font-mono" style={{ color: sumColor }}>
              {sumActual.toFixed(1)} / {current.total} {current.unit}
              {sumActual !== current.total && (
                <span className="ml-2">
                  ({sumActual > current.total ? "+" : ""}
                  {(sumActual - current.total).toFixed(1)})
                </span>
              )}
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(150, sumPct * 100)}%`,
                background: sumColor,
              }}
            />
          </div>
        </div>

        {/* 操作 */}
        <div className="flex flex-wrap justify-center gap-3">
          {!result && (
            <>
              {hasMetrics && (
                <button
                  onClick={applySuggested}
                  className="rounded-full border border-line bg-surface-2 px-4 py-2 text-xs text-muted hover:bg-surface"
                >
                  按原则分配
                </button>
              )}
              <button
                onClick={distributeEqual}
                className="rounded-full border border-line bg-surface-2 px-4 py-2 text-xs text-muted hover:bg-surface"
              >
                平均分（参考）
              </button>
              <button
                onClick={clearAll}
                className="rounded-full border border-line bg-surface-2 px-4 py-2 text-xs text-muted hover:bg-surface"
              >
                清零
              </button>
              <button
                disabled={busy || sumActual < 1}
                onClick={onSubmit}
                className={`rounded-full px-6 py-2 text-sm font-medium ${
                  sumActual >= 1
                    ? "bg-accent text-white hover:opacity-90"
                    : "bg-surface-2 text-faint"
                }`}
              >
                {busy ? "计算中…" : "提交评分"}
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
      </section>

      {/* 评分展开 */}
      {result && (
        <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5">
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
              <MetricBar label="合总（凑足）" value={result.sum_match} color={gradeColor(result.grade)} />
              <MetricBar label="均输（按权重）" value={result.fairness} color={gradeColor(result.grade)} />
              <MetricBar label="节度（不过度倾斜）" value={result.moderation} color={gradeColor(result.grade)} />
            </div>
          </div>

          {result.feedback.length > 0 && (
            <div className="mb-3 grid gap-2 md:grid-cols-2">
              {result.feedback.map((line) => (
                <div key={line} className="rounded-lg border border-emerald-200 bg-white/60 p-3 text-xs text-emerald-950">
                  {line}
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 text-sm font-medium text-emerald-900">
            数艺 +{result.shu_delta} · xp +{result.xp_delta}
          </div>

          {result.new_unlocked_refs.length > 0 ? (
            <div className="mt-3 rounded-lg border border-gold bg-amber-50 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-amber-700">🎖 新解锁经典</div>
              {result.new_unlocked_refs.map((r: MathRefBrief) => (
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

      {/* 场景一览 */}
      {progress && (
        <section className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-2 text-sm font-medium text-fg">数艺进境 · 场景一览</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {progress.scenarios.map((s: MathScenarioBrief & { best_score: number }) => (
              <div
                key={s.id}
                className={`rounded-lg border p-2 text-center text-xs ${
                  s.answered ? "border-gold bg-accent-soft" : "border-line bg-surface-2/40 text-faint"
                }`}
                title={s.setting}
              >
                <div className="font-serif text-sm text-fg">{s.title}</div>
                <div className="mt-0.5 text-[10px] text-muted">{s.kind_label}</div>
                <div className="mt-0.5 text-[10px]">
                  {s.answered ? `🏅 最高 ${s.best_score}` : "未解"}
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
function computeSuggestedAllocations(
  scenario: MathScenarioBrief,
  weights: Record<string, number>,
): Record<string, number> {
  const raw = scenario.items.map((it) => {
    const metrics = it.metrics ?? {};
    const score = Object.entries(metrics).reduce((sum, [key, value]) => {
      return sum + Math.max(0, value) * Math.max(0, weights[key] ?? 0);
    }, 0);
    return { name: it.name, score };
  });
  const totalScore = raw.reduce((sum, it) => sum + it.score, 0);
  if (totalScore <= 0) {
    const per = scenario.total / Math.max(1, scenario.items.length);
    return Object.fromEntries(scenario.items.map((it) => [it.name, round1(per)]));
  }
  return Object.fromEntries(
    raw.map((it) => [it.name, round1((it.score / totalScore) * scenario.total)]),
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatAmount(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}
function gradeColor(grade: string): string {
  switch (grade) {
    case "衡均": return "#b45309";
    case "通算": return "#0F6E56";
    case "中算": return "#1E5F8E";
    case "试算": return "#534AB7";
    default:     return "#737373";
  }
}
