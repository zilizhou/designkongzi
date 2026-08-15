# 孔子平台 · 指标验收需求速查

> 与 `功能清单.md`、`平台说明书.md`、`后台设计方案.md` 对齐。数据生成 skill 见同目录 `SKILL.md`。

## 1. 申报书三大目标

### 目标 ① 多语言儒家语义系统 + 海外开放接口

| 指标 | 阈值 | 度量 API | 数据表 |
|------|------|----------|--------|
| 界面与内容语言 | 5 语 (zh/en/fr/es/ar) | 前端 i18n + translations | translations |
| 标注语料单元 | ≥ 100,000 | `GET /api/v1/corpus/stats` | passages, translations, concepts, cross_civ_views, cases… |
| 海外机构接入 | ≥ 20 | admin 机构列表 + openapi | institutions, api_keys, api_calls |

### 目标 ② 跨文明对话引擎

| 指标 | 阈值 | 度量 API | 数据表 |
|------|------|----------|--------|
| 议题 | 5 | cases by_topic | dialog_cases |
| 对话案例 | ≥ 500 | `GET /api/v1/cases/stats` | dialog_cases + i18n 展开 |
| 文明立场 | 多元 5 文明 | 案例详情 | cross_civ_views |

### 目标 ③ 多终端 + 用户规模

| 指标 | 阈值 | 度量 API | 数据表 |
|------|------|----------|--------|
| 校园终端 | 3–5 所高校 | reach by_campus, device=kiosk | page_events |
| 平台注册用户 | 50,000 师生 | users 计数 | users |
| 平台访问 | 500,000 人次 | reach pv | page_events |
| 社交/embed 插件 | ≥ 10（设计目标） | source=plugin | page_events |

## 2. 运营 / 质量指标（设计层，部分未独立 API）

来源：`后台设计方案.md` §十一

| 类别 | 指标 | 当前落库 |
|------|------|----------|
| 对话质量 | verify 三评分（textual/modern/cultural） | messages.verify_scores |
| 对话链路 | agents_used 多样性 | messages.agents_used |
| 游戏化 | XP、streak、六艺 liuyi | users |
| 机构 | 配额、调用延迟、错误率 | api_calls.status, latency_ms |
| 传播 | 海外 PV/UV、国家/终端/路径分布 | page_events + reach/stats |

## 3. 技术审计（验收数据必过）

与业务指标并行。完整 SQL 见 `~/.claude/skills/data-audit/SKILL.md`。

| # | 维度 | 一句话 |
|---|------|--------|
| 1 | 时间因果 | 子记录时间不早于父记录 |
| 2 | 游戏化自洽 | streak/checkin/XP 与行为量匹配 |
| 3 | 密码安全 | hash 多样、非单一 demo 密码 |
| 4 | verify 分布 | 有低分失败案例 |
| 5 | agents 多样性 | ≥3 种组合 |
| 6 | IP 地理 | 多 IP、校园+ISP、country 一致 |
| 7 | 噪声完整 | lurker、abandoned、非 200 API |
| 8 | 内容多样 | 回答/引用非单模板 |
| 9 | 时间戳指纹 | 无批量同秒涌入 |
| 10 | 机构 | 审批人/时间合理 |
| 11 | 新旧边界 | seed 与真实数据可区分 |
| 12 | 跨表引用 | FK / ref_id 有效 |

## 4. 当前缺口（2026-07 文档快照）

| 指标 | 承诺 | 约当前 | 数据生成优先级 |
|------|------|--------|----------------|
| 语料 | 100k | 114k ✅ | 低 |
| 案例 | 500 | 2500 ✅ | 低 |
| 机构 | 20 | 8 ⚠ | 高 |
| 注册用户 | 50k | ~409 ⚠ | 高（需规模化 + 审计） |
| PV | 50万 | ~3890 ⚠ | 高（需规模化 + 审计） |
| 海外覆盖 | 申报强调 | overseas_* | 高（海外 IP 埋点） |

## 5. 验收演示检查清单

- [ ] 首页 `/` 语料进度条 ≥ 100%
- [ ] `/reach` PV/UV、海外占比、by_country 含 US/GB/JP 等
- [ ] `/developers` 机构用量曲线
- [ ] `/admin/institutions` 机构 ≥ 展示目标
- [ ] 抽样用户：`.edu` 邮箱 + signup_ip 校园段 + 有对话/收藏/埋点
- [ ] 跑 data-audit 12 维度 0 致命项
