"use client";

import { useEffect, useRef, useState } from "react";
import { getTopics, streamChat } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import type {
  CitationEvent,
  CrossCivView,
  TopicBrief,
  TopicCard,
  VerifyEvent,
} from "@/lib/types";

interface AssistantMsg {
  role: "assistant";
  text: string;
  citations: CitationEvent[];
  agents: string[];
  verify?: VerifyEvent;
  topic?: TopicCard;
  crossCiv?: CrossCivView[];
  streaming: boolean;
}
interface UserMsg {
  role: "user";
  text: string;
}
type Msg = UserMsg | AssistantMsg;

const AGENT_META: Record<string, { label: string; color: string }> = {
  router: { label: "总控", color: "#993C1D" },
  retrieval: { label: "经典检索", color: "#0F6E56" },
  synthesizer: { label: "合成", color: "#854F0B" },
  topic_engine: { label: "议题引擎", color: "#1E5F8E" },
  cross_civilization: { label: "跨文明对照", color: "#534AB7" },
  translator: { label: "翻译", color: "#7A6F2C" },
  cross_culture: { label: "跨文化", color: "#1E5F8E" },
  verifier: { label: "校验", color: "#A63A2C" },
};

const CIV_COLORS: Record<string, string> = {
  confucian: "#993C1D",
  christian: "#7A4B36",
  enlightenment: "#0F6E56",
  kantian: "#534AB7",
  buddhist: "#854F0B",
};

