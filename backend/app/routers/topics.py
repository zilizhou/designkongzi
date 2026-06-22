from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..services import topics as topics_svc

router = APIRouter(prefix="/api/v1", tags=["topics"])


@router.get("/topics")
def list_topics(lang: str = Query("zh"), db: Session = Depends(get_db)) -> list:
    """5 大全球议题列表。"""
    return topics_svc.list_topics(db, lang)


@router.get("/topics/{topic_id}")
def get_topic(
    topic_id: str,
    lang: str = Query("zh"),
    db: Session = Depends(get_db),
) -> dict:
    """议题详情：含 5 文明对照立场。"""
    card = topics_svc.topic_card(db, topic_id, lang)
    if not card:
        raise HTTPException(404, f"topic {topic_id} not found")
    return {**card, "cross_civ_views": topics_svc.views_for(db, topic_id, lang)}


@router.post("/topics/classify")
def classify(
    body: dict,
    db: Session = Depends(get_db),
) -> dict:
    """议题分类：输入问题，返回 topic_id 或 null。"""
    return {"topic_id": topics_svc.classify(db, body.get("question", ""))}
