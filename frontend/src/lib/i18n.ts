// 轻量 i18n：5 语词典 + t() + 语言状态 hook（localStorage 持久化 + html lang/dir 联动）。
// 仅外化核心文案；长释义与正文由后端按 lang 返回。
"use client";

import { useEffect, useState } from "react";

export type Lang = "zh" | "en" | "fr" | "es" | "ar";

export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: "zh", label: "中", native: "中文" },
  { code: "en", label: "EN", native: "English" },
  { code: "fr", label: "FR", native: "Français" },
  { code: "es", label: "ES", native: "Español" },
  { code: "ar", label: "AR", native: "العربية" },
];

export const RTL_LANGS: Lang[] = ["ar"];

type Dict = Record<string, Record<Lang, string>>;

const DICT: Dict = {
  "brand.title": {
    zh: "切问近思",
    en: "Qiewen Jinsi",
    fr: "Qiewen Jinsi",
    es: "Qiewen Jinsi",
    ar: "تشي ون جين سي",
  },
  "brand.short": {
    zh: "切问", en: "Qiewen", fr: "Qiewen", es: "Qiewen", ar: "تشي ون",
  },
  "brand.line": {
    zh: "不是让 AI 扮演孔子，而是让 AI 对每一句解释负责。",
    en: "Not an AI playing Confucius — an AI accountable for every claim.",
    fr: "Pas une IA qui joue Confucius, mais une IA responsable de chaque assertion.",
    es: "No una IA que interpreta a Confucio, sino una IA responsable de cada afirmación.",
    ar: "ليست ذكاءً اصطناعيًا يتقمص كونفوشيوس، بل ذكاء يحاسب على كل دعوى.",
  },
  "nav.home":    { zh: "首页", en: "Home", fr: "Accueil", es: "Inicio", ar: "الرئيسية" },
  "nav.ask":     { zh: "切问", en: "Ask", fr: "Question", es: "Preguntar", ar: "سؤال" },
  "nav.practice":{ zh: "近思", en: "Practice", fr: "Pratique", es: "Práctica", ar: "تدريب" },
  "nav.canon":   { zh: "典", en: "Canon", fr: "Canon", es: "Canon", ar: "النصوص" },
  "nav.more":    { zh: "更多", en: "More", fr: "Plus", es: "Más", ar: "المزيد" },
  "nav.feed":    { zh: "刷刷", en: "Feed", fr: "Fil", es: "Feed", ar: "تصفح" },
  "nav.read":    { zh: "读经", en: "Read", fr: "Lecture", es: "Lectura", ar: "قراءة" },
  "nav.graph":   { zh: "图谱", en: "Graph", fr: "Graphe", es: "Grafo", ar: "الرسم" },
  "nav.chat":    { zh: "切问", en: "Ask", fr: "Question", es: "Preguntar", ar: "سؤال" },
  "nav.cases":   { zh: "案例", en: "Cases", fr: "Cas", es: "Casos", ar: "حالات" },
  "nav.journey": { zh: "六艺", en: "Six Arts", fr: "Six arts", es: "Seis artes", ar: "الفنون الستة" },
  "nav.me":      { zh: "我", en: "Me", fr: "Moi", es: "Yo", ar: "أنا" },
  "nav.studio": { zh: "界面稿", en: "Studio", fr: "Studio", es: "Estudio", ar: "الاستوديو" },
  "nav.developers": { zh: "开放接口", en: "Developers", fr: "API", es: "API", ar: "API" },
  "nav.cocreate": { zh: "共创", en: "Co-create", fr: "Co-créer", es: "Co-crear", ar: "إبداع مشترك" },
  "nav.plugins":  { zh: "插件", en: "Plugins", fr: "Modules", es: "Plugins", ar: "إضافات" },
  "nav.reach":    { zh: "覆盖", en: "Reach", fr: "Portée", es: "Alcance", ar: "الانتشار" },

  "home.values": {
    zh: "可溯源 · 可核验 · 可演练",
    en: "Traceable · Verifiable · Practicable",
    fr: "Traçable · Vérifiable · Pratiquable",
    es: "Trazable · Verificable · Practicable",
    ar: "قابل للتتبع · قابل للتحقق · قابل للتدريب",
  },
  "home.door.ask": {
    zh: "开始切问", en: "Begin asking",
    fr: "Commencer à questionner", es: "Empezar a preguntar", ar: "ابدأ السؤال",
  },
  "home.door.ask.desc": {
    zh: "提出一个概念或章句。回答按论断分轨，每句都能回到出处。",
    en: "Ask a concept or passage. Each claim is tracked and traced to a source.",
    fr: "Posez une question. Chaque assertion est classée et ramenée à sa source.",
    es: "Pregunta un concepto o pasaje. Cada afirmación vuelve a su fuente.",
    ar: "اسأل عن مفهوم أو فقرة. كل دعوى تعود إلى مصدرها.",
  },
  "home.door.practice": {
    zh: "进入近思", en: "Enter practice",
    fr: "Entrer en pratique", es: "Entrar a la práctica", ar: "ادخل التدريب",
  },
  "home.door.practice.desc": {
    zh: "在仪礼情境里练习、犯错、对照规则出处，再复盘。",
    en: "Practice rites, err, check the rule’s source, then review.",
    fr: "Pratiquez le rite, vous trompez, vérifiez la source, puis révisez.",
    es: "Practica el rito, equivócate, consulta la fuente y revisa.",
    ar: "تدرّب على الطقس، أخطئ، راجع مصدر القاعدة، ثم راجع نفسك.",
  },
  "home.try": {
    zh: "试一问", en: "Try this",
    fr: "Essayez", es: "Prueba", ar: "جرّب",
  },
  "home.quote": {
    zh: "今日金句", en: "Quote of the day",
    fr: "Citation du jour", es: "Cita del día", ar: "حكمة اليوم",
  },
  "home.entry.chat": {
    zh: "开始切问", en: "Begin asking",
    fr: "Commencer à questionner", es: "Empezar a preguntar", ar: "ابدأ السؤال",
  },
  "home.entry.chat.desc": {
    zh: "向智能体提问，得到可溯源的经典解读。",
    en: "Ask the agents; get traceable classical interpretations.",
    fr: "Interrogez les agents pour une exégèse traçable des classiques.",
    es: "Pregunta a los agentes y obtén interpretaciones clásicas trazables.",
    ar: "اسأل العملاء واحصل على تفسيرات كلاسيكية يمكن تتبعها.",
  },
  "home.entry.read": {
    zh: "读一读", en: "Read the classics",
    fr: "Lire les classiques", es: "Leer los clásicos", ar: "اقرأ النصوص",
  },
  "home.entry.read.desc": {
    zh: "原文·拼音·译文·注释 五层并读。",
    en: "Text · pinyin · translation · annotations, five layers.",
    fr: "Texte · pinyin · traduction · annotations, cinq couches.",
    es: "Texto · pinyin · traducción · notas, cinco capas.",
    ar: "النص والبينين والترجمة والشرح في خمس طبقات.",
  },
  "home.entry.graph": {
    zh: "知识图谱", en: "Knowledge graph",
    fr: "Graphe de connaissances", es: "Grafo de conocimiento", ar: "الرسم المعرفي",
  },
  "home.entry.graph.desc": {
    zh: "人物·概念·命题的关系网络。",
    en: "Network of persons, concepts, propositions.",
    fr: "Réseau de personnes, concepts, propositions.",
    es: "Red de personas, conceptos, proposiciones.",
    ar: "شبكة الأشخاص والمفاهيم والقضايا.",
  },
  "home.cta": {
    zh: "进入", en: "Enter →", fr: "Entrer →", es: "Entrar →", ar: "ادخل →",
  },

  "corpus.title": {
    zh: "多语料库 · 跨文明对照",
    en: "Multilingual corpus · cross-civilizational",
    fr: "Corpus multilingue · transcivilisationnel",
    es: "Corpus multilingüe · transcivilizacional",
    ar: "مدونة متعددة اللغات وعبر الحضارات",
  },
  "corpus.units": {
    zh: "条标注语料", en: "annotated units",
    fr: "unités annotées", es: "unidades anotadas", ar: "وحدة موسومة",
  },
  "corpus.target": {
    zh: "目标", en: "target", fr: "objectif", es: "objetivo", ar: "الهدف",
  },
  "corpus.langs": {
    zh: "种语言已覆盖", en: "languages covered",
    fr: "langues couvertes", es: "idiomas cubiertos", ar: "لغة مغطاة",
  },
  "corpus.cases": {
    zh: "跨文明对话案例", en: "cross-civ dialog cases",
    fr: "cas de dialogue inter-civilisations",
    es: "casos de diálogo intercivilizacional",
    ar: "حالات الحوار بين الحضارات",
  },

  "lang.label": {
    zh: "语言", en: "Language",
    fr: "Langue", es: "Idioma", ar: "اللغة",
  },
};

