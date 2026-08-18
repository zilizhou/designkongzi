import {
  DEMO_CLAIMS,
  DEMO_EVIDENCE,
  DEMO_QUESTION,
  type ClaimItem,
  type EvidenceItem,
} from "@/components/qiewen/tracks";

export interface MockPassage {
  id: string;
  ref_label: string;
  original_text: string;
  pinyin: string;
  translation_en: string;
  annotations: { source: string; content: string }[];
  concepts: string[];
}

export interface MockAnswer {
  question: string;
  claims: ClaimItem[];
  evidence: EvidenceItem[];
  followups: string[];
}

export interface MockRule {
  id: string;
  action: string;
  verdict: string;
  expected: string;
  source_label: string;
  source_ref: string;
  era: string;
  scope: string;
  abstraction_note: string;
}

export interface MockArchive {
  reads: { ref_id: string; label: string; text: string }[];
  warnings: { text: string; status: string }[];
  practices: { title: string; verdict: string; href: string }[];
}

export const MOCK_MARK = "演示数据";

export const STARTER_QUESTIONS = [
  DEMO_QUESTION,
  "「克己复礼」是在要求人压抑自己吗？",
  "忠恕和仁是什么关系？",
];

const PACK_LI: MockAnswer = {
  question: "「克己复礼」是在要求人压抑自己吗？",
  claims: [
    {
      id: "C1",
      text: "「克己复礼为仁」把仁落实为约束己身、回到礼的秩序，不是单纯的情感压抑。",
      track: "jing",
      status: "direct",
      evidence_ids: ["E1"],
    },
    {
      id: "C2",
      text: "注家多将「克」理解为胜私，重点在使行为合礼，而不是取消一切欲望。",
      track: "zhu",
      status: "indirect",
      evidence_ids: ["E3"],
    },
    {
      id: "C3",
      text: "若把克己理解成全面自我否定，已属现代发挥，不能直接当作原义。",
      track: "yong",
      status: "partial",
      evidence_ids: ["E1"],
    },
  ],
  evidence: [
    DEMO_EVIDENCE[0],
    {
      id: "E3",
      ref_id: "zhuzi.ren-shuo",
      ref_label: "朱熹《论语集注》",
      original: "克，胜也。己，谓身之私欲也。",
      snippet: "克己被解释为胜私，服务于复礼，而非禁欲口号。",
      source_type: "annotation",
      href: "/read?ref=lunyu.yanyuan.12.1",
    },
  ],
  followups: [
    DEMO_QUESTION,
    "去仪礼里体会过与不及",
  ],
};

const PACK_ZHONGSHU: MockAnswer = {
  question: "忠恕和仁是什么关系？",
  claims: [
    {
      id: "C1",
      text: "曾子以「忠恕」概括夫子之道，说明仁常通过可操作的待人原则展开。",
      track: "jing",
      status: "direct",
      evidence_ids: ["E2"],
    },
    {
      id: "C2",
      text: "忠恕是进入仁的途径之一，不能反过来把仁收窄成两个字。",
      track: "zhu",
      status: "partial",
      evidence_ids: ["E2"],
    },
  ],
  evidence: [DEMO_EVIDENCE[1]],
  followups: [DEMO_QUESTION, "「克己复礼」是在要求人压抑自己吗？"],
};

const PACK_FALLBACK: MockAnswer = {
  question: "",
  claims: [
    {
      id: "C1",
      text: "现有证据不足以支持一个确定结论。系统降级说明，不把流畅表达当成依据。",
      track: "yong",
      status: "none",
      evidence_ids: [],
    },
  ],
  evidence: [],
  followups: STARTER_QUESTIONS,
};

