# 关系网模块规范文档

## 概述
为月月机App创建一个"关系网"模块，让AI角色清楚认知自己与他人的关系。所有多人群聊、朋友圈、X软件、匿名短信等场景都必须参照关系网。

## 技术栈
- 力导向图：vasturiano/force-graph (Canvas, 触控, UMD单文件)
- 数据存储：Dexie IndexedDB (已有db.js)
- AI调用：window.callAI (已有)
- 无框架，纯JS

## 数据结构

### db.relationships 表 (db.js version 17)
```
db.relationships: '++id, charId, targetId, [charId+targetId], type, updatedAt'
```
- charId: 发起方角色ID (number)
- targetId: 目标角色ID或NPC名 (number or string)
- type: 关系类型 (string, 如"闺蜜""父亲""同事")
- desc: 关系描述 (string, 可选)
- affinity: 亲密度 0-100 (number, 默认50)
- source: 来源 'ai'|'manual'|'chat' (string)
- createdAt: 创建时间
- updatedAt: 更新时间

### NPC人物表 (非AI角色的独立人物)
```
db.npcCharacters: '++id, name, avatar, description, source, createdAt'
```
- name: 人名 (string, 如"小雨""王伟")
- avatar: 头像URL (string, 可选)
- description: 人物描述 (string)
- source: 来源 'persona'|'manual' (string)
- charId: 所属角色ID (number, 从谁的人设中提取的)

## 核心函数

### 1. 关系CRUD
```javascript
// 获取某角色的所有关系
async function getRelationships(charId) → [{id, charId, targetId, type, desc, affinity, targetName, targetAvatar}]

// 添加关系
async function addRelationship(charId, targetId, type, desc) → id

// 更新关系
async function updateRelationship(id, updates) → void

// 删除关系
async function deleteRelationship(id) → void

// 获取双向关系
async function getMutualRelationships(charId1, charId2) → [{from, to, type}]
```

### 2. AI生成关系网 (一次API调用)
```javascript
// 从角色人设中提取所有人物关系
async function extractRelationshipsFromPersona(char) → [{name, type, desc}]

// 为所有角色生成关系网 (定时任务用)
async function generateAllRelationships() → void
  - 遍历所有char类型角色
  - 构建prompt：所有人设+已有关系
  - 一次API调用生成所有关系
  - 保存到db.relationships和db.npcCharacters
```

### 3. 关系上下文注入 (全局)
```javascript
// 获取某角色的关系上下文文本，用于注入AI prompt
async function getRelationshipContext(charId) → string
  格式：
  "你的人际关系：
  - 小雨：你的闺蜜，亲密无话不谈
  - 王伟：你的同事，关系一般
  - 爸爸：你的父亲，又爱又怕"

// 获取与特定人物的关系描述
async function getRelationBetween(charId, targetNameOrId) → string|null
```

### 4. 图谱数据构建
```javascript
// 构建力导向图的nodes和links数据
async function buildGraphData(charId) → {nodes: [{id, name, avatar, type, affinity}], links: [{source, target, type, affinity}]}
  - 中心节点：charId角色（大节点）
  - 周围节点：所有关联人物
  - links：关系线，粗细=亲密度
```

### 5. 亲密度计算
```javascript
// 根据聊天记录自动更新亲密度
async function updateAffinityFromChat(charId, targetId) → void
  - 聊天消息数+1 → affinity +0.5
  - 最近7天无互动 → affinity -1
  - 范围限制 0-100
```

## 页面结构

### Page 1: 选择页
- 显示所有AI角色列表（头像+名字+关系数量）
- 点击某角色 → 进入该角色的关系图谱
- 底部按钮：AI一键生成、手动添加

### Page 2: 关系图谱页
- 力导向图，中心=选中角色
- 节点=头像图片(圆形)+名字(下方)
- 线条=关系线，粗细=亲密度
- 点击节点 → 弹出详情卡片
- 可拖拽、缩放

### Page 3: 人物详情卡 (弹窗)
- 头像、名字、关系类型、描述
- 亲密度数值+进度条
- 最近互动记录
- AI印象（如果已生成）
- 编辑/删除按钮

### Page 4: AI分析页
- AI人物印象
- 关系故事
- 兼容度分析
- 相处建议

### Page 5: 管理页
- 手动添加关系
- 编辑已有关系
- 删除关系
- 重新生成

## CSS规范 (我来写，但Codex需要知道)
- 亮色主题，白色背景
- 文字色#2f3136（深灰，不用纯黑）
- 圆角12px统一
- 阴影：0 1px 3px rgba(0,0,0,0.04)
- 字号最小14px
- 触摸目标最小44x44px
- CSS类名前缀：`rel-`（如rel-page, rel-graph, rel-card）

## 文件结构
- js/relationship.js — 主模块（IIFE，暴露window.RelationshipModule）
- css/relationship.css — 所有样式

## 集成点
- db.js — 加version 17（relationships + npcCharacters表）
- home.js — 桌面图标
- index.html — CSS+JS引入
- 所有模块的callAI — 加injectRelationships选项

## 关键约束
- 不要加暗色模式
- 不要用emoji
- 所有CSS用rel-前缀
- IIFE包try-catch
- force-graph用CDN引入或本地UMD文件
- 不要touch git
