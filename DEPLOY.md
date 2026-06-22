# 部署指南

## 方式 A：Docker Compose 一键起（推荐）

### 前置
1. 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（mac/win/linux 都支持）
2. `cp backend/.env.example backend/.env` 并填入你的 `QWEN_API_KEY`

### 起服务
```bash
make up
```

等同于：
```bash
docker compose up -d
```

第一次构建大约 5-10 分钟（要拉 Neo4j、Python、Node 镜像 + 装依赖 + bge-m3 模型）。

### 访问
| 服务 | 地址 |
|---|---|
| 前端 | http://localhost:3000 |
| 后端 API | http://localhost:8000/docs |
| Neo4j 浏览器 | http://localhost:7474（账号 neo4j / kongzi-graph）|

### 常用命令
```bash
make logs                 # 看实时日志
make down                 # 停服务（保留数据）
make clean                # 停服务并清空数据卷（危险）
make translate-annos      # 在容器内用千问真译注释
make translate-concepts   # 在容器内用千问真译概念定义
make neo4j-ingest         # 把内存图同步到 Neo4j 容器
```

### 数据持久化
- `neo4j_data` 卷：Neo4j 图数据
- `backend_data` 卷：SQLite DB + Chroma 向量索引 + HF 模型缓存

### 切到 PostgreSQL（生产）
在 `backend/.env` 改：
```ini
DATABASE_URL=postgresql+psycopg://kongzi:pass@postgres:5432/kongzi
```
并在 `docker-compose.yml` 加 postgres 服务。

---

## 方式 B：本地开发（不用 Docker）

### 后端
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env  # 填 QWEN_API_KEY
.venv/bin/uvicorn app.main:app --port 8000 --reload
```

### 前端
```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

### Neo4j（可选，否则用 in-memory 图）
```bash
brew install neo4j
neo4j-admin dbms set-initial-password kongzi-graph
neo4j start
.venv/bin/python -m app.graph_ingest
```

---

## 故障排查

| 现象 | 排查 |
|---|---|
| 前端首页"后端未连接" | `curl http://localhost:8000/health` 看是否返回 200 |
| 对话页千问报错 | `cat backend/.env` 看 `QWEN_API_KEY` 是否填了 |
| Neo4j 起不来 | `docker compose logs neo4j` 看错误；端口 7474/7687 是否被占 |
| Docker 构建超时 | bge-m3 模型首次约 2.2GB，要等下载；`make build` 看进度 |
| 想换千问模型 | `.env` 改 `QWEN_MODEL=qwen-max` 等，重启容器 |