export const MOCK_PASSAGES: Record<string, MockPassage> = {
  "lunyu.yanyuan.12.1": {
    id: "lunyu.yanyuan.12.1",
    ref_label: "《论语·颜渊》12.1",
    original_text: "克己复礼为仁。一日克己复礼，天下归仁焉。为仁由己，而由人乎哉？",
    pinyin: "kè jǐ fù lǐ wéi rén. yí rì kè jǐ fù lǐ, tiān xià guī rén yān.",
    translation_en:
      "To return to ritual by restraining the self is ren. This is not mere benevolence as private feeling.",
    annotations: [
      { source: "朱熹《集注》", content: "仁者，本心之全德。克己复礼，则事皆天理。" },
      { source: "教学说明", content: "此句将仁落到可观察的行为：约束与复礼，而不是一个英语情感词。" },
    ],
    concepts: ["仁", "礼", "克己"],
  },
  "lunyu.liren.4.15": {
    id: "lunyu.liren.4.15",
    ref_label: "《论语·里仁》4.15",
    original_text: "子曰：「参乎！吾道一以贯之。」曾子曰：「唯。」子出，门人问曰：「何谓也？」曾子曰：「夫子之道，忠恕而已矣。」",
    pinyin: "fū zǐ zhī dào, zhōng shù ér yǐ yǐ.",
    translation_en: "The way of the Master is zhong and shu, and that is all.",
    annotations: [
      { source: "教学说明", content: "忠恕是理解仁的一条路径，不能替代仁的全部义项。" },
    ],
    concepts: ["忠", "恕", "仁"],
  },
};

export const MOCK_RULES: MockRule[] = [
  {
    id: "R-bow-depth",
    action: "向主宾作揖",
    verdict: "过浅",
    expected: "对主宾的揖应深于随从，幅度落在「敬而不谄」的区间",
    source_label: "《礼记·曲礼上》",
    source_ref: "lunyu.yanyuan.12.1",
    era: "礼经记载，汉以后注疏系统整理",
    scope: "宾主相见的教学情境，不是还原某一朝朝仪",
    abstraction_note:
      "教学上把「深浅」抽象为可操作区间。历史仪节有时代差异，系统不把阈值宣布为唯一正确礼制。",
  },
  {
    id: "R-greet-order",
    action: "迎宾次序",
    verdict: "合宜",
    expected: "先主宾，后随从",
    source_label: "《仪礼·士相见礼》",
    source_ref: "lunyu.yanyuan.12.1",
    era: "仪礼文本及后世教学转写",
    scope: "席间迎宾练习",
    abstraction_note: "次序训练的是「谁先谁后」，用来体会「礼者，序也」。",
  },
];

export const MOCK_ARCHIVE: MockArchive = {
  reads: [
    { ref_id: "lunyu.yanyuan.12.1", label: "《论语·颜渊》12.1", text: "克己复礼为仁。" },
    { ref_id: "lunyu.liren.4.15", label: "《论语·里仁》4.15", text: "夫子之道，忠恕而已矣。" },
  ],
  warnings: [
    { text: "「仁 = benevolence」被标为部分支持 / 存在不同解释", status: "divergent" },
    { text: "将克己理解为全面压抑，已降级为现代发挥", status: "partial" },
  ],
  practices: [
    { title: "礼·宾至如归", verdict: "揖过浅 · 已查看规则出处", href: "/journey/li/recap" },
  ],
};

export function findMockAnswer(question: string): MockAnswer {
  const q = question.trim();
  if (!q) return { ...PACK_FALLBACK, question: q };
  if (/仁|benevolence/i.test(q)) {
    return {
      question: q,
      claims: DEMO_CLAIMS,
      evidence: DEMO_EVIDENCE,
      followups: ["「克己复礼」是在要求人压抑自己吗？", "去仪礼里体会过与不及"],
    };
  }
  if (/克己|复礼|压抑/.test(q)) return { ...PACK_LI, question: q };
  if (/忠恕|忠|恕/.test(q)) return { ...PACK_ZHONGSHU, question: q };
  return { ...PACK_FALLBACK, question: q };
}

export function getMockPassage(refId: string): MockPassage | null {
  return MOCK_PASSAGES[refId] ?? null;
}
