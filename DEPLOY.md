# 部署指南

## 整体流程

```
┌──────────────┐       ┌───────────────┐       ┌──────────────────┐
│   本地 Mac    │       │  云效 Codeup   │       │  服务器 10.26.6.108 │
│  (开发 / 推送) │ push  │  (代码托管)   │ pull  │  (运行容器)        │
│              ├──────▶│               ├──────▶│                  │
└──────────────┘       └───────────────┘       └──────────────────┘
                       git@codeup.aliyun.com:67c3c82f171fc8e8d8c4cee8/rujiawenhua/kongzi.git
```

部署口径：**代码走 git**，**数据库/秘钥不走 git**（`.env`、`kongzi.db`、`hf_home/`、`chroma/` 都在 `.gitignore` 内）。

---

## 一、首次配置（一次性 · 已完成可跳过）

### 1.1 本地 Mac 已就绪 ✅

```bash
# 已完成的事：
# - .gitignore 排除 .env / kongzi.db / node_modules / hf_home / chroma 等
# - git init + commit 4137846 作基线
# - git remote add origin git@codeup.aliyun.com:67c3c82f171fc8e8d8c4cee8/rujiawenhua/kongzi.git
# - git push -u origin main 已推送
```

验证：
```bash
git remote -v        # 应看到 origin = codeup.aliyun.com:.../kongzi.git
git log --oneline    # 至少有 1 个 commit
```

### 1.2 服务器端：把公钥加到云效（**待办**）

**当前服务器 SSH 公钥**（需要你登录云效加进去）：
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOyOBBw2+95OIAcUhdgfEk9mrctguC4yBPsgt55PBY3I lansk-deploy
```

操作：
1. 登录 [云效 Codeup](https://codeup.aliyun.com)
2. 右上角头像 → **个人设置** → **SSH 公钥** → **添加公钥**
3. 名称填 `kongzi-server-10.26.6.108`，公钥粘贴上面那一段
4. 测试：在服务器跑 `ssh -T git@codeup.aliyun.com` —— 应输出 `Welcome to Codeup, <your_user>!`

> 注：如果你不希望服务器用你的个人账号读，可以改用「项目级 Deploy Key（只读）」——在云效项目设置 → 部署公钥里加，只读权限更安全。

### 1.3 服务器首次 clone（**SSH key 配好后执行一次**）

```bash
ssh exp605@10.26.6.108 << 'EOF'
set -e
# 备份现有 rsync 目录（保留 .env、kongzi.db、hf_home、chroma 一段时间以防回滚）
mv ~/kongzi ~/kongzi-rsync-backup-$(date +%Y%m%d-%H%M%S)
# 从云效 clone
git clone git@codeup.aliyun.com:67c3c82f171fc8e8d8c4cee8/rujiawenhua/kongzi.git ~/kongzi
# 把不在 git 里的密钥复制回来
cp ~/kongzi-rsync-backup-*/backend/.env ~/kongzi/backend/.env
echo "Done. Verify ~/kongzi/.git exists and ~/kongzi/backend/.env has QWEN_API_KEY"
ls -la ~/kongzi/.git/HEAD ~/kongzi/backend/.env
EOF
```

> ⚠ **docker volume 不动**：`kongzi_backend_data`、`kongzi_neo4j_data` 是按 docker-compose 项目名挂载，新目录只要还叫 `kongzi/` 且 `docker-compose.yml` 不变，docker 仍会复用原数据卷——**SQLite 数据库、Chroma 向量索引、Neo4j 图谱不会丢**。

---

## 二、日常部署流程

### 2.1 本地：改完 → push

```bash
# 在 Mac 上改完代码
git status                                  # 看改了啥
git add backend/app/routers/yu.py frontend/src/app/journey/yu/    # 按需 add（避免 -A）
git commit -m "feat(yu): add chariot driving game"
git push                                    # 推到云效 main
```

### 2.2 服务器：pull → 重 build → 重启

```bash
# 一行式（推荐）：
ssh exp605@10.26.6.108 'cd ~/kongzi && git pull && docker compose build && docker compose up -d'

