const $ = id => document.getElementById(id);
const box = $("messages"), form = $("chat-form"), input = $("chat-input"), sendBtn = $("send-btn");
const history = []; // {role:'user'|'model', text}

function addMsg(text, who, extra = "") {
  const d = document.createElement("div");
  d.className = `msg ${who} ${extra}`.trim();
  d.textContent = text;
  box.appendChild(d); box.scrollTop = box.scrollHeight;
  return d;
}

addMsg("Ê chào nha! Mình là WazxLyrisc, hỏi gì cũng được 😄 hết nhé !", "bot");

form.addEventListener("submit", async e => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = ""; sendBtn.disabled = true;
  addMsg(text, "user"); history.push({ role: "user", text });
  const typing = addMsg("đang gõ...", "bot", "typing");
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ history }) });
    const data = await r.json();
    typing.remove();
    if (!r.ok) throw new Error(data.error || "Lỗi không xác định");
    addMsg(data.reply, "bot"); history.push({ role: "model", text: data.reply });
  } catch (err) {
    typing.remove(); history.pop(); addMsg("⚠️ " + err.message, "bot");
  } finally { sendBtn.disabled = false; input.focus(); }
});

// ---- Feedback ----
const row = $("star-row"), ratingEl = $("fb-rating");
for (let i = 1; i <= 5; i++) {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = "★"; b.setAttribute("aria-label", `${i} sao`);
  b.onclick = () => { ratingEl.value = i; [...row.children].forEach((c, k) => c.classList.toggle("on", k < i)); };
  row.appendChild(b);
}
$("fb-form").addEventListener("submit", async e => {
  e.preventDefault();
  const st = $("fb-status"); st.textContent = "Đang gửi...";
  try {
    const r = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: $("fb-name").value, rating: ratingEl.value, message: $("fb-msg").value }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error);
    st.textContent = "Đã gửi, cảm ơn bạn nhiều! 💜"; e.target.reset(); ratingEl.value = 0;
    [...row.children].forEach(c => c.classList.remove("on"));
  } catch (err) { st.textContent = "Gửi chưa được: " + (err.message || "thử lại sau nhé"); }
});
