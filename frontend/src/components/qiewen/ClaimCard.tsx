"use client";

import { STATUS_META, TRACK_META, type ClaimItem } from "./tracks";

interface ClaimCardProps {
  claim: ClaimItem;
  selected?: boolean;
  compact?: boolean;
  onSelect?: (id: string) => void;
}

export default function ClaimCard({
  claim,
  selected = false,
  compact = false,
  onSelect,
}: ClaimCardProps) {
  const track = TRACK_META[claim.track];
  const status = STATUS_META[claim.status];

  return (
    <button
      type="button"
      onClick={() => onSelect?.(claim.id)}
      className={`relative w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold-line)] ${
        compact ? "py-3" : "py-5"
      } ${selected ? "opacity-100" : "opacity-55 hover:opacity-90"}`}
      style={
        selected
          ? {
              background: "color-mix(in srgb, var(--gold-line) 10%, transparent)",
              boxShadow: "inset -1px 0 0 var(--gold-line)",
            }
          : undefined
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="font-serif text-[13px] tracking-[0.32em]"
          style={{ color: track.color }}
        >
          {track.label}
        </span>
        <span className="text-[11px] text-faint">{status.label}</span>
      </div>
      <p
        className={`mt-2.5 font-serif text-fg ${
          compact ? "text-[15px] leading-[1.85]" : "text-[17px] leading-[2]"
        }`}
      >
        {claim.text}
        {claim.evidence_ids.length > 0 && (
          <span className="ml-2 font-serif text-[12px] tracking-[0.14em] text-gold-line">
            {claim.evidence_ids.join(" · ")}
          </span>
        )}
      </p>
    </button>
  );
}
