.PHONY: up down logs build clean translate-annos translate-concepts neo4j-ingest

help:
	@echo "孔子 · 一键命令"
	@echo "  make up                   docker compose 起全栈"
	@echo "  make down                 停全栈"
	@echo "  make logs                 看日志"
	@echo "  make build                重建镜像"
	@echo "  make clean                清数据卷（危险）"
	@echo ""
	@echo "  make translate-annos      用千问真译注释（≈ 8 分钟）"
	@echo "  make translate-concepts   用千问真译概念定义"
	@echo "  make neo4j-ingest         把内存图灌入 neo4j 容器"

up:
	docker compose up -d
	@echo "▷ 后端 http://localhost:8000  前端 http://localhost:3000  Neo4j http://localhost:7474"

down:
	docker compose down

logs:
	docker compose logs -f --tail=80

build:
	docker compose build --no-cache

clean:
	docker compose down -v

translate-annos:
	docker compose exec backend python -m app.translate_corpus --annos

translate-concepts:
	docker compose exec backend python -m app.translate_corpus --concepts

neo4j-ingest:
	docker compose exec backend python -m app.graph_ingest
