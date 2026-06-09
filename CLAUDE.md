# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

不准在3000端口启动项目

## 项目愿景

**智能路由中转站** — 前端接收自然语言指令 → Claude Code 作为唯一大脑决策 → 解析 JSON 动作序列 → 调用 Music/TTS/UPnP 等后端服务执行。

核心原则：**Claude Code 是唯一的大脑**。所有业务决策必须由 Claude 生成结构化的 JSON 动作指令，代码层不做任何"如果用户说 X 就执行 Y"的硬编码匹配。

## 核心架构

```
用户 / 前端 (模糊自然语言指令)
    │
    ▼
┌──────────────────────────────────────┐
│  环境上下文收集层 (Context Collector) │  ← 系统状态、设备列表、用户偏好、时间、历史
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Claude Code (唯一大脑 / Orchestrator)│  ← LLM 推理 + 决策，输出 JSON 动作序列
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  动作解析执行层 (Action Executor)     │  ← 解析 JSON → 依次调用具体服务
└──────────────────┬───────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
     Music API   TTS API    UPnP API
```

### 分层职责

| 层 | 职责 | 决策者 |
|---|---|---|
| **Context Collector** | 收集当前环境快照：设备状态、播放队列、时间、用户偏好、网络设备 | 代码 |
| **Orchestrator** | 理解意图、拆解步骤、决定调什么 API、传什么参数 | **Claude Code (仅此一家)** |
| **Action Executor** | 执行 JSON 动作（play/stop/next/say/volume_up...），返回结果 | 代码 |
| **Service Adapters** | 对接具体服务的 SDK/HTTP API（Music、TTS、UPnP） | 代码 |

### Claude 动作格式

所有 Claude 输出必须是结构化 JSON，格式示例：

```json
{
  "thought": "用户说晚安，环境检测到22点、卧室灯亮着、当前静音。决定: 关灯 + 播放下雨白噪音。",
  "actions": [
    { "service": "upnp", "action": "set_power", "params": { "device": "bedroom_light", "on": false } },
    { "service": "music", "action": "play", "params": { "uri": "rain_white_noise", "volume": 30 } }
  ]
}
```

关键字段：
- `thought`: Claude 的推理过程（可审计/可调试）
- `actions[]`: 有序动作列表（顺序执行）
- 每个 `action`: `service` + `action` + `params`

## 开发命令

（待项目定型后补充）

## 技术栈

（待定，推荐方向）
- 后端: Python (FastAPI) 或 Node.js
- Claude 集成: Claude Code CLI 调用 或 Anthropic SDK
- 上下文收集: 系统命令 + 状态轮询
- 服务对接: 各服务 SDK / REST API

## 设计约束

1. **模块严格解耦**: Context Collector、Orchestrator、Action Executor 之间仅通过结构化数据通信，不共享内部状态。
2. **无硬编码意图**: 代码中不允许出现 if/switch 匹配用户意图的逻辑。意图理解是 Claude 的专属职责。
3. **Claude 输出即可执行**: 所有 Claude 返回的 JSON 动作必须能被 Action Executor 直接消费，不需要二次 LLM 调用或复杂转换。
4. **可审计追踪**: 每次完整的 输入→Claude→动作 链路都应该记录日志，包含 Claude 的 thought 过程。
5. **幂等性优先**: 每个动作应该是幂等的或至少可安全重试的。
6. **Context 收集先行**: 在调用 Claude 之前，必须收集尽可能多的上下文信息，让 Claude 做充分知情的决策。
