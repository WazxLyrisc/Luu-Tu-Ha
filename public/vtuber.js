// Nhân vật Vtuber: hiển thị model Live2D, đổi biểu cảm theo cảm xúc, nhép miệng khi nói.
// Nếu model không tải được, trang vẫn chạy bình thường (chỉ hiện ảnh đại diện).
(() => {
  const cfg = window.VTUBER_CONFIG || {};
  const $ = id => document.getElementById(id);
  const stageEl = $("stage"), canvas = $("vtuber-canvas"), loadingEl = $("stage-loading");
  const fallbackEl = $("stage-fallback"), chip = $("stage-chip"), voiceBtn = $("voice-btn");

  let app = null, model = null;
  let voiceOn = false;
  let ttsSpeaking = false;
  let talkUntil = 0;      // thời điểm kết thúc nhép miệng khi không bật giọng
  let mouth = 0;

  try { voiceOn = localStorage.getItem("vtuber-voice") === "1"; } catch {}

  function setChip(text) {
    chip.textContent = text;
    chip.hidden = !text;
  }

  // ---------- Giọng nói (Web Speech API của trình duyệt) ----------
  const hasTTS = "speechSynthesis" in window;
  function pickVoice(lang) {
    const base = lang.split("-")[0].toLowerCase();
    const list = speechSynthesis.getVoices();
    return list.find(v => v.lang.toLowerCase() === lang.toLowerCase())
        || list.find(v => v.lang.toLowerCase().startsWith(base));
  }
  function renderVoiceBtn() {
    voiceBtn.setAttribute("aria-pressed", String(voiceOn));
    voiceBtn.textContent = voiceOn ? "Giọng nói: bật" : "Giọng nói: tắt";
  }
  voiceBtn.addEventListener("click", () => {
    voiceOn = !voiceOn;
    try { localStorage.setItem("vtuber-voice", voiceOn ? "1" : "0"); } catch {}
    if (!voiceOn && hasTTS) speechSynthesis.cancel();
    if (voiceOn && !hasTTS) { voiceOn = false; setChip("Trình duyệt này không hỗ trợ giọng nói"); }
    renderVoiceBtn();
  });
  renderVoiceBtn();

  function speak(text) {
    if (!voiceOn || !hasTTS) return false;
    speechSynthesis.cancel();
    const clean = text
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}️]/gu, "")
      .replace(/[*_`#>~]/g, "")
      .trim();
    if (!clean) return false;
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = cfg.voice?.lang || "vi-VN";
    u.rate = cfg.voice?.rate || 1;
    u.pitch = cfg.voice?.pitch || 1;
    const v = pickVoice(u.lang);
    if (v) u.voice = v;
    u.onstart = () => { ttsSpeaking = true; setChip("đang nói..."); };
    u.onend = u.onerror = () => { ttsSpeaking = false; setChip(""); };
    speechSynthesis.speak(u);
    return true;
  }

  // ---------- Model Live2D ----------
  function layout() {
    if (!app || !model) return;
    const W = app.screen.width, H = app.screen.height;
    if (!W || !H) return;
    model.scale.set(1);
    const fit = Math.min(W / model.width, H / model.height);
    model.scale.set(fit * (cfg.zoom || 1));
    model.anchor.set(0.5, 0);
    model.position.set(W / 2 + (cfg.offsetX || 0) * W, (cfg.offsetY || 0) * H);
  }

  function applyEmotion(name) {
    if (!model) return;
    const e = cfg.emotions?.[name] || cfg.emotions?.neutral;
    if (!e) return;
    try {
      if (e.expression !== undefined) Promise.resolve(model.expression(e.expression)).catch(() => {});
      if (e.motion) Promise.resolve(model.motion(e.motion.group, e.motion.index)).catch(() => {});
    } catch {}
  }

  async function init() {
    if (!window.PIXI || !PIXI.live2d) throw new Error("Không tải được thư viện PixiJS / pixi-live2d-display");
    if (!window.Live2DCubismCore) throw new Error("Không tải được Live2D Cubism Core");
    try { PIXI.live2d.config.sound = false; } catch {}   // không phát tiếng có sẵn trong model

    app = new PIXI.Application({
      view: canvas,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      resizeTo: stageEl
    });
    model = await PIXI.live2d.Live2DModel.from(cfg.modelUrl);
    app.stage.addChild(model);
    layout();

    // Nhép miệng: ghi đè tham số mở miệng ở cuối mỗi khung hình
    const core = model.internalModel.coreModel;
    const mouthId = cfg.mouthParam || "ParamMouthOpenY";
    model.internalModel.on("beforeModelUpdate", () => {
      const now = performance.now();
      const talking = ttsSpeaking || now < talkUntil;
      const target = talking
        ? 0.18 + 0.55 * Math.abs(Math.sin(now / 85)) * (0.65 + 0.35 * Math.sin(now / 230))
        : 0;
      mouth += (target - mouth) * 0.35;
      core.setParameterValueById(mouthId, mouth);
    });

    // Chạm vào nhân vật thì có phản ứng
    model.on("hit", () => {
      if (cfg.tapMotionGroup) Promise.resolve(model.motion(cfg.tapMotionGroup)).catch(() => {});
    });

    // Ánh mắt và đầu nhìn theo con trỏ chuột trên toàn trang
    window.addEventListener("pointermove", ev => {
      const r = canvas.getBoundingClientRect();
      model.focus(ev.clientX - r.left, ev.clientY - r.top);
    });

    new ResizeObserver(() => { app.resize(); layout(); }).observe(stageEl);
    loadingEl.hidden = true;
    api.ready = true;
    applyEmotion("neutral");
  }

  // ---------- API cho script.js ----------
  const api = {
    ready: false,
    get model() { return model; },   // để gỡ lỗi trong console: vtuber.model
    thinking(on) {
      if (on) { applyEmotion("think"); setChip("đang nghĩ..."); }
      else if (!ttsSpeaking) setChip("");
    },
    react(emotion, text) {
      applyEmotion(emotion);
      const spoke = speak(text || "");
      if (!spoke && text) {
        talkUntil = performance.now() + Math.min(Math.max((text || "").length * 55, 900), 5000);
      }
    }
  };
  window.vtuber = api;

  init().catch(err => {
    console.warn("[vtuber]", err.message || err);
    loadingEl.hidden = true;
    canvas.hidden = true;
    fallbackEl.hidden = false;
    setChip("Chưa tải được nhân vật, chatbot vẫn dùng bình thường");
  });
})();
