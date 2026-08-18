"use client";

import { STATUS_META, TRACK_META, type ClaimItem, type EvidenceItem } from "./tracks";

interface BambooSlipsProps {
  claims: ClaimItem[];
  evidence: EvidenceItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function BambooSlips({
  claims,
  evidence,
  selectedId,
  onSelect,
}: BambooSlipsProps) {
  const selected = claims.find((c) => c.id === selectedId) ?? claims[0];
  const bound = selected
    ? evidence.filter((e) => selected.evidence_ids.includes(e.id))
    : [];

  return (
    <div className="qx-bamboo">
      <div className="qx-bamboo-row">
        <span className="qx-bamboo-cord qx-bamboo-cord-top" />
        <span className="qx-bamboo-cord qx-bamboo-cord-bot" />

        {claims.map((c) => {
          const on = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={`qx-slip qx-slip-claim ${on ? "is-on" : "is-off"}`}
              style={{ ["--slip-ink" as string]: TRACK_META[c.track].color }}
              aria-pressed={on}
            >
              <span className="qx-slip-head">{TRACK_META[c.track].label}</span>
              {on && (
                <>
                  <span className="qx-slip-body">{c.text}</span>
                  <span className="qx-slip-foot">
                    {STATUS_META[c.status].label}
                    {c.evidence_ids.length ? `  ${c.evidence_ids.join(" ")}` : ""}
                  </span>
                </>
              )}
            </button>
          );
        })}

        <div className="qx-bamboo-gap" aria-hidden />

        {bound.length === 0 ? (
          <div className="qx-slip qx-slip-evid is-on qx-slip-empty">无直接简文</div>
        ) : (
          bound.map((ev) => (
            <div key={ev.id} className="qx-slip qx-slip-evid is-on">
              <span className="qx-slip-head">{ev.id}</span>
              <span className="qx-slip-body">{ev.original}</span>
              <span className="qx-slip-foot">{ev.ref_label}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
