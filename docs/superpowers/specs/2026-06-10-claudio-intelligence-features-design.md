# Claudio AI 智能电台 — 五大智能功能设计文档

**日期**: 2026-06-10  
**状态**: 设计完成，待评审

---

## 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                             │
│  Chat UI │ Queue Panel │ Favs Panel │ Stats Panel        │
│  ┌────────────────────────────────────────────────┐     │
│  │  铃铛按钮(场景建议) │ Notification API │ Toast   │     │
│  └────────────────────────────────────────────────┘     │
└──────────────┬──────────────────┬───────────────────────┘
               │   WebSocket      │  HTTP API
               ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│                  Router (API)                             │
│  /api/chat  /api/hide  /api/stats  /api/stats/generate   │
│  /api/queue/suggested  /api/report/monthly                │
└──────────────┬──────────────────┬───────────────────────┘
               │                  │
    ┌──────────▼──────┐  ┌───────▼────────┐  ┌───────────┐
    │  predictor.ts   │  │  feedback.ts   │  │ triggers  │
    │  场景→推荐队列    │  │  跳过→纠偏      │  │ .ts       │
    │  时间/天气/日历   │  │  mood-rules    │  │ 环境→建议  │
    └────────┬────────┘  │  自动写入       │  └─────┬─────┘
             │           └───────┬────────┘        │
             │                   │                  │
    ┌────────▼───────────────────▼──────────────────▼─────┐
    │         Claude (Orchestrator) — 唯一大脑             │
    │  增强输出: say / play / mood / arc / reason / segue  │
    └────────┬─────────────────────────────────────────────┘
             │
    ┌────────▼────────┐  ┌─────────────────┐
    │  triggers.ts    │  │  analytics.ts   │
    │  环境变化检测     │  │  播放统计+洞察   │
    │  推送建议        │  │  月度/年度报告   │
    └─────────────────┘  └─────────────────┘
