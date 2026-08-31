# 📖 Manga Notifier (Cross-Platform PC & Mobile)

<p align="center">
  <img src="https://raw.githubusercontent.com/CattyGame/MangaNotifier/main/src/assets/logo.png" alt="Manga Notifier Banner" width="120" onerror="this.style.display='none'"/>
</p>

<p align="center">
  <strong>Ứng dụng theo dõi, nhận thông báo chương mới tức thời và đọc truyện tranh đa nền tảng (Windows PC & Android Mobile)</strong><br>
  Hoạt động mượt mà ở tần số quét <strong>144Hz / 144 FPS</strong>, không quảng cáo rác, đồng bộ 2 chiều thời gian thực qua Wi-Fi & USB.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Android-blue?style=for-the-badge&logo=windows" alt="Platform"/>
  <img src="https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react" alt="React"/>
  <img src="https://img.shields.io/badge/Electron-30.0-47848F?style=for-the-badge&logo=electron" alt="Electron"/>
  <img src="https://img.shields.io/badge/Capacitor-8.0-119EFF?style=for-the-badge&logo=capacitor" alt="Capacitor"/>
  <img src="https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css" alt="TailwindCSS"/>
</p>

---

## 🌟 Tính Năng Nổi Bật

### 1. 🔔 Hệ Thống Thông Báo Thông Minh & Bộ Quét Đa Luồng (Fast Poller Engine)
- **Windows Native Toast Notification**: Thông báo góc màn hình PC kèm ảnh bìa sắc nét, tên chương mới và nút bấm đọc ngay.
- **Android Local Notification**: Nhận thông báo đẩy cục bộ trực tiếp trên smartphone khi có chương mới.
- **Discord Webhook Integration**: Tự động gửi tin nhắn Rich Embed (kèm ảnh bìa, link đọc trực tiếp) vào kênh Discord cá nhân.
- **Bộ quét ngầm đa luồng song song (Concurrent Worker Pool)**: Quét cùng lúc 6 luồng (`CONCURRENCY = 6`), kiểm tra toàn bộ 50+ bộ truyện chỉ trong **5 - 8 giây**.
- **Chặn Báo Chương Mới Ảo (Smart Recency Filter)**:
  - Tự động trích xuất số thứ tự chương `extractChapterNum()` kết hợp kiểm tra thời gian phát hành thực tế `isChapterTrulyRecent()`.
  - Loại bỏ hoàn toàn tình trạng báo chương ảo khi các nhóm dịch re-upload lại các chương cũ từ nhiều năm trước.
- **Chạy ngầm khay hệ thống (System Tray)**: Tự động thu nhỏ về khay hệ thống, không chiếm dụng thanh Taskbar hay tài nguyên RAM/CPU.

---

### 2. 🔌 Hệ Thống Plugin Nguồn Phong Phú (Plugin Scraper Engine)
- **MangaDex**: Tích hợp API v5 REST chính thức, hỗ trợ lọc ngôn ngữ bản dịch (`[vi]`, `[en]`,...), cơ chế tự động chuyển đổi máy chủ CDN gốc (`https://uploads.mangadex.org/...`) khi node `@home` tạm đóng kết nối.
- **Góc Truyện Tranh (`goctruyentranhvui`)**: Tích hợp API tìm kiếm chính thức `/api/comic/search?name=...` tốc độ < 100ms; hỗ trợ xác thực tài khoản thành viên (**Authorization Token / Cookie `usid` & `X-TOKEN`**) để mở khóa các chương VIP / có phí.
- **TruyenQQ (`truyenqqto.com`)**: Tìm kiếm nhanh, tự động xử lý Referer Header chống chặn hotlink ảnh.
- **Mòe Truyện (`moetruyen.net`)**: Tự động nhận diện cơ chế bảo vệ bản quyền (**IMGX DRM**) và chuyển hướng mượt mà sang web gốc.
- **NetTruyen & BlogTruyen**: Tích hợp sẵn scraper ổn định, bóc tách link ảnh sạch.
- **Tìm kiếm chính xác tuyệt đối (Smart Relevance Ranker)**: Tự động loại bỏ từ dừng (stop-words), lọc sạch các URL hệ thống (`/truyen/luot-su`, `/truyen/theo-doi`), hiển thị **Huy hiệu nguồn truyện (Source Badges)** sắc nét.
- **Nhận diện Nhóm Dịch (Scanlation Groups)**: Hiển thị rõ ràng tên nhóm dịch / dịch giả cho từng chương truyện.

---

### 3. 📚 Trình Đọc Truyện In-App 144 FPS & Trải Nghiệm Không Quảng Cáo
- **Hoàn toàn sạch bóng quảng cáo**: Trải nghiệm đọc truyện mượt mà, tập trung tối đa vào nội dung.
- **Chống Reload / Chớp Nháy Khi Treo Máy (~3 Phút)**: Khóa cứng cache ảnh theo ID chương (`fetchedChapterKeyRef`), ngăn chặn việc re-fetch hoặc xóa trắng ảnh khi bộ quét ngầm hoạt động.
- **Chế độ Webtoon (Cuộn dọc liên tục)**:
  - **Native Lazy Loading** (`loading="lazy"`, `decoding="async"`) tải mượt từng trang ảnh ngoài luồng chính.
  - Tùy chỉnh độ rộng trang đọc (Zoom 50% - 200%).
  - Hỗ trợ Kéo chuột để cuộn (Drag-to-Scroll) và Tự động cuộn (Auto-Scroll) 3 cấp tốc độ với phím tắt `Space`.
  - Floating Navigation Pill Widget 2 nút (**Lên đầu trang / Xuống cuối trang**) tối ưu riêng cho thao tác một tay trên Mobile.
