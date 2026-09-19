# SMS Module Complete Rewrite - Final Spec

## Goal
Rewrite imessage.js + imessage.css to look EXACTLY like native Android SMS app. All functions must be connected to UI. No dead code.

## CRITICAL: UI must look like real Android SMS
- Background: #f5f5f5 (light gray)
- Top bar: white, with back arrow + contact name (bold) + virtual number (gray small text) + three-dot menu
- AI bubble: #e8e8e8 (muted gray), left aligned, rounded 18px
- User bubble: #5b8fb9 (muted blue), right aligned, rounded 18px
- Font: 14px, line-height 1.4
- Bubble max-width: 75%
- Time stamps: centered, gray, 11px
- Input bar: white background, gray input field + blue send button

## THREE PAGES (all must work)

### Page 1: SMS List Page
- Header: back arrow + phone number + new message button
- List of conversations: avatar + name + last message preview + time
- Pinned conversations at top
- Unread count badge
- Click conversation → open Page 1 (chat detail)

### Page 2: Chat Detail Page
- Header: back arrow + contact name + virtual number + three-dot menu button
- Messages: AI left gray, user right blue
- When revealed: show AI avatar before messages
- Input: + button + input field + send button
- AI button: magic wand for AI-generated reply

### Page 3: Three-Dot Menu (7 buttons, ALL functional)
1. 查看通知号 → popup showing virtual number
2. 置顶 → toggle pinned
3. 免打扰 → toggle muted
4. 移至消息 → category picker (normal/important/spam)
5. 加入黑名单 → toggle blocked
6. 删除 → confirm → delete conversation + messages
7. 解除匿名 → set revealed=true, show AI avatar

### Page 4: SMS Settings Popup
- Master toggle: 启用主动来信
- 允许联系人用小号试探
- 需有聊天记录
- 来信频率 (dropdown)
- 每人每日上限 (number input)
- 内容去重 (toggle)
- 联系人管理 (list with individual toggles)

### Page 5: New Message Page
- Input: "输入AI手机号..."
- Match to character → create conversation
- User sends anonymous message

## WORLD BOOK (inject before AI generates)
Full "匿名信箱" world book text (see imessage.js getAnonMailboxLore function)

## PERSONA REQUIREMENTS
1. AI reads user persona: db.characters(type='user')
2. AI matches own persona: char.description + char.personality
3. Memory context: WanWanMemory.getMemoryContext()
4. Time awareness: WanWanMemory.getFormattedNow()

## WECHAT BLOCK → SMS
- When user blocks AI on WeChat → start 5-minute timer
- After 5 minutes, if still blocked → AI sends SMS using real identity (not anonymous)
- Tone: concerned, missing user, 1-2 messages

## MEMORY INTEGRATION (same as all modules)
- WanWanMemory.getMemoryContext() for memory injection
- WanWanMemory.detectEmotion() on user messages
- WanWanMemory.saveConversationProgress() after conversations
- WanWanMemory.getFormattedNow() for time awareness

## DESIGN RULES (from design-aesthetic skill)
- Muted colors, monochromatic
- No emoji in UI (CSS only)
- Touch targets >= 44px
- Font min 14px
- Border radius consistent (12px or 18px)
- Shadows follow background tone
- Animation: max 300ms, ease-out only
- Cards have clear hierarchy

## AI MESSAGE GENERATION
- 3-5 messages per generation
- Each 20-40 chars, natural texting style
- 1-2s delay between messages
- Random virtual phone number: "0XX XXXX XXXX"
- World book + persona + memory + time all injected

## FILES
- js/imessage.js - COMPLETE REWRITE
- css/imessage.css - COMPLETE REWRITE
- js/wechat.js - Only add: window.startWechatBlockSmsTimer call after block action

## AFTER WRITING
1. node --check js/imessage.js
2. Check all functions are connected to UI (no dead code)
3. Check CSS classes match JS usage
4. Verify all 7 menu buttons work
5. Verify settings popup works
6. Verify new message flow works