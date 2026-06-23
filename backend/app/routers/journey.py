"""君子之路总览 — 六艺聚合 + 勋章 + 排行榜。

不建新表，全部基于现有 User.liuyi（JSON: {li, yue, she, yu, shu, shu2}）计算。
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..services.auth import get_current_user

router = APIRouter(prefix="/api/v1/journey", tags=["journey"])

# 六艺顺序固定：礼乐射御书数
ARTS = [
    {"key": "li",   "label": "礼", "field": "li",   "subtitle": "情境抉择 · 仁敬",         "color": "#993C1D"},
    {"key": "yue",  "label": "乐", "field": "yue",  "subtitle": "五音合鸣 · 和而不同",     "color": "#854F0B"},
    {"key": "she",  "label": "射", "field": "she",  "subtitle": "3D 射场 · 反求诸己",      "color": "#0F6E56"},
    {"key": "yu",   "label": "御", "field": "yu",   "subtitle": "五御之礼 · 礼以行之",     "color": "#534AB7"},
    {"key": "shu",  "label": "书", "field": "shu",  "subtitle": "字源图鉴 · 识字明义",     "color": "#1E5F8E"},
    {"key": "shu2", "label": "数", "field": "shu2", "subtitle": "均输衰分 · 不患寡而患不均", "color": "#7A3A2E"},
]

# 8 枚勋章（6 单艺 + 2 综合）
BADGE_DEFS = [
    {"key": "li_30",     "name": "习礼者",   "desc": "礼分达到 30",       "tier": "normal", "art": "li",   "threshold": 30},
    {"key": "yue_30",    "name": "知音",     "desc": "乐分达到 30",       "tier": "normal", "art": "yue",  "threshold": 30},
    {"key": "she_30",    "name": "反求诸己", "desc": "射分达到 30",       "tier": "normal", "art": "she",  "threshold": 30},
    {"key": "yu_30",     "name": "执御君子", "desc": "御分达到 30",       "tier": "normal", "art": "yu",   "threshold": 30},
    {"key": "shu_30",    "name": "通文达诂", "desc": "书分达到 30",       "tier": "normal", "art": "shu",  "threshold": 30},
    {"key": "shu2_30",   "name": "衡均",     "desc": "数分达到 30",       "tier": "normal", "art": "shu2", "threshold": 30},
    {"key": "all_40",    "name": "六艺通才", "desc": "六艺每艺 ≥ 40",     "tier": "gold",   "art": None,   "threshold": 40},
    {"key": "all_60_80", "name": "君子大成", "desc": "每艺 ≥ 60 且任一艺 ≥ 80", "tier": "treasure", "art": None, "threshold": 60},
]


def _art_score(liuyi: dict, field: str) -> int:
    return int((liuyi or {}).get(field, 0) or 0)


def _title_for(total: int, min_art: int) -> str:
    if total >= 480 and min_art >= 80: return "君子大成"
    if total >= 360 and min_art >= 40: return "六艺通才"
    if total >= 240: return "博学君子"
    if total >= 120: return "习艺之人"
    if total > 0: return "始入门"
    return "未起步"


def _user_overview(user: User) -> dict:
    liuyi = user.liuyi or {}
    scores = [_art_score(liuyi, a["field"]) for a in ARTS]
    total = sum(scores)
    min_art = min(scores) if scores else 0
    max_art = max(scores) if scores else 0
    title = _title_for(total, min_art)

    arts_detail = [
        {
            "key": a["key"],
            "label": a["label"],
            "subtitle": a["subtitle"],
            "color": a["color"],
            "score": s,
            "path": f"/journey/{a['key'] if a['key'] != 'shu2' else 'math'}",
        }
        for a, s in zip(ARTS, scores)
    ]

    # 勋章解锁判定
    badges = []
    for b in BADGE_DEFS:
        unlocked = False
        if b["art"]:
            unlocked = _art_score(liuyi, b["art"]) >= b["threshold"]
        elif b["key"] == "all_40":
            unlocked = min_art >= 40
        elif b["key"] == "all_60_80":
            unlocked = min_art >= 60 and max_art >= 80
        badges.append({
            "key": b["key"],
            "name": b["name"],
            "desc": b["desc"],
            "tier": b["tier"],
            "unlocked": unlocked,
        })

    return {
        "total_score": total,
        "title": title,
        "min_art": min_art,
        "max_art": max_art,
        "arts": arts_detail,
        "badges": badges,
        "badges_unlocked": sum(1 for b in badges if b["unlocked"]),
        "badges_total": len(badges),
    }


@router.get("/overview")
def overview(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """当前用户的六艺总览 + 勋章状态。"""
    return _user_overview(user)


@router.get("/leaderboard")
def leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
) -> dict:
    """按六艺总分排前 N。每人只占一个排名。

    去重规则（游客匿名都叫"小君子"，会产生很多冗余）：
      - 注册用户（has email）：按 user_id 唯一，永远不去重
      - 游客：按 display_name 去重，同名只保留**最高分**的那条
      - 当前用户（self）：永远保留自己的真实数据
    """
    rows = db.execute(select(User)).scalars().all()
    enriched = []
    for u in rows:
        liuyi = u.liuyi or {}
        scores = [_art_score(liuyi, a["field"]) for a in ARTS]
        total = sum(scores)
        if total <= 0:
            continue
        enriched.append({
            "user_id": u.id,
            "name": (u.display_name or "君子")[:8],
            "total": total,
            "by_art": {a["key"]: s for a, s in zip(ARTS, scores)},
            "is_self": user is not None and u.id == user.id,
            "is_guest": bool(u.is_guest),
        })
    # 先按总分排序
    enriched.sort(key=lambda x: -x["total"])

    # 去重：游客按 name，注册按 user_id（其实 user_id 天然唯一，所以注册不会重）
    seen_guest_names: set[str] = set()
    dedupe: list[dict] = []
    self_entry: Optional[dict] = None
    for it in enriched:
        if it["is_self"]:
            self_entry = it
        if it["is_guest"]:
            if it["name"] in seen_guest_names:
                # 已有更高分的同名游客，跳过 — 但如果是 self 必须保留
                if not it["is_self"]:
                    continue
            seen_guest_names.add(it["name"])
        dedupe.append(it)

    # 加 rank
    for i, item in enumerate(dedupe):
        item["rank"] = i + 1

    # 当前用户排名
    self_rank = next((it for it in dedupe if it["is_self"]), None) or self_entry
    return {
        "items": dedupe[:limit],
        "total_players": len(dedupe),
        "self": self_rank,
    }
