import "dotenv/config";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PERSONA } from "./persona.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { GEMINI_API_KEY, GEMINI_MODEL = "gemini-2.5-flash", PORT = 3000, DISCORD_WEBHOOK_URL, ADMIN_KEY } = process.env;
if (!GEMINI_API_KEY) { console.error("Thiếu GEMINI_API_KEY trong file .env"); process.exit(1); }

const app = express();
app.set("trust proxy", 1); // cần khi chạy sau proxy của Render
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
    // Thử model chính 2 lần, rồi chuyển sang model dự phòng nếu Google đang quá tải (503/429)
    const FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash-lite";
    const attempts = [GEMINI_MODEL, GEMINI_MODEL, FALLBACK, FALLBACK];
    let data, ok = false;
    for (let i = 0; i < attempts.length && !ok; i++) {
      if (i > 0) await new Promise(r => setTimeout(r, 800 * i));
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${attempts[i]}:generateContent`,
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
      data = await r.json();
      ok = r.ok;
      if (!ok) {
        console.error(`Lần ${i + 1} (${attempts[i]}):`, data?.error?.message);
        if (![429, 500, 503].includes(r.status)) break; // lỗi khác (sai key...) thì không thử lại
      }
    }
    if (!ok) throw new Error(data?.error?.message || "Gemini lỗi");
    const reply = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("");
    res.json({ reply: reply || "Ơ mình bị đứng hình chút, bạn nói lại được không?" });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Bot đang gặp sự cố, thử lại sau nhé." });
  }
});

app.post("/api/feedback", limiter, async (req, res) => {
  const { name = "", message = "", rating = 0 } = req.body;
  if (typeof message !== "string" || message.trim().length < 3) return res.status(400).json({ error: "Hãy viết nội dung phản hồi." });
  const entry = { time: new Date().toISOString(), name: String(name).slice(0, 60), rating: Number(rating) || 0, message: message.slice(0, 1500) };

  // 1) In ra log (xem được ở tab Logs của Render)
  console.log("FEEDBACK:", JSON.stringify(entry));

  // 2) Gửi về Discord của bạn (lưu lâu dài, có thông báo điện thoại)
  if (DISCORD_WEBHOOK_URL) {
    const stars = entry.rating ? "★".repeat(entry.rating) + "☆".repeat(5 - entry.rating) : "chưa chấm";
    fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**Phản hồi mới** từ ${entry.name || "ẩn danh"} (${stars})\n${entry.message}`.slice(0, 1900) })
    }).catch(e => console.error("Discord lỗi:", e.message));
  }

  // 3) Lưu file (trên Render miễn phí có thể mất khi server khởi động lại)
  try {
    const file = path.join(__dirname, "feedback.json");
    let list = [];
    try { list = JSON.parse(await fs.readFile(file, "utf8")); } catch {}
    list.push(entry);
    await fs.writeFile(file, JSON.stringify(list, null, 2));
  } catch (e) { console.error("Không lưu được file:", e.message); }

  res.json({ ok: true });
});

// Xem phản hồi: https://link-cua-ban.onrender.com/admin/feedback?key=ADMIN_KEY
app.get("/admin/feedback", async (req, res) => {
  if (!ADMIN_KEY || req.query.key !== ADMIN_KEY) return res.sendStatus(404);
  try { res.type("json").send(await fs.readFile(path.join(__dirname, "feedback.json"), "utf8")); }
  catch { res.json([]); }
});

app.listen(PORT, () => console.log(`Chạy tại http://localhost:${PORT}`));