const STORAGE_KEY = "kongzi_lang";

function detect(): Lang {
  if (typeof window === "undefined") return "zh";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGS.some((l) => l.code === stored)) return stored as Lang;
  } catch {
    /* ignore */
  }
  const nav = (navigator.language || "zh").slice(0, 2).toLowerCase();
  const found = LANGS.find((l) => l.code === nav);
  return (found?.code as Lang) ?? "zh";
}

const listeners = new Set<(l: Lang) => void>();
let current: Lang | null = null;

function setHtmlAttrs(l: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = l;
  document.documentElement.dir = RTL_LANGS.includes(l) ? "rtl" : "ltr";
}

export function getLang(): Lang {
  if (current) return current;
  current = detect();
  return current;
}

export function setLang(l: Lang) {
  current = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* ignore */
  }
  setHtmlAttrs(l);
  listeners.forEach((fn) => fn(l));
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setS] = useState<Lang>("zh");
  useEffect(() => {
    const initial = getLang();
    setS(initial);
    setHtmlAttrs(initial);
    const sub = (l: Lang) => setS(l);
    listeners.add(sub);
    return () => {
      listeners.delete(sub);
    };
  }, []);
  return [lang, setLang];
}

export function t(key: string, lang: Lang): string {
  const entry = DICT[key];
  return entry?.[lang] ?? entry?.["zh"] ?? key;
}

export function isRTL(l: Lang): boolean {
  return RTL_LANGS.includes(l);
}
