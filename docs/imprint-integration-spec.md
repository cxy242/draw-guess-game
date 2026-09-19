# imprint-memory Integration Spec

## Goal
Integrate imprint-memory (https://github.com/Qizhan7/imprint-memory) as an enhancement layer on top of the existing memory system (db.memories + WanWanMemory). Do NOT replace the existing system.

## Architecture
```
Frontend (ensemble/miss-you/wechat/x-page)
    ↓ HTTP API calls
Node.js bridge (/opt/wanwan/server.js new routes)
    ↓ calls
imprint-memory Python HTTP server (port 8001)
    ↓ stores
SQLite database (/opt/wanwan/data/imprint-memory.db)
```

## What imprint-memory provides
1. **Hybrid search**: FTS5 + BM25 + vector embeddings + RRF fusion
2. **Auto-decay**: Memories naturally fade over time
3. **CJK support**: jieba tokenization for Chinese text
4. **Memory categories**: facts, events, insights
5. **Pin/tag/edge**: Memory organization features

## Integration Steps

### Step 1: Deploy imprint-memory
- Clone repo to /opt/imprint-memory/
- Install dependencies: `pip install -e .`
- Set env vars:
  - IMPRINT_HTTP_HOST=127.0.0.1
  - IMPRINT_HTTP_PORT=8001
  - EMBED_PROVIDER=google (or ollama for local)
  - GOOGLE_API_KEY=xxx (from existing config)
- Run as pm2 process: `pm2 start "python3 -m imprint_memory.server --http" --name imprint-memory`

### Step 2: Node.js API bridge
Add new routes to server.js:
- POST /api/memory/sync - Sync existing db.memories to imprint-memory
- POST /api/memory/enhanced-search - Search via imprint-memory
- POST /api/memory/auto-capture - Auto-capture a conversation turn

### Step 3: Dual-write on memory creation
In memory.js, after creating a new memory in db.memories:
- Also call POST /api/memory/sync to store in imprint-memory
- Keep existing flow unchanged

### Step 4: Enhanced retrieval
In memory.js getMemoryContext():
- First try imprint-memory search (POST /api/memory/enhanced-search)
- If imprint-memory is down, fallback to existing db.memories query
- Merge results and return

### Step 5: Auto-capture for ensemble/miss-you
In ensemble.js doSend() and miss-you send handler:
- After each message, call POST /api/memory/auto-capture
- This stores the message in imprint-memory's conversation log
- imprint-memory automatically chunks and indexes it

## Data Mapping
| Existing (db.memories) | imprint-memory |
|---|---|
| memory.title | memory content (first line) |
| memory.content | memory content (full) |
| memory.keywords | memory tags |
| memory.importance | memory importance (1-10) |
| memory.valence | memory valence (-1 to 1) |
| memory.arousal | memory arousal (0 to 1) |
| memory.charId | memory source (as tag) |
| memory.sourceType | memory category (facts/events/insights) |
| memory.createdAt | memory created_at |

## Files to modify
- /opt/wanwan/server.js - Add API bridge routes
- /opt/wanwan/js/memory.js - Add dual-write and enhanced retrieval
- /opt/wanwan/js/ensemble.js - Add auto-capture
- /opt/wanwan/js/miss-you.js - Add auto-capture (optional)

## Constraints
- Do NOT break existing functionality
- If imprint-memory is unavailable, everything must still work via db.memories
- All existing memories must be synced to imprint-memory on first run
- Chinese text must work (jieba tokenization)
- Keep API calls minimal (batch where possible)