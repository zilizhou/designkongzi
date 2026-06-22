"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  answerShuCard,
  getShuProgress,
  getShuToday,
} from "@/lib/api";
import type {
  ShuAnswerResp,
  ShuCardBrief,
  ShuProgressResp,
  ShuTodayResp,
} from "@/lib/types";

const METHOD_COLOR: Record<string, string> = {
  xiangxing: "#854F0B",
  zhishi: "#0F6E56",
  huiyi: "#534AB7",
  xingsheng: "#1E5F8E",
  zhuanzhu: "#7A3A2E",
  jiajie: "#5A5A5A",
};
const CAT_COLOR: Record<string, string> = {
  wuchang: "#993C1D",
  lunli: "#0F6E56",
  xiushen: "#534AB7",
  zhixue: "#1E5F8E",
  zhexue: "#854F0B",
};

export default function ShuJourneyPage() {
  const [today, setToday] = useState<ShuTodayResp | null>(null);
  const [progress, setProgress] = useState<ShuProgressResp | null>(null);
  // 每张卡的答题结果（卡 id → resp）
  const [results, setResults] = useState<Record<number, ShuAnswerResp>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const load = () => {
    getShuToday().then(setToday).catch(() => setErr("无法连接后端 — 请先登录"));
    getShuProgress().then(setProgress).catch(() => {});
  };
  useEffect(load, []);

  const onAnswer = async (card: ShuCardBrief, optionKey: string) => {
    if (busy === card.id || results[card.id]) return;
    setBusy(card.id);
    try {
      const r = await answerShuCard(card.id, optionKey);
      setResults((prev) => ({ ...prev, [card.id]: r }));
      // 异步刷新 progress
      getShuProgress().then(setProgress).catch(() => {});
    } catch {
      setErr("提交失败 — 网络异常");
    } finally {
      setBusy(null);
    }
  };

  if (err) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-6 text-sm text-accent">
        {err}
        <Link href="/login" className="ml-3 underline">去登录 →</Link>
      </div>
    );
  }
  if (!today || !progress) {
    return <div className="skeleton h-60 w-full rounded-2xl" />;
  }

  return (
    <div className="space-y-4">
      {/* 顶部 HUD */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs tracking-widest text-accent">六艺 · 书</div>
            <div className="font-serif text-xl text-fg">识字明义 · 字源图鉴</div>
            <div className="mt-1 text-xs text-muted">
              「书以广其义」 — 每个汉字都藏着一个本义
            </div>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted">
            <Stat label="称号" value={progress.title} />
            <Stat label="书艺" value={`${progress.liuyi_shu}`} />
            <Stat label="已学" value={`${progress.correct_cards} / ${progress.total_cards}`} />
            <Stat label="正确率" value={`${Math.round(progress.correct_rate * 100)}%`} />
          </div>
          <Link
            href="/journey"
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-surface-2"
          >
            ← 六艺
          </Link>
        </div>
        {/* 五类覆盖率 */}
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Object.entries(progress.by_category).map(([k, v]) => (
            <div key={k} className="rounded-lg border border-line bg-surface-2/40 p-2 text-center">
              <div className="text-[10px]" style={{ color: CAT_COLOR[k] || "#555" }}>{v.label}</div>
              <div className="mt-0.5 font-serif text-sm text-fg">
                {v.learned} <span className="text-[10px] text-faint">/ {v.total}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 两个游戏入口 */}
      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/journey/shu/assemble"
          className="group rounded-2xl border-2 border-accent bg-accent-soft p-5 transition-all hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs tracking-widest text-accent">游戏 · 1</div>
              <div className="mt-1 font-serif text-xl text-accent-ink">拼字游戏 →</div>
              <p className="mt-2 text-xs text-muted">
                从部件拼出汉字。「亻 + 二 = 仁」
                <br/>
                理解汉字的造字结构，对了 +书艺 3-9。
              </p>
            </div>
            <div className="font-serif text-5xl text-accent-ink opacity-50 group-hover:opacity-90">仁</div>
          </div>
        </Link>
        <Link
          href="/journey/shu/write"
          className="group rounded-2xl border-2 border-rose-400 bg-rose-50 p-5 transition-all hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs tracking-widest text-rose-600">游戏 · 2</div>
              <div className="mt-1 font-serif text-xl text-rose-900">描红写字 →</div>
              <p className="mt-2 text-xs text-muted">
                在灰色字上摹写。Canvas + 米字格。
                <br/>
                体验「书」的动作，写过 +书艺 2。
              </p>
            </div>
            <div className="font-serif text-5xl text-rose-900 opacity-50 group-hover:opacity-90">书</div>
          </div>
        </Link>
      </section>

      {/* 今日 3 张卡 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-fg">
            今日字卡 · {today.today_done_count} / {today.daily_limit}
          </div>
          <span className="text-[10px] text-faint">每张答对 +书艺2~6 +xp4，错亦得 xp1</span>
        </div>
        {today.cards.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-10 text-center text-sm text-faint">
            没有可学的字了 — 你已学完全部 {progress.total_cards} 字 🎉
          </div>
        ) : (
          today.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              busy={busy === card.id}
              result={results[card.id] ?? null}
              onAnswer={onAnswer}
            />
          ))
        )}
      </section>

      {/* 字典 — 已学过的字 */}
      {progress.learned_chars.length > 0 && (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 text-sm font-medium text-fg">
            已学字典 · {progress.learned_chars.length}
          </div>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {progress.learned_chars.map((c) => (
              <div
                key={c.id}
                className="group relative rounded-lg border border-line bg-surface-2/40 p-2 text-center hover:bg-accent-soft"
                title={`${c.pinyin} · ${c.benyi}`}
              >
                <div className="font-serif text-2xl text-fg">{c.char}</div>
                <div className="text-[9px] text-faint">{c.pinyin}</div>
                <div className="text-[9px]" style={{ color: CAT_COLOR[c.category] }}>{c.category_label}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────
function CardItem({
  card, busy, result, onAnswer,
}: {
  card: ShuCardBrief;
  busy: boolean;
  result: ShuAnswerResp | null;
  onAnswer: (c: ShuCardBrief, k: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      {/* 卡头：大字 + 拼音 + 部件 + 难度 */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col items-center justify-center rounded-xl bg-accent-soft px-6 py-4 min-w-[110px]">
          <div className="font-serif text-7xl leading-none text-accent-ink">{card.char}</div>
          <div className="mt-1 text-xs text-accent">{card.pinyin}</div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] text-white"
              style={{ background: CAT_COLOR[card.category] || "#555" }}
            >
              {card.category_label}
            </span>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[10px] text-muted">
              难度 {"★".repeat(card.difficulty)}
            </span>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-[10px] text-muted">
              部件：{card.components}
            </span>
          </div>
          <div className="font-serif text-base text-fg">
            「{card.char}」的本义是？
          </div>
          {!result && (
            <div className="text-[10px] text-faint">选完即展开字源故事与经典出处</div>
          )}
        </div>
      </div>

      {/* 4 选项 */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {card.options.map((o) => {
          const isSelected = result?.chosen_key === o.key;
          const isAnswer = result?.card.answer_key === o.key;
          const showResult = !!result;
          let cls = "border border-line bg-surface-2/50 text-fg hover:bg-surface-2";
          if (showResult) {
            if (isAnswer) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
            else if (isSelected) cls = "border-rose-500 bg-rose-50 text-rose-900";
            else cls = "border-line bg-surface-2/30 text-faint";
          }
          return (
            <button
              key={o.key}
              disabled={busy || !!result}
              onClick={() => onAnswer(card, o.key)}
              className={`rounded-lg p-3 text-left text-sm transition-all ${cls}`}
            >
              <span className="mr-2 inline-block font-mono text-xs opacity-60">{o.key}</span>
              {o.text}
              {showResult && isAnswer && <span className="ml-2 text-[10px]">✓ 正解</span>}
              {showResult && isSelected && !isAnswer && <span className="ml-2 text-[10px]">✗ 你选的</span>}
            </button>
          );
        })}
      </div>

      {/* 结果展开 */}
      {result && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {/* 结果横幅 */}
          <div
            className={`rounded-lg p-3 text-sm ${
              result.correct
                ? "bg-emerald-50 text-emerald-900 border border-emerald-200"
                : "bg-amber-50 text-amber-900 border border-amber-200"
            }`}
          >
            {result.correct
              ? `✓ 答对 — 书艺 +${(result.progress.liuyi_shu - (result.progress.liuyi_shu - card.difficulty * 2))}，xp +4`
              : `× 不要紧，「书以广其义」— 慢慢学`}
          </div>

          {/* 字源故事 */}
          <div className="rounded-lg border border-line bg-surface-2/30 p-3">
            <div className="mb-1 flex items-center gap-2 text-[10px]">
              <span
                className="rounded-full px-2 py-0.5 text-white"
                style={{ background: METHOD_COLOR[result.card.method] || "#555" }}
              >
                {result.card.method_label}
              </span>
              <span className="text-faint">本义</span>
              <span className="font-medium text-fg">{result.card.benyi}</span>
            </div>
            <div className="mt-1 text-sm leading-relaxed text-muted">{result.card.story}</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
              <span className="rounded bg-cel-soft px-1.5 py-0.5 text-cel-ink">今义：{result.card.jinyi}</span>
            </div>
          </div>

          {/* 解锁经典 */}
          {result.new_unlocked_refs.length > 0 && (
            <div className="rounded-lg border border-gold bg-amber-50 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-amber-700">🎖 新解锁经典</div>
              {result.new_unlocked_refs.map((r) => (
                <div key={r.ref_id} className="mt-1 border-l-2 border-amber-500 pl-2 text-sm text-amber-900">
                  <div className="text-[10px] opacity-70">{r.ref_label}</div>
                  <div className="font-serif">{r.text}</div>
                </div>
              ))}
            </div>
          )}

          {/* 已关联经典（含已解锁过的） */}
          {result.card.refs.length > 0 && result.new_unlocked_refs.length === 0 && (
            <div className="rounded-lg border border-line bg-surface-2/20 p-3">
              <div className="mb-1 text-[10px] tracking-widest text-faint">关联经典出处</div>
              {result.card.refs.map((r) => (
                <div key={r.ref_id} className="mt-1 text-xs">
                  <span className="text-faint">{r.ref_label}：</span>
                  <span className="font-serif text-fg">{r.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
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