```

核心原则不变：**Claude 唯一大脑决策**，新模块只做数据采集、触发信号、结果存储。无硬编码意图匹配。

---

## 模块 A：预测性播放队列

### 目标
用户打开应用即看到当前场景的推荐队列，无需输入。用户可接受或覆盖。

### 场景识别（predictor.ts）
根据时间 + 天气 + 日历标签生成场景标签：

| 时间 | 天气 | 日历 | 场景 |
|------|------|------|------|
| 周一 7-9am | — | 有会议 | morning_commute_hurry |
| 周一 7-9am | — | 无会议 | morning_commute |
| 周五 18-22pm | — | — | friday_night |
| 22-24pm | 下雨 | — | rainy_night |
| 周末 10-14am | 晴 | — | weekend_chill |
| 任意 | — | 生日 | birthday |

### 数据流
1. 前端页面加载 → `GET /api/queue/suggested`
2. 后端收集 context（天气/日历/时间/taste.md/mood-rules.md/history）
3. 组装 prompt（含 scene 上下文）→ Claude 生成搜索 query 列表
4. 返回 `{ scene, reason, tracks: PlayItem[], expires_in: 3600 }`
5. 前端展示在 Queue 面板，用户点播放或忽略

### Claude Prompt 注入
```
=== Scene Context ===
Scene: morning_commute
Why: Monday 8am, weather clear, you have a meeting at 9am
Play count: 5-8 tracks
Energy curve: start medium, climb to high
```

### 关键约束
- 不自动播放，用户掌握启动权
- 结果不持久化，每次打开重新生成
- 用户输入新指令时覆盖推荐队列

### 改动文件
- `src/predictor.ts` — 新建，场景识别 + 推荐生成
- `src/router.ts` — `GET /api/queue/suggested`
- `frontend/app.js` — 页面加载时请求推荐队列，更新 Queue 面板

### 数据
- 读取已有表和文件，不新增表

---

## 模块 B：情绪感知与渐进过渡

### 目标
用户表达情绪时，Claude 不直接跳转到目标情绪，而是渐进过渡：先共情 → 中速回暖 → 最后高能量。

### Claude 输出扩展
```json
{
  "say": "DJ播报文案",
  "play": ["track1", "track2", "track3"],
  "reason": "选歌原因",
  "segue": "转场词",
  "mood": { "detected": "低落的", "target": "平静的" },
  "arc": { "start": "slow", "end": "warm", "steps": 3 }
}
```

### Prompt 注入逻辑
router.ts 检测用户消息含情绪关键词（"心情不好""累了""开心""难过""焦虑"）时，prompt 追加：
```
=== Mood Guidance ===
User mood seems: low
Strategy: validate first (1 slow song), then warm up (mid-tempo), never jump to happy.
Output "mood" and "arc" fields in your JSON.
```

### 前端展示
- 每个 track 标记 arc 位置（进度条下小字：`情绪过渡 2/5`）
- 纯视觉反馈，不强制交互

### 改动文件
- `src/router.ts` — 情绪关键词检测 + prompt 注入
- `src/claude.ts` — `ClaudeOutput` 接口加 `mood`/`arc` 字段
- `frontend/app.js` — 展示 arc 进度
- `frontend/style.css` — arc 指示器样式

### 数据
- 不新增表

---

## 模块 C：连续跳过自动纠偏

### 目标
会话内连续 skip ≥ 3 次同风格 → 自动纠正推荐方向并更新 mood-rules.md。

### 新增表 `skips`
```sql
CREATE TABLE skips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id TEXT NOT NULL,
  song_name TEXT,
  artist TEXT,
  scene TEXT,
  session_id TEXT,
  skipped_at TEXT DEFAULT (datetime('now'))
);
```

### 数据流
```
用户点隐藏 → POST /api/hide（已有）
  → 新增: feedback.ts 记录 skip 事件到 skips 表
  → 查询同 session_id 最近 5 条 skip
  → 同场景连续 ≥ 3? 触发纠偏
  → 生成修正规则写入 mood-rules.md
  → 触发 Claude 重新推荐（prompt 含"之前推的 X 方向被连跳了"）
  → WebSocket broadcast "correction"（含新 Claude 回复 + 新队列）
```

### mood-rules.md 自动写入格式
```markdown
## auto-rule 2026-06-10
连续跳过 heavy_metal → 降低 80% 权重
```

### 前端行为
- 隐藏按钮保持现有行为
- 纠偏触发时 chat 面板自动出现 Claude 消息："刚才的方向不对，换这个试试"
- WebSocket `correction` 事件带新队列覆盖当前播放

### 防误判
- `session_id` 随页面刷新切换，避免跨天累积
- 不同场景标签的 skip 不聚合

### 改动文件
- `src/feedback.ts` — 新建，skip 计数 + 纠偏
- `src/db.ts` — skips 表 + `addSkip`/`getRecentSkips`
- `src/router.ts` — `/api/hide` 调用 feedback
- `prompts/mood-rules.md` — append 自动规则
- `frontend/app.js` — 处理 `correction` WebSocket 事件

---

## 模块 D：场景自动触发（零输入电台）

### 目标
后台检测环境变化，推送场景建议，用户一键播放。

### 触发规则

| 条件 | 建议文案 | 场景标签 |
|------|----------|----------|
| 傍晚 18-20 + 下雨 | 下雨了，来点爵士？ | rainy_evening |
| 周一 7-9am | 周一早上，提神节奏？ | morning_commute |
| 周五 18-22pm | 周五晚上，放松一下？ | friday_night |
| 日历有"生日" | 今天有人生日，来点庆祝？ | birthday |
| 22-24pm | 夜深了，轻柔助眠？ | late_night |
| 周末 10-14 + 晴 | 好天气，来点轻松的？ | weekend_chill |

### 数据流
```
triggers.ts 每 5 分钟检查条件
  → 条件命中 + 未在当前触发窗口触发过
  → WebSocket broadcast "suggestion"
  → 前端显示 toast / 铃铛徽标
  → 用户点击 → /api/chat?scene=xxx → Claude 生成队列
