export type Track = "jing" | "zhu" | "yong" | "yi";

export type SupportStatus =
  | "direct"
  | "indirect"
  | "partial"
  | "none"
  | "conflict"
  | "divergent";

export interface EvidenceItem {
  id: string;
  ref_id: string;
  ref_label: string;
  original: string;
  snippet: string;
  source_type: "passage" | "annotation" | "translation" | "graph";
  href: string;
}

export interface ClaimItem {
  id: string;
  text: string;
  track: Track;
  status: SupportStatus;
  evidence_ids: string[];
}

export const TRACK_META: Record<
  Track,
  { label: string; hint: string; color: string }
> = {
  jing: { label: "经", hint: "原文与直接原义", color: "var(--track-jing)" },
  zhu: { label: "注", hint: "注疏或学术解释", color: "var(--track-zhu)" },
  yong: { label: "用", hint: "现代发挥与应用", color: "var(--track-yong)" },
  yi: { label: "译", hint: "译法与术语差异", color: "var(--track-yi)" },
};

export const STATUS_META: Record<
  SupportStatus,
  { label: string; tone: "ok" | "mid" | "warn"; mark: "solid" | "muted" | "dashed" | "conflict" | "empty" }
> = {
  direct: { label: "有直接依据", tone: "ok", mark: "solid" },
  indirect: { label: "有间接依据", tone: "mid", mark: "muted" },
  partial: { label: "部分支持", tone: "mid", mark: "dashed" },
  none: { label: "无直接依据", tone: "warn", mark: "empty" },
  conflict: { label: "与证据冲突", tone: "warn", mark: "conflict" },
  divergent: { label: "存在不同解释", tone: "mid", mark: "dashed" },
};

export const DEMO_QUESTION = "仁是否简单地等于英语里的 benevolence？";

export const DEMO_EVIDENCE: EvidenceItem[] = [
  {
    id: "E1",
    ref_id: "lunyu.yanyuan.12.1",
    ref_label: "《论语·颜渊》12.1",
    original: "克己复礼为仁。一日克己复礼，天下归仁焉。",
    snippet: "仁与「复礼」相连，不是单纯的情感善意。",
    source_type: "passage",
    href: "/read?ref=lunyu.yanyuan.12.1",
  },
  {
    id: "E2",
    ref_id: "lunyu.liren.4.15",
    ref_label: "《论语·里仁》4.15",
    original: "夫子之道，忠恕而已矣。",
    snippet: "仁的实践常通过忠恕展开，语义比 benevolence 更宽。",
    source_type: "passage",
    href: "/read?ref=lunyu.liren.4.15",
  },
  {
    id: "E3",
    ref_id: "zhuzi.ren-shuo",
    ref_label: "朱熹《仁说》",
    original: "仁者，心之德、爱之理。",
    snippet: "宋儒把仁纳入心性系统，已是后起解释层。",
    source_type: "annotation",
    href: "/read?ref=lunyu.yanyuan.12.1",
  },
  {
    id: "E4",
    ref_id: "tr.legge.ren",
    ref_label: "Legge 译注",
    original: "benevolence; perfect virtue",
    snippet: "同一译者也会在 benevolence 与 perfect virtue 之间摇摆。",
    source_type: "translation",
    href: "/read?ref=lunyu.yanyuan.12.1",
  },
];

export const DEMO_CLAIMS: ClaimItem[] = [
  {
    id: "C1",
    text: "《论语》中的「仁」并不等于单一英语词 benevolence。它同时指向修身与「复礼」。",
    track: "jing",
    status: "direct",
    evidence_ids: ["E1", "E2"],
  },
  {
    id: "C2",
    text: "朱熹以「心之德、爱之理」释仁，这是宋学系统，不应回读为春秋原义。",
    track: "zhu",
    status: "direct",
    evidence_ids: ["E3"],
  },
  {
    id: "C3",
    text: "把仁译成 benevolence，便于现代沟通，但会收窄「克己复礼」的制度与实践义。",
    track: "yong",
    status: "partial",
    evidence_ids: ["E1", "E4"],
  },
  {
    id: "C4",
    text: "英语 benevolence 偏情感善意；同一译名在不同译者处并不稳定。",
    track: "yi",
    status: "divergent",
    evidence_ids: ["E4"],
  },
];
