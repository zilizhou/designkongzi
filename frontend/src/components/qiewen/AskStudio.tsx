"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import BambooSlips from "./BambooSlips";
import ClaimCard from "./ClaimCard";
import EvidencePane from "./EvidencePane";
import MockMark from "./MockMark";
import { findMockAnswer, STARTER_QUESTIONS } from "@/lib/qiewen/mock";
import type { ClaimItem, EvidenceItem } from "./tracks";

interface Turn {
  question: string;
  claims: ClaimItem[];
  evidence: EvidenceItem[];
  followups: string[];
}

export default function AskStudio({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "retrieve" | "ready">("idle");
  const [turn, setTurn] = useState<Turn | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [view, setView] = useState<"fold" | "bamboo">("fold");

  useEffect(() => {
    if (initialQuestion) void ask(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("qiewen_view");
      if (saved === "fold" || saved === "bamboo") setView(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("qiewen_view", view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const selected = useMemo(
    () => turn?.claims.find((c) => c.id === selectedId) ?? turn?.claims[0],
    [turn, selectedId],
  );
  const evidence = useMemo(() => {
    if (!turn || !selected) return [];
    return turn.evidence.filter((e) => selected.evidence_ids.includes(e.id));
  }, [turn, selected]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setInput("");
    setPhase("retrieve");
    setTurn(null);
    setPanelOpen(false);
    await wait(520);
    const pack = findMockAnswer(q);
    setTurn(pack);
    setSelectedId(pack.claims[0]?.id ?? "");
    setPhase("ready");
    setBusy(false);
    if (typeof window !== "undefined" && window.innerWidth < 1024) setPanelOpen(true);
  }

  function pick(id: string) {
    setSelectedId(id);
    setPanelOpen(true);
  }

  return (
    <div className="qx-bleed flex min-h-[calc(100dvh-3.5rem)] flex-col">
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 flex-col px-4 pb-[calc(3.6rem+5.5rem)] pt-4 md:pb-6 md:pt-6">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[11px] tracking-[0.32em] text-accent">切问</p>
              <MockMark />
            </div>
            <h1 className="mt-1 font-serif text-2xl text-fg md:text-3xl">
              {turn?.question || "让每一句解释回到出处"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-full border border-line p-0.5 text-[12px]">
              <button type="button" onClick={() => setView("fold")} className={`rounded-full px-3 py-1 ${view === "fold" ? "bg-accent text-white" : "text-muted"}`}>经折</button>
              <button type="button" onClick={() => setView("bamboo")} className={`rounded-full px-3 py-1 ${view === "bamboo" ? "bg-accent text-white" : "text-muted"}`}>竹简</button>
            </div>
            {turn && (
              <Link href="/journey/li" className="text-sm text-accent hover:underline">
                进入近思 →
              </Link>
            )}
          </div>
        </header>

        {phase === "idle" && <EmptyAsk onAsk={ask} />}

        {phase === "retrieve" && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="font-serif text-xl text-fg">检索分型证据</div>
              <p className="mt-2 text-sm text-faint">原文 · 注疏 · 译文 · 图谱路径</p>
            </div>
          </div>
        )}

        {phase === "ready" && turn && selected && view === "fold" && (
          <>
            <div className="qx-spread hidden lg:grid">
              <div className="qx-leaf">
                <ClaimsList
                  claims={turn.claims}
                  selectedId={selectedId}
                  onSelect={pick}
                  followups={turn.followups}
                  onAsk={ask}
                />
              </div>
              <div className="qx-leaf">
                <div className="qx-gutter" aria-hidden />
                <EvidenceBody evidence={evidence} selected={selected} />
              </div>
            </div>

            <div className="lg:hidden">
              <ClaimsList
                claims={turn.claims}
                selectedId={selectedId}
                onSelect={pick}
                followups={turn.followups}
                onAsk={ask}
              />
            </div>
          </>
        )}

        {phase === "ready" && turn && selected && view === "bamboo" && (
          <>
            <BambooSlips
              claims={turn.claims}
              evidence={turn.evidence}
              selectedId={selectedId}
              onSelect={pick}
            />
            <FollowupChips followups={turn.followups} onAsk={ask} />
          </>
        )}

        {phase === "ready" && turn && selected && panelOpen && view === "fold" && (
          <>
            <div className="fixed top-14 bottom-0 right-0 z-20 hidden w-[min(58%,28rem)] overflow-auto border-l border-line bg-surface p-5 shadow-paper md:block lg:hidden">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="mb-3 text-xs text-faint"
              >
                收起证据
              </button>
              <EvidenceBody evidence={evidence} selected={selected} compact />
            </div>
            <div className="fixed inset-x-0 bottom-[calc(3.6rem+4.75rem)] z-20 max-h-[50%] overflow-auto border-t border-line bg-surface p-4 md:hidden">
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="mb-2 w-full text-center text-xs text-faint"
              >
                收起证据
              </button>
              <EvidenceBody evidence={evidence} selected={selected} compact />
            </div>
          </>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(input);
          }}
          className="fixed inset-x-0 bottom-[3.6rem] z-30 flex items-center gap-2 border-t border-line bg-bg/95 px-4 py-2.5 backdrop-blur-md md:sticky md:bottom-0 md:z-10 md:bg-transparent md:px-0 md:backdrop-blur-none"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问一个概念或章句…"
            className="flex-1 rounded-full border border-line bg-surface px-4 py-3 text-sm text-fg outline-none focus:border-gold-line"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-line)]"
          >
            问
          </button>
        </form>
      </div>
    </div>
  );
}

function FollowupChips({
  followups,
  onAsk,
}: {
  followups: string[];
  onAsk: (q: string) => void;
}) {
  if (followups.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 pt-4">
      {followups.map((f) =>
        f.includes("仪礼") ? (
          <Link
            key={f}
            href="/journey/li"
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:border-gold-line"
          >
            {f}
          </Link>
        ) : (
          <button
            key={f}
            type="button"
            onClick={() => void onAsk(f)}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted hover:border-gold-line"
          >
            {f}
          </button>
        ),
      )}
    </div>
  );
}

function ClaimsList({
  claims,
  selectedId,
  onSelect,
  followups,
  onAsk,
}: {
  claims: ClaimItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  followups: string[];
  onAsk: (q: string) => void;
}) {
  return (
    <div>
      {claims.map((c) => (
        <ClaimCard key={c.id} claim={c} selected={c.id === selectedId} onSelect={onSelect} />
      ))}
      <FollowupChips followups={followups} onAsk={onAsk} />
    </div>
  );
}

function EvidenceBody({
  evidence,
  selected,
  compact = false,
}: {
  evidence: EvidenceItem[];
  selected: ClaimItem;
  compact?: boolean;
}) {
  if (evidence.length === 0) {
    return compact ? (
      <p className="text-sm text-faint">无直接证据，已降级。</p>
    ) : (
      <div className="py-8 font-serif text-sm leading-relaxed text-faint">
        无直接证据。此条论断已降级，不提供看似确定的出处。
      </div>
    );
  }
  return (
    <EvidencePane
      items={evidence}
      activeIds={selected.evidence_ids}
      track={selected.track}
      compact={compact}
    />
  );
}

function EmptyAsk({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center py-8">
      <p className="font-serif text-4xl text-fg/10">问</p>
      <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
        回答按论断分轨。点一条论断，右侧或底部出现它真正用过的证据。
      </p>
      <div className="mt-8 flex flex-col">
        {STARTER_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onAsk(q)}
            className="border-b border-line py-4 text-left font-serif text-fg"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