```

### 防骚扰
- 同一条件 2 小时内不重复推
- 正在播放时不弹 toast，仅铃铛徽标
- 前端可关闭场景建议（存 localStorage）

### 前端 UI
- 播放器右上角铃铛按钮，有建议时显示数字徽标
- 点击展开建议卡片："下雨了，来点爵士？" → [播放] [忽略]
- 点击播放 → 发送 `/api/chat` 带 scene 参数

### 变动文件
- `src/triggers.ts` — 新建，环境检测 + 规则引擎
- `src/router.ts` — `/api/triggers/check`，chat 接口支持 `scene` 参数
- `src/server.ts` — 启动 triggers 定时器
- `frontend/app.js` — WebSocket `suggestion` 事件 + toast + 铃铛
- `frontend/index.html` — 铃铛按钮
- `frontend/style.css` — toast 卡片 + 铃铛样式

---

## 模块 E：用户品味成长曲线

### 目标
统计播放数据，Claude 生成洞察报告。月度自动生成 + 随时可问。

### 新增表 `play_stats`
```sql
CREATE TABLE play_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL,
  stat_json TEXT NOT NULL,
  insight_md TEXT NOT NULL,
  generated_at TEXT DEFAULT (datetime('now'))
);
```

### 统计维度（analytics.ts 从 plays 表聚合）
- 总播放次数、活跃天数
- Top 5 歌手、Top 5 歌曲
- 新增收藏数、跳过数
- 活跃时段分布（0-6 / 6-12 / 12-18 / 18-24）
- 风格分布（从歌曲名/歌手推断）
- 本月新发现（首次出现的歌手/歌曲 vs 全量历史）

### Claude 生成洞察
```
你是一名音乐数据分析师。根据以下统计生成月度听歌报告：

- 总播放 342 次，活跃 28 天
- Top 歌手: 法老(34), Bill Evans(28), ...
- 深夜时段占比 42%
- 本月新发现: Miles Davis, Joji
- ToT 风格: Lo-fi Jazz 上升, Electro 下降

请生成自然中文报告，包含：
1. 总体画像（1句话）
2. 时间习惯（1句话）
3. 品味变化（1句话）
4. 下月推荐方向（1句话）
```

### API
- `GET /api/stats?period=2026-06` → 已生成的报告
- `POST /api/stats/generate` → 触发当前月份报告生成
- WebSocket `stats_ready` → 月报生成完成推送

### 前端
- FAVS 旁新增 STATS tab
- 展示 Claude 生成的报告卡片
- 底部"生成本月报告"按钮
- 历史报告下拉切换

### 改动文件
- `src/analytics.ts` — 新建，数据聚合 + Claude 调用
- `src/db.ts` — play_stats 表 + CRUD
- `src/router.ts` — `/api/stats`、`/api/stats/generate`
- `frontend/app.js` — Stats tab 逻辑
- `frontend/index.html` — Stats tab + panel
- `frontend/style.css` — 报告卡片样式

---

## 实现优先级

| 优先级 | 模块 | 原因 |
|--------|------|------|
| P0 | A — 预测队列 | 用户每次打开受益，改动小 |
| P1 | B — 情绪过渡 | prompt 改动为主，成本低 |
| P2 | C — 跳过纠偏 | 需要新表 + feedback 逻辑 |
| P3 | D — 场景触发 | 需要定时器 + 前端 toast |
| P4 | E — 品味报告 | 依赖足够播放数据积累 |

建议按 A → B → C → D → E 顺序实现，每模块独立可测。

---

## 不改的东西

- 不修改 Claude 动作格式核心结构（say/play/reason/segue 保留）
- 不修改 executor.ts 播放逻辑
- 不修改 adapters 层
- 不引入新的外部依赖
- 不做用户意图硬编码匹配（符合 CLAUDE.md 设计约束）
