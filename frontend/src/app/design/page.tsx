"use client";

import { useMemo, useState } from "react";
import BambooSlips from "@/components/qiewen/BambooSlips";
import ClaimCard from "@/components/qiewen/ClaimCard";
import EvidencePane from "@/components/qiewen/EvidencePane";
import {
  DEMO_CLAIMS,
  DEMO_EVIDENCE,
  DEMO_QUESTION,
  TRACK_META,
  type Track,
} from "@/components/qiewen/tracks";

type Device = "desktop" | "tablet" | "phone" | "bamboo";

const DEVICES: { id: Device; label: string; hint: string }[] = [
  { id: "desktop", label: "电脑", hint: "左右对开 · 论断 | 证据" },
  { id: "tablet", label: "平板", hint: "主栏论断 · 证据抽屉" },
  { id: "phone", label: "手机", hint: "底栏三入口 · 证据上滑" },
  { id: "bamboo", label: "竹简", hint: "韦编竖写 · 右起" },
];

export default function DesignStudioPage() {
  const [device, setDevice] = useState<Device>("desktop");
  const [selectedId, setSelectedId] = useState("C1");
  const [sheet, setSheet] = useState(true);

  const selected = DEMO_CLAIMS.find((c) => c.id === selectedId) ?? DEMO_CLAIMS[0];
  const evidence = useMemo(
    () => DEMO_EVIDENCE.filter((e) => selected.evidence_ids.includes(e.id)),
    [selected],
  );

  return (
    <div className="qx-bleed px-4 pb-10 pt-6 md:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-[11px] tracking-[0.32em] text-accent">界面设计 · 经折对读</p>
        <h1 className="mt-2 font-serif text-3xl text-fg md:text-4xl">让评委看见「哪句话由哪条证据支持」</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
          视觉不做满屏水墨，也不做通用卡片墙。桌面是经折左右开页，手机是三入口底栏，颜色只服务分轨：墨为经、深蓝为注、朱砂为用、金棕为译。同一套 token 可迁到 App 与小程序。
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d.id)}
              className={`rounded-full px-4 py-1.5 text-sm ${
                device === d.id ? "bg-accent text-white" : "border border-line bg-surface text-muted"
              }`}
            >
              {d.label}
              <span className="ml-2 hidden text-[11px] opacity-80 sm:inline">{d.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-8 flex justify-center">
        {device === "desktop" && (
          <DesktopSpread
            selectedId={selectedId}
            onSelect={setSelectedId}
            track={selected.track}
            evidenceIds={selected.evidence_ids}
            evidence={evidence}
          />
        )}
        {device === "tablet" && (
          <TabletFrame
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setSheet(true);
            }}
            track={selected.track}
            evidenceIds={selected.evidence_ids}
            evidence={evidence}
            sheet={sheet}
            onClose={() => setSheet(false)}
          />
        )}
        {device === "phone" && (
          <PhoneFrame
            selectedId={selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              setSheet(true);
            }}
            track={selected.track}
            evidenceIds={selected.evidence_ids}
            evidence={evidence}
            sheet={sheet}
            onClose={() => setSheet(false)}
          />
        )}
        {device === "bamboo" && (
          <div className="w-full max-w-5xl">
            <BambooSlips
              claims={DEMO_CLAIMS}
              evidence={DEMO_EVIDENCE}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
        )}
      </div>

      <section className="mx-auto mt-12 flex max-w-3xl flex-wrap items-baseline justify-center gap-x-8 gap-y-2 text-[13px] text-muted">
        {(Object.keys(TRACK_META) as Track[]).map((k) => (
          <span key={k} className="inline-flex items-baseline gap-2">
            <span className="font-serif tracking-[0.28em]" style={{ color: TRACK_META[k].color }}>
              {TRACK_META[k].label}
            </span>
            <span>{TRACK_META[k].hint}</span>
          </span>
        ))}
      </section>

      <section className="mx-auto mt-10 max-w-5xl">
        <h2 className="font-serif text-xl text-fg">多端同一骨架</h2>
        <div className="mt-4 grid gap-8 text-sm leading-relaxed text-muted md:grid-cols-3">
          <p>
            <span className="font-serif text-fg">电脑</span>
            <br />
            1200px 内经折对开。左叶论断，右叶证据。选中后金线落在折缝一侧，证据编号跟在句末。
          </p>
          <p>
            <span className="font-serif text-fg">平板</span>
            <br />
            主栏阅读论断，证据以右侧抽屉出现，保留「对读」而不是变成长信息流。
          </p>
          <p>
            <span className="font-serif text-fg">手机 / App / 小程序</span>
            <br />
            底栏只有切问、近思、我。点论断后证据自底部上滑。token、分轨色、三入口信息架构保持不变。
          </p>
        </div>
      </section>
    </div>
  );
}