# 或者分步：
ssh exp605@10.26.6.108
cd ~/kongzi
git pull                          # 拉最新代码
docker compose build backend frontend   # 重建变化的镜像（只改前端可只 build frontend）
docker compose up -d              # 起服务
docker compose ps                 # 验证三个容器都 Up
```

### 2.3 仅前端 / 仅后端 改动时（更快）

| 改了什么 | 命令 |
|---|---|
| 仅 `frontend/src/**` | `docker compose build frontend && docker compose up -d frontend` |
| 仅 `backend/app/**`（不改依赖） | `docker compose build backend && docker compose up -d backend` |
| 改了依赖（package.json / requirements.txt） | `docker compose build --no-cache <service> && docker compose up -d <service>` |
| 仅 `docker-compose.yml` 或 `.env` | `docker compose up -d` |

---

## 三、数据库 / 种子

数据存在 docker volume `kongzi_backend_data` 中，**不在 git 里**。新代码加了表/种子时，要手动跑：

```bash
# 新表会被 SQLAlchemy create_all 自动建（容器启动时）
# 已有表加列要手动 ALTER（见每次 PR 描述）

# 灌种子
ssh exp605@10.26.6.108 'cd ~/kongzi && docker compose exec -T backend python -m app.seed_shu_cards'
ssh exp605@10.26.6.108 'cd ~/kongzi && docker compose exec -T backend python -m app.seed_yue_scenarios'
ssh exp605@10.26.6.108 'cd ~/kongzi && docker compose exec -T backend python -m app.seed_math_scenarios'
ssh exp605@10.26.6.108 'cd ~/kongzi && docker compose exec -T backend python -m app.seed_she_passages'
```

---

## 四、回滚

### 4.1 服务器回滚到上一个 commit

```bash
ssh exp605@10.26.6.108 << 'EOF'
cd ~/kongzi
git log --oneline -5              # 看最近 5 个 commit
git reset --hard HEAD~1           # 回到上一个 commit（或指定 hash: git reset --hard 4137846）
docker compose build && docker compose up -d
EOF
```

### 4.2 数据库回滚

`kongzi.db` 是 SQLite 单文件，建议定期备份：
```bash
# 备份
ssh exp605@10.26.6.108 'docker compose -f /home/exp605/kongzi/docker-compose.yml exec -T backend cp /data/kongzi.db /data/kongzi.db.bak-$(date +%Y%m%d)'

# 恢复
ssh exp605@10.26.6.108 'docker compose -f /home/exp605/kongzi/docker-compose.yml exec -T backend cp /data/kongzi.db.bak-YYYYMMDD /data/kongzi.db'
ssh exp605@10.26.6.108 'cd /home/exp605/kongzi && docker compose restart backend'
```

---

## 五、密钥维护

| 文件 | 位置 | 是否在 git | 说明 |
|---|---|---|---|
| `backend/.env` | 服务器 `~/kongzi/backend/.env`（手动维护）| ❌ 在 `.gitignore` | 含 `QWEN_API_KEY`、`JWT_SECRET`、`NEO4J_PASSWORD`、`ADMIN_EMAILS` |
| `.env.example` | git 内 | ✅ | 模板，列出需要的环境变量名，**不能含真实 key** |
| 服务器 SSH key | `/home/exp605/.ssh/id_ed25519` | ❌ | 用于 git pull 云效 |

新加环境变量：
1. 改 `backend/.env.example`（git 内）
2. 服务器 `vi ~/kongzi/backend/.env` 加同名变量
3. `docker compose restart backend`

---

## 六、访问

| 服务 | 地址 |
|---|---|
| 前端 | http://10.26.6.108:3000 |
| 后端 API | http://10.26.6.108:8000/docs |
| Neo4j 浏览器 | http://10.26.6.108:7474（账号 `neo4j` / `kongzi-graph`）|

---

## 七、本地开发（无需 Docker）

不通过 docker 跑，直接在 Mac 起：

```bash
# 后端
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env             # 填 QWEN_API_KEY
.venv/bin/uvicorn app.main:app --port 8000 --reload

# 前端（另一终端）
cd frontend
npm install
npm run dev                      # http://localhost:3000
```

---

## 八、故障排查

| 现象 | 排查命令 |
|---|---|
| `git push` 提示 Permission denied | `ssh -T git@codeup.aliyun.com` 测连通；检查 SSH key 是否加到云效 |
| 服务器 `git pull` 报 Permission denied | 服务器的公钥 `~/.ssh/id_ed25519.pub` 未加到云效（见 §1.2）|
| 后端起来 500 | `docker compose logs --tail=50 backend` 看堆栈；常见是新加字段未 ALTER |
| 前端 build 失败 ESLint | 看错误行号，删除未用 import 或 var |
| 容器一直 Restarting | `docker compose logs <name>` 看具体错误；常见是 port 被占（lsof -i :3000）|
| 千问 401 | `cat ~/kongzi/backend/.env` 看 `QWEN_API_KEY` 是否填了 |
| `git pull` 报 local changes | 服务器有未跟踪改动；`git stash && git pull && git stash pop` 或直接 `git reset --hard origin/main` |

---

## 附：一键部署脚本（推荐 alias）

在 Mac `~/.zshrc` 加：

```bash
alias kongzi-deploy='git push && ssh exp605@10.26.6.108 "cd ~/kongzi && git pull && docker compose build && docker compose up -d && docker compose ps"'
```

之后改完代码：
```bash
git add . && git commit -m "..."
kongzi-deploy
```
