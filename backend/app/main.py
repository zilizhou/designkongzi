from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .db import init_db
from .routers import auth, cases, chat, cocreate, concepts, content, corpus, embed, feed, gamify, graph, health, institutions, li_game, math as math_router, openapi, reach, she, shu, topics, yue
from .seed import seed_if_empty


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed_if_empty()
    # 向量后端：启动时确保索引就绪（auto/vector 模式且集合为空时构建）
    s = get_settings()
    if s.retrieval_backend.lower() in ("auto", "vector"):
        try:
            from .db import SessionLocal
            from .services import vector_store

            if vector_store.count() == 0:
                db = SessionLocal()
                try:
                    n = vector_store.index_corpus(db)
                    print(f"[startup] vector index built: {n} passages")
                finally:
                    db.close()
        except Exception as exc:  # noqa: BLE001  向量栈缺失时静默降级到关键词
            print(f"[startup] vector index skipped ({exc}); fallback to keyword")
    yield


settings = get_settings()

app = FastAPI(
    title="孔子 · 儒家语义交互平台 API",
    version="0.1.0",
    description="Stage 1 后端骨架：经典内容 + RAG 流式对话 + 概念图鉴。",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Conversation-Id"],
)

app.include_router(health.router)
app.include_router(content.router)
app.include_router(feed.router)
app.include_router(concepts.router)
app.include_router(graph.router)
app.include_router(topics.router)
app.include_router(cases.router)
app.include_router(corpus.router)
app.include_router(chat.router)
app.include_router(institutions.router)
app.include_router(openapi.router)
app.include_router(cocreate.router)
app.include_router(reach.router)
app.include_router(embed.router)
app.include_router(li_game.router)
app.include_router(she.router)
app.include_router(shu.router)
app.include_router(yue.router)
app.include_router(math_router.router)
app.include_router(auth.router)
app.include_router(gamify.router)