interface FrameProps {
  selectedId: string;
  onSelect: (id: string) => void;
  track: Track;
  evidenceIds: string[];
  evidence: typeof DEMO_EVIDENCE;
}

function ChatHeader() {
  return (
    <div className="border-b border-line/70 px-5 py-3">
      <div className="text-[11px] tracking-[0.28em] text-faint">切问</div>
      <div className="mt-1 font-serif text-[15px] text-fg">{DEMO_QUESTION}</div>
    </div>
  );
}

function DesktopSpread({ selectedId, onSelect, track, evidenceIds, evidence }: FrameProps) {
  return (
    <div className="w-full max-w-[1100px]">
      <div className="bg-surface">
        <ChatHeader />
      </div>
      <div className="qx-spread">
        <div className="qx-leaf space-y-1">
          {DEMO_CLAIMS.map((c) => (
            <ClaimCard key={c.id} claim={c} selected={c.id === selectedId} onSelect={onSelect} />
          ))}
        </div>
        <div className="qx-leaf">
          <div className="qx-gutter" aria-hidden />
          <EvidencePane items={evidence} activeIds={evidenceIds} track={track} />
        </div>
      </div>
    </div>
  );
}

function TabletFrame({
  selectedId,
  onSelect,
  track,
  evidenceIds,
  evidence,
  sheet,
  onClose,
}: FrameProps & { sheet: boolean; onClose: () => void }) {
  return (
    <div className="relative w-full max-w-[820px] overflow-hidden rounded-[1.8rem] border-[10px] border-[#2A241C] bg-bg shadow-paper">
      <ChatHeader />
      <div className="min-h-[620px] space-y-3 p-4">
        {DEMO_CLAIMS.map((c) => (
          <ClaimCard key={c.id} claim={c} selected={c.id === selectedId} onSelect={onSelect} />
        ))}
      </div>
      {sheet && (
        <div className="absolute inset-y-0 right-0 w-[58%] border-l border-line bg-surface p-4 shadow-paper">
          <button type="button" onClick={onClose} className="mb-3 text-xs text-faint">
            收起证据
          </button>
          <EvidencePane items={evidence} activeIds={evidenceIds} track={track} compact />
        </div>
      )}
    </div>
  );
}

function PhoneFrame({
  selectedId,
  onSelect,
  track,
  evidenceIds,
  evidence,
  sheet,
  onClose,
}: FrameProps & { sheet: boolean; onClose: () => void }) {
  return (
    <div className="relative w-[390px] max-w-full overflow-hidden rounded-[2rem] border-[10px] border-[#2A241C] bg-bg shadow-paper">
      <div className="flex h-11 items-center justify-center text-[11px] tracking-[0.3em] text-faint">
        切问近思
      </div>
      <ChatHeader />
      <div className="min-h-[520px] space-y-2.5 p-3 pb-24">
        {DEMO_CLAIMS.map((c) => (
          <ClaimCard
            key={c.id}
            claim={c}
            compact
            selected={c.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {sheet && (
        <div className="absolute inset-x-0 bottom-14 max-h-[58%] overflow-auto rounded-t-3xl border-t border-line bg-surface p-4 shadow-paper">
          <button type="button" onClick={onClose} className="mb-2 w-full text-center text-xs text-faint">
            下滑关闭
          </button>
          <EvidencePane items={evidence} activeIds={evidenceIds} track={track} compact />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex h-14 border-t border-line bg-bg/95 text-[11px]">
        {["切问", "近思", "我"].map((label, i) => (
          <div
            key={label}
            className={`flex flex-1 items-center justify-center ${i === 0 ? "text-accent" : "text-faint"}`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
