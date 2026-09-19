# Memory Enhancement Spec - 8 Features
# 核心：增强记忆库（db.memories），面板只是展示

## 架构
```
所有软件（群像/想见你/微信/X/朋友圈/短信/自动朋友圈）
    ↓ 写入
记忆库增强层（memory.js新增函数）
    ↓ 存储
db.memories（核心数据库）
    ↓ 读取
所有软件的system prompt注入 + 记忆面板展示
```

## Feature 1: 情感坐标（Emotional Coordinates）
**改什么**: memory.js的normalizeMemory()和getDecayScore()
**怎么做**:
- valence: -1(负面)到1(正面)，默认0
- arousal: 0(平静)到1(强烈)，默认0.3
- 衰减公式: `decayRate = baseRate / (1 + arousal * 2)` → 情绪强的记忆衰减更慢
- 已有valence/arousal字段，只需在衰减计算中使用

## Feature 2: 浮现机制（Memory Surfacing）
**改什么**: memory.js的getMemoryContext()
**怎么做**:
- 评分: relevance(0.4) + recency(0.3) + importance(0.2) + emotion(0.1)
- 返回top 5-8条记忆，按分数排序
- 注入到system prompt作为"最近相关记忆"
- 所有软件调用getMemoryContext时自动生效

## Feature 3: 自动提取事实（Auto Fact Extraction）
**改什么**: memory.js，新增extractFacts()函数
**怎么做**:
- 每10条消息后自动触发
- 轻量prompt提取：{人物, 事件, 时间, 地点, 偏好变化}
- 存入db.memories，sourceType='auto_extract'
- 所有软件发消息时调用（群像/想见你/微信/X/朋友圈/短信）

## Feature 4: 时间感知（Time Awareness）
**改什么**: ensemble.js的buildGroupPrompt()，wechat.js的buildSystemPrompt()
**怎么做**:
- 每次对话开头注入: "现在是2026年9月19日下午4点30分"
- 注入上次聊天时间: "上次和XX聊天是2小时前"
- 新增getFormattedNow()和getTimeSinceLastChat(charId)辅助函数
- 所有软件的prompt都注入（群像/想见你/微信/朋友圈/短信）

## Feature 5: 聊天进度追踪（Conversation Progress）
**改什么**: memory.js，新增saveConversationProgress()和getConversationProgress()
**怎么做**:
- 对话结束时存入db.config: 'lastChatProgress_{charId}'
- 内容: {lastTopic, lastMessage, endedAt, summary}
- 新对话开始时注入: "上次你们聊到了XX，当时XX说了XX"
- 所有软件对话结束时保存，开始时读取

## Feature 6: 做梦消化（Dream Consolidation）
**改什么**: memory.js，新增dreamConsolidate()函数
**怎么做**:
- 每天凌晨自动运行（或手动触发）
- 读取最近48h的记忆，合并重复/相似的
- 更新db.memories中的记录
- 通过cron job或Service Worker触发

## Feature 7: 情绪感知（Emotion Detection）
**改什么**: memory.js，新增detectEmotion()函数
**怎么做**:
- 从用户消息中检测情绪关键词
- 存入记忆的valence/arousal字段
- 关键词库: 开心/难过/生气/害怕/惊讶/期待等
- 所有软件发消息时自动检测

## Feature 8: 记忆冲突解决（Conflict Resolution）
**改什么**: memory.js，新增resolveConflict()函数
**怎么做**:
- 新记忆写入时，检查是否有同主题旧记忆
- 如果矛盾：更新旧记忆，标记为"已更新"
- 如果补充：合并到旧记忆
- 用关键词+charId匹配

## 跨软件连接
每个软件都需要：
- **写入点**: 发消息时调用extractFacts() + detectEmotion() + saveProgress()
- **读取点**: 开始对话时调用getMemoryContext()（含浮现）+ getConversationProgress() + 时间注入

## 约束
- 不破坏现有功能
- 最少API调用（能前端算的前端算）
- 用现有db.memories表（不加新表）
- UI适配现有记忆面板样式