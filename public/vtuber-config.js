// ====== CẤU HÌNH NHÂN VẬT VTUBER — sửa file này để đổi model / biểu cảm / giọng nói ======
window.VTUBER_CONFIG = {
  // Model Live2D (đuôi .model3.json). Mặc định dùng model mẫu "Haru" của Live2D để chạy thử.
  // Muốn dùng model của bạn: chép cả thư mục model vào public/models/ten-model/
  // rồi đổi thành: "models/ten-model/ten-model.model3.json"
  // modelUrl: "https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json",
  modelUrl: "RetrynowMiku/RetrynowMiku/VTS Model File/RetrynowMiku.model3.json",

  // Khung hình: zoom 1 = vừa khít cả người; >1 = phóng to (cắt bớt phần chân).
  // offsetX / offsetY: dịch ngang / dọc theo tỉ lệ của khung (vd -0.05 = dịch lên 5%).
  zoom: 3.0,
  offsetX: 0,
  offsetY: 0,

  // Gemini trả về một trong các cảm xúc này. Mỗi cảm xúc gắn với:
  //   expression: số thứ tự hoặc tên biểu cảm trong model
  //   motion: { group, index } cử động tay/đầu (tùy chọn)
  // (Các số dưới đây đã chỉnh cho model mẫu Haru. Đổi model thì mở thử từng biểu cảm
  //  bằng console: vtuber.model.expression(0), (1), (2)... rồi sửa số cho khớp.)
  emotions: {
    neutral:   { expression: 0 },                                   // cười nhẹ
    happy:     { expression: 4 },                                   // cười tít mắt
    sad:       { expression: 3 },                                   // buồn, hơi lo
    angry:     { expression: 7 },                                   // khoanh tay, nghiêm mặt
    surprised: { expression: 1, motion: { group: "Tap", index: 0 } }, // model mẫu không có mặt ngạc nhiên, nên dùng thêm cử động
    shy:       { expression: 6 },                                   // đỏ mặt
    think:     { expression: 2 }                                    // nhíu mày suy nghĩ
  },

  // Chạm vào nhân vật thì chạy cử động này (nhóm motion trong model)
  tapMotionGroup: "Tap",

  // Tham số mở miệng khi nói (hầu hết model Cubism 3/4 dùng tên này)
  mouthParam: "ParamMouthOpenY",

  // Giọng đọc của trình duyệt (miễn phí, không cần server). Cần máy có giọng tiếng Việt.
  voice: { lang: "vi-VN", rate: 1.0, pitch: 1.1 }
};
