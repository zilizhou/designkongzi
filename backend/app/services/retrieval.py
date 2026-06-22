"""经典检索（RAG 的 R）。

两种后端：
- vector：Chroma 向量召回（跨语言语义检索），由 `services/vector_store` 提供。
- keyword：关键词重叠打分（零依赖兜底，也用于评测对照）。

对外入口 `retrieve()` 签名稳定，orchestrator 不感知后端切换。
`settings.retrieval_backend = auto|vector|keyword`：
  auto → 向量库已建好则用向量，否则降级关键词。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..config import get_settings
from ..models import Passage

settings = get_settings()


@dataclass
class Evidence:
    ref_id: str
    book: str
    chapter: str
    ref_label: str
    original_text: str
    translation: str
    concepts: List[str]
    score: float


# ── 关键词后端 ────────────────────────────────────────────────────────────────
_NOISE = set("，。！？、；：「」『』《》（）()和的是了吗呢啊什么怎么如何 \t\n")


def _terms(text: str) -> List[str]:
    return [c for c in text if c not in _NOISE]


def _passage_map(db: Session) -> Dict[str, Passage]:
    rows = (
        db.execute(
            select(Passage).options(
                selectinload(Passage.translations), selectinload(Passage.chapter)
            )
        )
        .scalars()
        .all()
    )
    return {p.id: p for p in rows}


def _to_evidence(p: Passage, lang: str, score: float) -> Evidence:
    trans_text = ""
    for t in p.translations:
        if t.lang == lang:
            trans_text = t.text
            break
    return Evidence(
        ref_id=p.id,
        book=p.chapter.book_id if p.chapter else "",
        chapter=p.chapter.title_zh if p.chapter else "",
        ref_label=p.ref_label or p.id,
        original_text=p.original_text,
        translation=trans_text,
        concepts=list(p.concepts or []),
        score=round(score, 4),
    )


def retrieve_keyword(db: Session, query: str, lang: str = "zh", k: int = 5) -> List[Evidence]:
    q_terms = set(_terms(query))
    q_lower = query.lower()
    scored: List[Evidence] = []
    for p in _passage_map(db).values():
        haystack = p.original_text + " " + (p.pinyin or "")
        for t in p.translations:
            haystack += " " + t.text
        overlap = sum(1 for term in q_terms if term in p.original_text)
        concept_hit = sum(1 for c in (p.concepts or []) if c.lower() in q_lower)
        en_hit = sum(1 for w in q_lower.split() if len(w) > 2 and w in haystack.lower())
        score = overlap * 2.0 + concept_hit * 3.0 + en_hit * 1.5
        if score <= 0:
            continue
        scored.append(_to_evidence(p, lang, score))
    scored.sort(key=lambda e: e.score, reverse=True)
    return scored[:k]


# ── 向量后端 ──────────────────────────────────────────────────────────────────
def retrieve_vector(db: Session, query: str, lang: str = "zh", k: int = 5) -> List[Evidence]:
    from . import vector_store

    hits = vector_store.query(query, k=k)
    pmap = _passage_map(db)
    out: List[Evidence] = []
    for h in hits:
        p = pmap.get(h["ref_id"])
        if p is None:
            continue
        out.append(_to_evidence(p, lang, h["similarity"]))
    return out


# ── 混合后端（Reciprocal Rank Fusion）────────────────────────────────────────
def retrieve_hybrid(
    db: Session, query: str, lang: str = "zh", k: int = 5, rrf_k: int = 60
) -> List[Evidence]:
    """融合向量与关键词两路排名（RRF）。

    RRF 分数 = Σ 1/(rrf_k + rank)，对每个候选累加两路名次贡献。
    不依赖两路分数量纲，鲁棒且实现简单——对应设计方案的「混合检索」。
    """
    vec = retrieve_vector(db, query, lang, k=k * 2)
    kw = retrieve_keyword(db, query, lang, k=k * 2)

    fused: Dict[str, float] = {}
    holder: Dict[str, Evidence] = {}
    for ranked in (vec, kw):
        for rank, ev in enumerate(ranked, 1):
            fused[ev.ref_id] = fused.get(ev.ref_id, 0.0) + 1.0 / (rrf_k + rank)
            holder.setdefault(ev.ref_id, ev)

    order = sorted(fused.items(), key=lambda kv: kv[1], reverse=True)
    out: List[Evidence] = []
    for ref_id, score in order[:k]:
        ev = holder[ref_id]
        ev.score = round(score, 5)
        out.append(ev)
    return out


# ── 统一入口 ──────────────────────────────────────────────────────────────────
def _vector_ready() -> bool:
    try:
        from . import vector_store

        return vector_store.count() > 0
    except Exception:
        return False


def retrieve(db: Session, query: str, lang: str = "zh", k: int = 5) -> List[Evidence]:
    backend = settings.retrieval_backend.lower()
    if backend == "keyword":
        return retrieve_keyword(db, query, lang, k)
    if backend == "vector":
        return retrieve_vector(db, query, lang, k)
    if backend == "hybrid":
        return retrieve_hybrid(db, query, lang, k)
    # auto：向量就绪则用向量，否则降级关键词。
    # （混合 hybrid 在大语料 + 真实 BM25 下更优；小语料上单路向量已最佳，故默认走向量）
    if _vector_ready():
        return retrieve_vector(db, query, lang, k)
    return retrieve_keyword(db, query, lang, k)
