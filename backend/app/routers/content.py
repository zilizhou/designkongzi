from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from ..db import get_db
from ..models import Book, Chapter, Passage
from ..schemas import AnnotationOut, PassageOut, TranslationOut

router = APIRouter(prefix="/api/v1", tags=["content"])


@router.get("/books")
def list_books(db: Session = Depends(get_db)) -> List[dict]:
    books = db.execute(select(Book).order_by(Book.sort_order)).scalars().all()
    return [
        {"id": b.id, "title_zh": b.title_zh, "title_i18n": b.title_i18n}
        for b in books
    ]


@router.get("/books/{book_id}/chapters")
def list_chapters(book_id: str, db: Session = Depends(get_db)) -> List[dict]:
    chapters = (
        db.execute(
            select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.sort_order)
        )
        .scalars()
        .all()
    )
    return [{"id": c.id, "title_zh": c.title_zh} for c in chapters]


@router.get("/chapters/{chapter_id}/passages")
def list_passages(chapter_id: str, db: Session = Depends(get_db)) -> List[dict]:
    rows = (
        db.execute(
            select(Passage)
            .where(Passage.chapter_id == chapter_id)
            .order_by(Passage.sort_order)
        )
        .scalars()
        .all()
    )
    return [{"id": p.id, "ref_label": p.ref_label, "original_text": p.original_text} for p in rows]


@router.get("/passages/{ref_id}", response_model=PassageOut)
def get_passage(
    ref_id: str,
    lang: str = Query("zh"),
    db: Session = Depends(get_db),
) -> PassageOut:
    """读经页五层信息：原文 / 拼音 / 译文 / 注释 / (AI 解读占位)。"""
    p = db.execute(
        select(Passage)
        .where(Passage.id == ref_id)
        .options(
            selectinload(Passage.translations),
            selectinload(Passage.annotations),
        )
    ).scalar_one_or_none()
    if not p:
        raise HTTPException(404, f"passage {ref_id} not found")

    return PassageOut(
        id=p.id,
        ref_label=p.ref_label,
        original_text=p.original_text,
        pinyin=p.pinyin,
        concepts=list(p.concepts or []),
        translations=[
            TranslationOut(lang=t.lang, text=t.text, translator=t.translator)
            for t in p.translations
            if lang == "all" or t.lang == lang or t.lang == "zh"
        ],
        annotations=[
            AnnotationOut(type=a.type, lang=a.lang, source=a.source, content=a.content)
            for a in p.annotations
        ],
        ai_reading=None,  # 运行时由智能体生成并缓存，不入静态库
    )


@router.get("/search")
def search(
    q: str = Query(..., min_length=1),
    lang: str = Query("zh"),
    k: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db),
) -> List[dict]:
    from ..services.retrieval import retrieve

    results = retrieve(db, q, lang=lang, k=k)
    return [
        {
            "ref_id": r.ref_id,
            "ref_label": r.ref_label,
            "original_text": r.original_text,
            "translation": r.translation,
            "score": r.score,
        }
        for r in results
    ]
