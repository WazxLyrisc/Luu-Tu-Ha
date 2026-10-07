import "dotenv/config";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONA } from "./persona.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { GEMINI_API_KEY, GEMINI_MODEL = "gemini-3.5-flash-lite", PORT = 3000 } = process.env;
if (!GEMINI_API_KEY) { console.error("Thiếu GEMINI_API_KEY trong file .env"); process.exit(1); }

const app = express();
app.use(express.json({ limit: "50kb" }));
// Chrome DevTools tự dò file này; trả 204 để không báo 404
app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => res.sendStatus(204));
app.use(express.static(path.join(__dirname, "public")));

// Giới hạn đơn giản: 20 request/phút/IP để khỏi bị spam tốn quota
const hits = new Map();
const limiter = (req, res, next) => {
  const now = Date.now(), arr = (hits.get(req.ip) || []).filter(t => now - t < 60000);
  if (arr.length >= 20) return res.status(429).json({ error: "Gửi chậm lại một chút nha, thử lại sau ít giây." });
  arr.push(now); hits.set(req.ip, arr); next();
};

app.post("/api/chat", limiter, async (req, res) => {
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-20) : [];
  const contents = history
    .filter(m => (m.role === "user" || m.role === "model") && typeof m.text === "string")
    .map(m => ({ role: m.role, parts: [{ text: m.text.slice(0, 2000) }] }));
  if (!contents.length || contents.at(-1).role !== "user") return res.status(400).json({ error: "Tin nhắn trống." });

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PERSONA }] },
          contents,
          generationConfig: { temperature: 1.0, maxOutputTokens: 600 }
        })
      }
    );
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || "Gemini lỗi");
    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ;
    res.json({ reply: reply || "Ơ mình bị đứng hình chút, bạn nói lại được không?" });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "WazxLyrisc đang fix bug, thử lại lần nữa nhé ! " });
  }
});

app.post("/api/feedback", limiter, async (req, res) => {
  const { name = "", message = "", rating = 0 } = req.body;
  if (typeof message !== "string" || message.trim().length < 3) return res.status(400).json({ error: "Hãy viết nội dung phản hồi." });
  const file = path.join(__dirname, "feedback.json");
  let list = [];
  try { list = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
  list.push({ time: new Date().toISOString(), name: String(name).slice(0, 60), rating: Number(rating) || 0, message: message.slice(0, 1500) });
  await fs.writeFile(file, JSON.stringify(list, null, 2));
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Chạy tại http://localhost:${PORT}`));