- **Chế độ Trang Đơn (Single Page)**: Lật trang trực quan bằng phím mũi tên `←` `→` hoặc vuốt chạm.
- **Danh sách chương Virtualized Grid**: Phân đoạn thông minh `[1-50]`, `[51-100]`, kết hợp nút đảo thứ tự (Mới nhất trước / Cũ nhất trước) và tìm kiếm chương tức thì.

---

### 4. ⚡ Tự Động Đồng Bộ 2 Chiều Thời Gian Thực (Hybrid 3-Tier Multi-Channel Sync)
- **Ghép đôi 1 lần duy nhất (1-Time QR Pairing)**: Quét QR một lần, thiết bị tự động lưu cấu hình vĩnh viễn và kết nối nền.
- **Đồng bộ thời gian thực qua WebSocket (`ws`)**: Đọc chương, đánh dấu đọc hoặc thêm/xóa truyện trên PC sẽ cập nhật ngay lập tức sang Mobile (< 30ms) và ngược lại.
- **Tự động Đồng bộ bù & Hợp nhất an toàn (2-Way Union Merge)**:
  - Gộp trọn vẹn danh sách truyện của cả 2 máy mà không bị mất dữ liệu.
  - Hợp nhất tập hợp các chương đã đọc (`readChapters`) và tự động chọn mốc đọc dở mới nhất.
- **Hỗ trợ kết nối đa kênh**: Tự động chạy đua kết nối song song qua **Wi-Fi LAN (`192.168.x.x`)**, **Cáp USB (`127.0.0.1:45678` qua ADB Reverse)** và **Capacitor Native HTTP**.

---

### 5. 🎮 Điều Khiển & Phím Tắt Tiện Lợi (Keyboard Shortcuts)
| Phím tắt | Thao tác |
| :--- | :--- |
| **`ESC`** | Đóng nhanh bất kỳ màn hình nào (Trình đọc, Chi tiết truyện, Tìm kiếm, Cài đặt, Lịch sử, Quét QR) |
| **`Space`** | Bật / Tắt chế độ Tự động cuộn xuống khi đọc truyện |
| **`+` / `-`** | Phóng to / Thu nhỏ độ rộng trang truyện khi đọc |
| **`0`** | Đặt lại tỉ lệ phóng to về 100% |
| **`F`** | Bật / Tắt chế độ Toàn màn hình (Fullscreen) |
| **`←` / `→`** | Chuyển trang trước / trang sau (Chế độ đọc từng trang) |

---

## 📂 Cấu Trúc Thư Mục Dự Án

```
MangaNotifier/
├── .agents/
│   ├── plans/               # Tiến trình phát triển (PROGRESS.md) & Kế hoạch tương lai (FUTURE_PLAN.md)
│   └── rules/               # Bộ quy tắc dự án (project_guidelines.md)
├── android/                 # Mã nguồn Android Native Shell (Capacitor 8 & Gradle JDK 21)
├── electron/                # Mã nguồn Electron Backend (Desktop Windows)
│   ├── core/                # JSON Database, Poller đa luồng, WebSocket Sync Server
│   ├── plugins/             # Scraper modules (MangaDex, Góc Truyện, TruyenQQ, MoeTruyen...)
│   ├── main.js              # Electron Main Process & IPC Handlers
│   └── preload.js           # Electron Context Bridge
├── release/                 # Thư mục xuất bản file thực thi (.exe cho PC, .apk cho Android)
├── src/                     # Mã nguồn Frontend React + Vite + Tailwind CSS
│   ├── components/          # ReaderModal, SearchModal, SettingsModal, MangaCard...
│   ├── services/            # syncService.js, mobileBridge.js, notificationService.js
│   ├── App.jsx              # Giao diện chính và luồng xử lý ứng dụng
│   └── index.css            # Hệ thống Design Tokens Anime Dark Theme & GPU Compositing
├── fast_build.js            # Tool đóng gói cực nhanh cho Desktop PC (.exe ASAR Package)
├── package.json             # Danh sách thư viện phụ thuộc & Scripts
└── vite.config.js           # Cấu hình đóng gói React Vite
```

---

## 🚀 Hướng Dẫn Cài Đặt & Biên Dịch

### 1. Yêu cầu môi trường
- **Node.js**: Phiên bản 18+ trở lên.
- **Java JDK**: JDK 21 (để biên dịch ứng dụng Android).
- **Android SDK & Platform Tools**: Để nạp và biên dịch file APK.

### 2. Cài đặt thư viện phụ thuộc
```bash
npm install
```

### 3. Khởi chạy môi trường phát triển (Development)
```bash
npm run dev
```

---

### 4. Đóng gói ứng dụng xuất bản (Production Build)

#### 🖥️ Đóng gói ứng dụng Desktop PC (.exe Portable)
```bash
node fast_build.js
```
> File thực thi được lưu tại: `release/Manga Notifier/Manga Notifier.exe` *(Sử dụng được ngay lập tức, không cần cài đặt).*

#### 📱 Biên dịch ứng dụng Android Mobile (.apk)
```bash
npm run build:react
npx cap sync
cd android && gradlew.bat assembleDebug
```
> File cài đặt Android được lưu tại: `android/app/build/outputs/apk/debug/app-debug.apk` *(hoặc `release/Manga Notifier Mobile.apk`).*

---

## 📝 Bản quyền & Giấy phép
Dự án được phát triển phục vụ mục đích cá nhân và phi thương mại.
Mọi nội dung truyện tranh thuộc bản quyền của tác giả và các nhóm dịch gốc.

## P.S
Đây là dự án cá nhân đầu tiên của mình nên vẫn sẽ nhiều bugs. Nên với dự án này, bất kì cũng có thể góp sức để cùng nhau phát triển và hoàn thiện hơn cho dự án này. Thank yous <3
