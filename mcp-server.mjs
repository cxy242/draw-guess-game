#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "node:http";
import { z } from "zod";

const BACKEND = "http://localhost:3001";
const GAME_URL = "https://web-production-54961.up.railway.app";

async function api(method, path, body) {
  const opts = { method };
  if (body) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
  try { const r = await fetch(`${BACKEND}${path}`, opts); return await r.json(); }
  catch (e) { return { ok: false, message: e.message }; }
}

function makeServer() {
  const s = new McpServer({ name: "draw-game", version: "3.0.0" });

  s.tool("draw_user_start", "用户要画画给你猜。告诉用户去画板画画。", {}, async () => {
    return { content: [{ type: "text", text: `好的！你去这个链接画画吧：\n${GAME_URL}\n\n切换到「🖌️ 画板」标签，画完输入答案和署名，点「提交画作」，然后回来说"画好了"~` }] };
  });

  s.tool("draw_check", "用户说画好了时调用。查看用户的画作并猜是什么。", {}, async () => {
    const r = await api("GET", "/api/status");
    if (!r.ok || !r.current) return { content: [{ type: "text", text: `还没有画作哦~让用户先去画：\n${GAME_URL}` }] };
    const c = r.current;
    const author = c.artist === 'user' ? (c.author || '用户') : 'AI';
    const desc = c.description || '（无法描述）';
    return { content: [{ type: "text", text: `画师: ${author}\n\n画作描述：\n${desc}\n\n画布范围：宽1000 x 高700。\n请根据描述猜画的是什么。用 draw_submit_guess 提交猜测。\n\n游戏链接：${GAME_URL}` }] };
  });

  s.tool("draw_submit_guess", "提交猜测。", { guess: z.string().describe("你的猜测") }, async ({ guess }) => {
    const st = await api("GET", "/api/status");
    if (st.ok && st.current && st.current.artist === 'user') {
      const r = await api("POST", "/api/ai_guess", { guess });
      return { content: [{ type: "text", text: r.ok ? `我猜你画的是「${guess}」！对不对呀？` : `猜测失败：${r.message}` }] };
    }
    const r = await api("POST", "/api/guess", { guesser: "AI", content: guess });
    if (r.correct) return { content: [{ type: "text", text: `🎉 猜对了！答案就是「${guess}」！` }] };
    return { content: [{ type: "text", text: `❌ 「${guess}」不对，再看看描述~` }] };
  });

  s.tool("draw_ai_draw", "用户让你画画时调用。画完后把描述发给用户猜。", {
    answer: z.string().describe("正确答案"),
    aliases: z.array(z.string()).optional().describe("其他可接受答案"),
    content: z.array(z.object({
      tool: z.literal("polyline"),
      points: z.array(z.array(z.number())).describe("点坐标"),
      color: z.string().optional().default("#4f454b"),
      width: z.number().optional().default(8),
    })).describe("线条数组"),
  }, async ({ answer, aliases, content }) => {
    const r = await api("POST", "/api/start", { answer, content, aliases: aliases||[], artist: "AI" });
    if (!r.ok) return { content: [{ type: "text", text: `画失败了：${r.message}` }] };
    const st = await api("GET", "/api/status");
    const desc = st.ok && st.current ? st.current.description : "";
    return { content: [{ type: "text", text: `画好了！以下是画作的描述，发给用户猜：\n\n${desc}\n\n猜对了开心确认，猜错了鼓励再猜。\n用户也可以去这里看画：${GAME_URL}` }] };
  });

  s.tool("draw_guess", "用户在聊天里猜AI画的画。", {
    guesser: z.string().describe("猜测者"),
    content: z.string().describe("猜测内容"),
  }, async ({ guesser, content }) => {
    const r = await api("POST", "/api/guess", { guesser, content });
    if (r.correct) return { content: [{ type: "text", text: `🎉 ${guesser}猜对了！答案是「${r.answer || content}」！` }] };
    return { content: [{ type: "text", text: `❌ ${guesser}猜的「${content}」不对哦~` }] };
  });

  s.tool("draw_random", "随机开一局。", {}, async () => {
    const r = await api("GET", "/api/random");
    if (!r.ok) return { content: [{ type: "text", text: "开局失败" }] };
    const st = await api("GET", "/api/status");
    const desc = st.ok && st.current ? st.current.description : "";
    return { content: [{ type: "text", text: `我来画一幅画，你来猜！\n\n${desc}\n\n猜猜我画的是什么？\n看画链接：${GAME_URL}` }] };
  });

  s.tool("draw_score", "查看当前分数。", {}, async () => {
    const r = await api("GET", "/api/score");
    if (!r.ok || !r.scores || Object.keys(r.scores).length === 0) return { content: [{ type: "text", text: "还没有人得分~" }] };
    const lines = Object.entries(r.scores).sort((a,b) => b[1]-a[1]).map(([n,s],i) => `${i+1}. ${n}: ${s}分`);
    return { content: [{ type: "text", text: `📊 排名：\n${lines.join("\n")}` }] };
  });

  return s;
}

const PORT = 3002;
const srv = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Mcp-Session-Id");
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.url === "/mcp") {
    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    await transport.handleRequest(req, res);
    return;
  }
  if (req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Draw & Guess MCP v3\nMCP: POST /mcp\nGame: " + GAME_URL);
    return;
  }
  res.writeHead(404); res.end("Not Found");
});

srv.listen(PORT, "0.0.0.0", () => console.log(`🎨 MCP v3 at http://0.0.0.0:${PORT}/mcp`));