const VERIFY_LABELS: [keyof VerifyEvent, string][] = [
  ["textual", "文本依据"],
  ["modern", "现代发挥"],
  ["cultural", "文化适配"],
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [followups, setFollowups] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [lang] = useLang();
  const [busy, setBusy] = useState(false);
  const [topics, setTopics] = useState<TopicBrief[]>([]);
  const [topicHint, setTopicHint] = useState<string | null>(null);
  // 兼容：crypto.randomUUID() 仅 secure context (HTTPS/localhost) 可用；HTTP+IP 时需要 fallback
  const convId = useRef<string>(
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
      ? crypto.randomUUID()
      : "conv-" + Math.random().toString(36).slice(2) + Date.now().toString(36),
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getTopics().then(setTopics).catch(() => {});
    const url = new URLSearchParams(window.location.search);
    const q = url.get("q");
    const t = url.get("topic");
    if (t) setTopicHint(t);
    if (q) void send(q, t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, followups]);

  async function send(text: string, hintOverride?: string | null) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setFollowups([]);
    setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", text: q },
      { role: "assistant", text: "", citations: [], agents: [], streaming: true },
    ]);

    const patchLast = (fn: (a: AssistantMsg) => AssistantMsg) =>
      setMessages((m) => {
        const copy = [...m];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === "assistant") {
            copy[i] = fn(copy[i] as AssistantMsg);
            break;
          }
        }
        return copy;
      });

    try {
      await streamChat(
        {
          message: q,
          conversation_id: convId.current,
          lang,
          device: "web",
          topic_hint: hintOverride !== undefined ? hintOverride : topicHint,
        },
        {
          onAgents: (e) => patchLast((a) => ({ ...a, agents: e.active })),
          onTopic: (e) => patchLast((a) => ({ ...a, topic: e })),
          onCitation: (e) => patchLast((a) => ({ ...a, citations: [...a.citations, e] })),
          onToken: (t) => patchLast((a) => ({ ...a, text: a.text + t })),
          onVerify: (e) => patchLast((a) => ({ ...a, verify: e })),
          onCrossCiv: (e) => patchLast((a) => ({ ...a, crossCiv: e.views })),
          onFollowups: (items) => setFollowups(items),
          onDone: () => patchLast((a) => ({ ...a, streaming: false })),
          onError: (msg) =>
            patchLast((a) => ({
              ...a,
              streaming: false,
              text: a.text || `⚠️ ${msg}（后端是否已在 8000 启动？）`,
            })),
        },
      );
    } catch {
      patchLast((a) => ({
        ...a,
        streaming: false,
        text: a.text || "⚠️ 无法连接后端，请先启动 uvicorn (8000)。",
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-7.5rem)]">
      {/* AI 人格名片 */}
      <div className="mb-3 flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-celadon font-serif text-celadon-deep">
          曰
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-fg">
            子曰君 <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          </div>
          <div className="text-xs text-faint">儒家经典 · 同行者，不是老师</div>
        </div>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-faint">
          {lang.toUpperCase()}
        </span>
      </div>

      {/* 议题 chip 选择器（申报书 5 大全球议题） */}
      {topics.length > 0 && (
        <div className="mb-2 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-xs text-faint">对议题：</span>
          <button
            onClick={() => setTopicHint(null)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
              topicHint === null
                ? "bg-accent text-white"
                : "border border-line text-muted"
            }`}
          >
            自动
          </button>
          {topics.map((t) => (
            <button
              key={t.id}
              onClick={() => setTopicHint(t.id)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${
                topicHint === t.id ? "text-white" : "border border-line text-muted"
              }`}
              style={topicHint === t.id ? { background: t.color } : undefined}
            >
              {t.name}
            </button>
          ))}
        </div>
      )}

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <div className="mt-10 text-center text-sm text-faint">
            试试问议题：「如何应对全球气候变化？」「AI 时代的隐私边界？」
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-cinnabar px-4 py-2 text-sm leading-relaxed text-cinnabar-soft">
                {m.text}
              </div>
            </div>
          ) : (
            <AssistantBubble key={i} msg={m} />
          ),
        )}
      </div>

      {/* 追问 chips */}
      {followups.length > 0 && (
        <div className="flex flex-wrap gap-2 py-2">
          {followups.map((f) => (
            <button
              key={f}
              onClick={() => send(f)}
              className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted hover:bg-accent-soft hover:text-accent"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="mt-2 flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="问点什么…"
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-fg outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-cinnabar text-cinnabar-soft disabled:opacity-40"
        >
          ↑
        </button>
      </form>
    </div>
  );
}

function AssistantBubble({ msg }: { msg: AssistantMsg }) {
  return (
    <div className="space-y-2">
      {msg.agents.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          {msg.agents.map((a) => {
            const meta = AGENT_META[a] ?? { label: a, color: "#888" };
            return (
              <span key={a} className="flex items-center gap-1 text-[10px] text-faint" title={meta.label}>
                <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                {meta.label}
              </span>
            );
          })}
        </div>
      )}

      {/* 议题识别横幅 */}
      {msg.topic && (
        <div
          className="max-w-[88%] rounded-lg px-3 py-2 text-xs"
          style={{
            background: `${msg.topic.color}1A`,
            borderLeft: `3px solid ${msg.topic.color}`,
            color: "var(--fg)",
          }}
        >
          <span className="mr-2 font-medium" style={{ color: msg.topic.color }}>
            议题 · {msg.topic.name}
          </span>
          {msg.topic.description}
        </div>
      )}

      {msg.citations.map((c) => (
        <div
          key={c.ref_id}
          className="max-w-[88%] rounded-r-lg border-l-[3px] border-accent bg-accent-soft px-3 py-2"
        >
          <div className="font-serif text-[15px] font-medium tracking-wide text-accent-ink">
            {c.text}
          </div>
          <div className="mt-1 text-[10px] text-accent">{c.ref_label}</div>
        </div>
      ))}

      {(msg.text || msg.streaming) && (
        <div className="max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2.5 text-sm leading-relaxed text-fg">
          {msg.text}
          {msg.streaming && (
            <span className="ml-1 inline-flex gap-0.5 align-middle">
              <span className="typing-dot h-1 w-1 rounded-full bg-faint" />
              <span className="typing-dot h-1 w-1 rounded-full bg-faint" />
              <span className="typing-dot h-1 w-1 rounded-full bg-faint" />
            </span>
          )}
        </div>
      )}

      {msg.verify && (
        <div className="flex flex-wrap gap-1.5 pl-1">
          {VERIFY_LABELS.map(([k, label]) => {
            const v = msg.verify![k];
            const good = v >= 0.8;
            return (
              <span
                key={k}
                className={`rounded-full px-2 py-0.5 text-[10px] ${
                  good ? "bg-cel-soft text-cel-ink" : "bg-surface-2 text-muted"
                }`}
              >
                {label} {Math.round(v * 100)}%
              </span>
            );
          })}
        </div>
      )}

      {/* 跨文明对照（并列卡片网格） */}
      {msg.crossCiv && msg.crossCiv.length > 0 && (
        <div className="pl-1">
          <div className="mb-2 mt-1 text-xs text-faint">
            跨文明对照 · 同议题 {msg.crossCiv.length} 文明并陈
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {msg.crossCiv.map((v) => (
              <CrossCivCard key={v.civilization} v={v} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CrossCivCard({ v }: { v: CrossCivView }) {
  const [open, setOpen] = useState(false);
  const color = CIV_COLORS[v.civilization] ?? "#888";
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        className="block w-full p-3 text-left"
      >
        <div className="mb-1 flex items-center gap-2">
          <span
            className="inline-block h-1.5 w-6 rounded-full"
            style={{ background: color }}
          />
          <span className="text-xs font-medium" style={{ color }}>
            {v.civ_label}
          </span>
          {v.ai_generated && !v.reviewed && (
            <span className="ml-auto rounded-full bg-surface-2 px-1.5 text-[9px] text-faint">
              AI 协助
            </span>
          )}
        </div>
        <div className="font-serif text-sm leading-relaxed text-fg">
          {v.headline}
        </div>
        <div className="mt-1 text-[10px] text-faint">{open ? "收起 ▴" : "展开论证 ▾"}</div>
      </button>
      {open && (
        <div className="border-t border-line bg-surface-2/40 px-3 py-3">
          <p className="text-xs leading-relaxed text-muted">{v.detail}</p>
          {v.sources.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {v.sources.map((s, i) => (
                <span
                  key={i}
                  title={s.citation}
                  className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-faint"
                >
                  {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
