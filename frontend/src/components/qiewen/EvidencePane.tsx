"use client";

import Link from "next/link";
import { TRACK_META, type EvidenceItem, type Track } from "./tracks";

const SOURCE_LABEL = {
  passage: "原文",
  annotation: "注疏",
  translation: "译文",
  graph: "图谱",
};

interface EvidencePaneProps {
  items: EvidenceItem[];
  activeIds: string[];
  track?: Track;
  compact?: boolean;
}

export default function EvidencePane({
  items,
  activeIds,
  track,
  compact = false,
}: EvidencePaneProps) {
  return (
    <div>
      <div className={`flex items-baseline justify-between gap-3 ${compact ? "mb-4" : "mb-8"}`}>
        <div className="font-serif text-[13px] tracking-[0.32em] text-faint">证据</div>
        {track && (
          <div className="text-[11px] text-muted">{TRACK_META[track].hint}</div>
        )}
      </div>
      <div>
        {items.map((ev) => {
          const on = activeIds.includes(ev.id);
          return (
            <article
              key={ev.id}
              className={`${compact ? "mb-6" : "mb-9"} ${on ? "" : "opacity-45"}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 text-[11px] tracking-wide text-faint">
                <span className="font-serif text-[13px] tracking-[0.12em] text-gold-line">{ev.id}</span>
                <span>{SOURCE_LABEL[ev.source_type]}</span>
                <span>{ev.ref_label}</span>
              </div>
              <p
                className={`mt-3 font-serif text-fg ${
                  compact ? "text-[16px] leading-[1.9]" : "text-[20px] leading-[2]"
                }`}
              >
                {ev.original}
              </p>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{ev.snippet}</p>
              <Link
                href={ev.href}
                className="mt-3 inline-block text-[12px] tracking-wide text-accent hover:underline"
              >
                进入章句
              </Link>
            </article>
          );
        })}
      </div>
    </div>
  );
}
