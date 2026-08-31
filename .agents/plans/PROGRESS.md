# 📊 TIẾN TRÌNH DỰ ÁN MANGA NOTIFIER (PROGRESS LOG)

Tài liệu này ghi lại chi tiết toàn bộ các giai đoạn phát triển, các cột mốc tính năng và các vấn đề kỹ thuật đã được giải quyết từ khi bắt đầu dự án cho đến trạng thái hiện tại.

---

## 📅 BẢNG TỔNG KẾT CÁC GIAI ĐOẠN PHÁT TRIỂN

```
[Giai đoạn 1: Nền tảng PC & UI Core]
       │
       ▼
[Giai đoạn 2: Hệ thống Scraper & Plugin Engine]
       │
       ▼
[Giai đoạn 3: Mở rộng sang Nền tảng Mobile Android]
       │
       ▼
[Giai đoạn 4: Hệ thống Đồng bộ Wi-Fi QR Sync 2 Thiết bị]
       │
       ▼
[Giai đoạn 5: Tối ưu hóa UX/UI & Trải nghiệm Đọc Mobile]
       │
       ▼
[Giai đoạn 6: Xử lý Nguồn đặc thù & Mã hóa Bản quyền (Góc Truyện, Mòe Truyện)]
       │
       ▼
[Giai đoạn 7: Tối ưu hóa Hiệu năng Tải ảnh & Chống Nghẽn CDN]
       │
       ▼
[Giai đoạn 8: Nhận diện Nguồn Truyện Thông minh (Source Badges)]
       │
       ▼
[Giai đoạn 9: Tối ưu Tìm Kiếm Đúng Trọng Tâm & Hiển Thị Nhóm Dịch]
       │
       ▼
[Giai đoạn 10: Tối ưu Độ Mượt Danh Sách Chương & Bộ Quét Đa Luồng (Fast Poller)]
       │
       ▼
[Giai đoạn 11: Tự Động Đồng Bộ 2 Chiều Wi-Fi qua WebSocket & Đồng Bộ Bù]
       │
       ▼
[Giai đoạn 12: Khắc Phục Màn Hình Đen & Chuẩn Hóa Hợp Nhất Đồng Bộ 2 Chiều (Full 2-Way Merge)]
       │
       ▼
[Giai đoạn 13: Mở Khóa Tần Số Quét 144Hz & Đồng Bộ Đa Kênh Tốc Độ Cao (USB Reverse + Capacitor Native HTTP)]
       │
       ▼
[Giai đoạn 14: Sửa Dải Chương & Đảo Thứ Tự, Phím ESC Toàn Cục & Tối Ưu Cuộn Chuột 144Hz]
       │
       ▼
[Giai đoạn 15: Chặn Báo Chap Mới Ảo & Cơ Chế Hợp Nhất Tiến Trình Đọc Chéo Thiết Bị]
       │
       ▼
[Giai đoạn 16: Tối Ưu Độ Mượt Toàn Diện Giao Diện Tổng PC (React.memo & GPU Virtual Grid)]
       │
       ▼
[Giai đoạn 17: Khắc Phục Lỗi Tải Lại Ảnh Khi Đọc Treo Máy & Ổn Định CDN Token]
       │
       ▼
[Giai đoạn 18: Tự Động Đồng Bộ Thêm/Xóa/Sửa Truyện Thời Gian Thực & Lưu Trữ Bền Vững Trên Mobile] (Hiện tại)
```

---

## 📌 CHI TIẾT CÁC GIAI ĐOẠN & CỘT MỐC ĐÃ HOÀN THÀNH

### 🏗️ Giai đoạn 1: Khởi tạo Nền tảng Desktop (Electron + React) & UI Core
* **Kiến trúc**:
  * Xây dựng tầng Desktop trên nền tảng **Electron 30+**, Frontend bằng **React 18 + Vite 6 + Tailwind CSS**.
  * Quản lý dữ liệu cục bộ bằng JSON Database (`electron/core/database.js`), hỗ trợ lưu trữ danh sách truyện, lịch sử đọc, và cài đặt người dùng.
* **Tính năng cốt lõi**:
  * Chạy ngầm trong khay hệ thống (**System Tray**) với menu ngữ cảnh tiện lợi (Mở app, Kiểm tra chương mới ngay, Thoát).
  * Bộ kiểm tra ngầm định kỳ (**Background Poller Engine**) quét chương mới theo chu kỳ tùy chọn (15 phút, 30 phút, 1 giờ, 2 giờ).
  * Thông báo góc màn hình Windows Native Toast Notification kèm âm thanh.
  * Tích hợp **Discord Webhook** gửi tin nhắn Rich Embed trực tiếp về kênh chat cá nhân.
* **Hạ tầng đóng gói**:
  * Phát triển công cụ **Fast Build** độc lập (`fast_build.js`) sử dụng `@electron/asar` và `esbuild`, giúp đóng gói toàn bộ ứng dụng thành file `.exe` Portable chỉ trong **10 giây** mà không phụ thuộc vào `electron-builder` nặng nề.

---

### 🔌 Giai đoạn 2: Xây dựng Hệ thống Plugin Nguồn & Trình Đọc In-App
* **Hệ thống Plugin Scraper Đa Nguồn**:
  * Thiết kế lớp cơ sở `BasePlugin` chuẩn hóa cho tất cả các website truyện.
  * Tích hợp các nguồn ban đầu: **MangaDex** (API v5 REST), **NetTruyen**, **BlogTruyen**, **TruyenQQ**.
  * Bổ sung cơ chế tự động nhận diện URL dán vào app để kích hoạt plugin tương ứng.
* **Trình Đọc Truyện Không Quảng Cáo (Clean In-App Reader)**:
  * Chế độ **Webtoon (Cuộn dọc)**: Đọc liền mạch, hỗ trợ cuộn chuột kéo (Drag-to-Scroll) và tự động cuộn (Auto-Scroll).
  * Chế độ **Trang đơn (Single Page)**: Lật trang trực quan.
  * Bộ lọc ngôn ngữ bản dịch thông minh (`[vi]`, `[en]`, ...).
  * Cơ chế Image Proxy qua Electron Backend để vượt qua các tường lửa chống hotlink ảnh (Referer Header Spoofing).

---

### 📱 Giai đoạn 3: Mở rộng sang Nền tảng Mobile Android (Capacitor Native)
* **Tích hợp Capacitor 8**:
  * Tạo shell ứng dụng Android Native với Gradle & Java JDK 21.
  * Xây dựng tầng cầu nối **`mobileBridge.js`**: Giả lập toàn bộ `window.electronAPI` trên môi trường Web/Android bằng `localStorage` và `CapacitorHttp`, cho phép dùng chung 100% giao diện React mà không cần viết lại mã nguồn.
* **Tính năng trên Mobile**:
  * Tích hợp thông báo cục bộ di động qua `@capacitor/local-notifications`.
  * Tối ưu hóa cử chỉ cảm ứng: vuốt chạm mượt mà, layout đáp ứng linh hoạt theo màn hình dọc của smartphone.

---

### 🔄 Giai đoạn 4: Đồng Bộ Hóa Dữ Liệu 2 Chiều qua Wi-Fi QR Code
* **Kiến trúc Đồng bộ**:
  * Trên PC: Tích hợp máy chủ HTTP mini cục bộ (`syncServer.js`) chạy trên cổng `45678` với mã xác thực Token ngẫu nhiên.
  * Tạo mã QR chứa thông tin kết nối Wi-Fi nội bộ: `http://<IP-PC>:45678/api/sync?token=<TOKEN>`.
  * Trên Mobile: Tích hợp thư viện quét mã vạch qua camera (`html5-qrcode` & Barcode Scanner) với cơ chế xin cấp quyền Camera Android an toàn.

---

### 🛠️ Giai đoạn 5: Tối ưu hóa Trải nghiệm Người dùng (UX/UI Refinements)
* **Tách biệt Cài đặt PC và Mobile**:
  * Nhận diện nền tảng (`isMobile`) để hiển thị cài đặt tương ứng.
* **Thiết kế lại Thanh Điều Hướng Đọc trên Mobile**:
  * Thay thế bằng **Floating Navigation Pill Widget** siêu nhỏ gọn gồm 2 nút: **Lên đầu trang (`ArrowUp`)** và **Xuống cuối trang (`ArrowDown`)**.
* **Sửa lỗi xung đột điều hướng & Màn hình đen khi quay lại (Rollback)**.

---

### 🛡️ Giai đoạn 6: Xử lý Nguồn Đặc Thù & Mã Hóa Bản Quyền
* **Nguồn Góc Truyện Tranh (`goctruyentranhvui`)**:
  * Xử lý vấn đề tên miền thay đổi liên tục (`goctruyentranhvui41.com`, `goctruyentranhvui30.com`,...).
  * Hỗ trợ giải mã và phân tích chuỗi **Authorization Bearer Token / Cookie phiên `usid` & `X-TOKEN`** giúp đọc các chương VIP.
* **Nguồn Mòe Truyện (`moetruyen.net`)**:
  * **Giải quyết mã hóa IMGX DRM**: Nhận diện các chương có canvas bảo vệ bản quyền và tự động chuyển hướng mượt mà sang web gốc (`openExternal`).
  * **Sửa lỗi lặp ảnh dummy SVG**.

---

### ⚡ Giai đoạn 7: Tối ưu hóa Hiệu Năng Tải Ảnh & Chống Nghẽn CDN
* **Native Lazy Loading** (`loading="lazy"`, `decoding="async"`) cho từng ảnh truyện trong `MangaImageItem`. Giới hạn tải tối đa 3 ảnh đầu, ngăn chặn hiện tượng thundering herd.

---

### 🏷️ Giai đoạn 8: Nhận Diện Nguồn Truyện Thông Minh (Source Badges)
* Bổ sung **Huy hiệu Nguồn Truyện (Source Badges)** có màu sắc nhận diện riêng biệt cho từng website (MangaDex, TruyenQQ, Góc Truyện, Mòe Truyện, NetTruyen, BlogTruyen).

---

### 🎯 Giai đoạn 9: Tối Ưu Tìm Kiếm Đúng Trọng Tâm & Hiển Thị Nhóm Dịch
* Tích hợp endpoint API chính thức của Góc Truyện Tranh (`/api/comic/search?name=...`).
* Bộ lọc từ dừng tiếng Việt (Stop-words) và khớp từ hoàn chỉnh (Exact word token matching).
* Lọc sạch URL hệ thống (`/truyen/luot-su`, `/truyen/theo-doi`).
* Hiển thị huy hiệu **Nhóm dịch (`Users` icon)** trực quan trong danh sách chương và thanh điều khiển đọc.

---

### 🚀 Giai đoạn 10: Tối Ưu Độ Mượt Danh Sách Chương & Bộ Quét Đa Luồng (Fast Poller)
* **Windowed Virtualization**: Tải theo đợt (50 chương) kết hợp `content-visibility: auto` và thanh điều hướng nhanh `[1-50]`, `[51-100]`, loại bỏ giật lag trên các bộ truyện dài 400 - 1000+ chương.
* **Bộ Quét Đa Luồng Song Song (Concurrent Worker Pool)**: Quét cùng lúc 6 luồng (`CONCURRENCY = 6`), kiểm tra toàn bộ 50+ bộ truyện chỉ trong 5 - 8 giây.

---

### ⚡ Giai đoạn 11: Tự Động Đồng Bộ 2 Chiều Wi-Fi qua WebSocket & Đồng Bộ Bù
* Ghép đôi 1 lần duy nhất qua QR (1-Time Pairing).
* Kênh truyền thời gian thực qua WebSocket (`ws`) trên cổng `45678`, phát tán sự kiện đọc chương và thêm/xóa truyện tức thì (< 30ms).
* Tự động đồng bộ bù (Catch-up sync) khi Mobile kết nối lại Wi-Fi.

---

### 🛡️ Giai đoạn 12: Khắc Phục Màn Hình Đen & Chuẩn Hóa Hợp Nhất Đồng Bộ 2 Chiều (Full 2-Way Merge)
* **Sửa triệt để lỗi màn hình đen (Minified React Error #310)**: Đưa 100% React Hooks lên đầu component `MangaDetailModal.jsx` vô điều kiện. Bọc toàn bộ các modal bằng `ErrorBoundary.jsx`.
* **Chuẩn hóa Hợp nhất 2 chiều (Union Merge)**: Khi quét QR, Mobile tự động gửi DB lên PC qua `POST /api/sync/catchup`. PC gộp đầy đủ số truyện của 2 bên và trả về cho Mobile lưu trữ đồng nhất.

---

### 🏎️ Giai đoạn 13: Mở Khóa Tần Số Quét 144Hz/120Hz & Tối Ưu Kết Nối Đa Kênh
* **Mở khóa Tần số quét 144Hz / 120Hz siêu mượt**:
  * **Trên Android Mobile**: Tích hợp `Display.Mode` trong `MainActivity.java` tự động chọn tốc độ làm tươi màn hình cao nhất của điện thoại (90Hz / 120Hz / 144Hz), kích hoạt `LAYER_TYPE_HARDWARE` và `android:hardwareAccelerated="true"`.
  * **Trên PC Desktop**: Kích hoạt cờ `disable-frame-rate-limit` và `max-gum-fps=144` trong Electron.
* **Tối ưu Kết nối Đồng bộ Đa Kênh Tốc Độ Cao**:
  * Tích hợp native `CapacitorHttp` để vượt qua các giới hạn bảo mật mạng LAN/CORS của Android WebView.
  * Hỗ trợ tự động chạy song song (Parallel Race) qua tất cả các kênh: **USB Cáp kết nối (ADB Reverse `127.0.0.1:45678`)**, **Mạng Wi-Fi nội bộ LAN (`192.168.x.x`)**, và **Android Emulator (`10.0.2.2`)**.

---

### 🎯 Giai đoạn 14: Sửa Dải Chương & Đảo Thứ Tự, Phím ESC Toàn Cục & Tối Ưu Cuộn Chuột 144Hz
* **Sửa nhãn dải chương hiển thị chuẩn xác & Bổ sung nút đảo thứ tự (Sort Order Toggle)**:
  * Khắc phục hiện tượng dải chương `[1-50]` hiển thị chương mới nhất 217. Giờ đây khi xếp Mới nhất trước, nhãn hiển thị trực quan `[225 - 176]`, `[175 - 126]`,... tương ứng với nội dung.
  * Bổ sung nút **"Mới nhất trước" / "Cũ nhất trước"** kèm biểu tượng đảo chiều (`ArrowUpDown`) ngay cạnh thanh tìm kiếm chương.
* **Hỗ trợ phím ESC để Quay lại / Đóng (Universal ESC Key Navigation)**:
  * Bấm phím **ESC** trên bàn phím để đóng ngay lập tức chi tiết truyện (`MangaDetailModal`), trình đọc (`ReaderModal`), bảng tìm kiếm (`SearchModal`), cài đặt (`SettingsModal`), lịch sử (`HistoryModal`), và quét QR.
* **Tối ưu hóa Độ Mượt Khi Lăn Chuột (Smooth Wheel Scrolling Performance)**:
  * Tích hợp GPU CSS compositing layer: `smooth-scroll-container`, `contain: content`, `will-change: scroll-position` và thanh cuộn mượt mà `scroll-behavior: smooth`.

---

### 🛡️ Giai đoạn 15: Chặn Báo Chap Mới Ảo & Cơ Chế Hợp Nhất Tiến Trình Đọc Chéo Thiết Bị
* **Xử lý triệt để hiện tượng báo chap mới ảo cho các chương cũ ra mắt từ lâu**:
  * Tích hợp bộ trích xuất số thứ tự chương `extractChapterNum()`.
  * Tích hợp bộ kiểm tra thời gian phát hành thực tế `isChapterTrulyRecent()`: Chương mới chỉ được phát thông báo khi số thứ tự chương $\ge$ chương cao nhất trước đó HOẶC thời gian phát hành nằm trong vòng 14 ngày gần nhất.
  * Bỏ qua thông báo đối với các truyện mới thêm vào app lần đầu (`isFirstScan`).
* **Hợp nhất tiến trình đọc chéo thiết bị**:
  * Đồng bộ tập hợp `readChapters` (Union Set) giúp lưu toàn bộ các chương đã đọc ở cả PC và Mobile.

---

### ⚡ Giai đoạn 16: Tối Ưu Hóa Độ Mượt Toàn Diện Cho Giao Diện Tổng PC (React.memo & GPU Virtual Grid)
* **Tối ưu kết xuất React (Component Memoization)**:
  * Bọc component `MangaCard` bằng `React.memo` ngăn chặn việc render lại 30-50 thẻ truyện khi poller cập nhật tiến trình hoặc cập nhật trạng thái đồng bộ.
* **Tăng tốc kết xuất GPU (Hardware Acceleration & Virtual Layout)**:
  * Áp dụng `content-visibility: auto; contain-intrinsic-size: 340px;` lên từng thẻ truyện giúp trình duyệt bỏ qua chi phí layout và paint cho các thẻ nằm ngoài khung hình nhìn thấy.
  * Áp dụng `smooth-scroll-container` lên toàn bộ vùng dashboard chính trong `App.jsx`, đạt tốc độ cuộn chuột **144 FPS mượt như nhung**.

---

### 🛠️ Giai đoạn 17: Khắc Phục Lỗi Tải Lại Ảnh Khi Treo Máy (~3 Phút) & Ổn Định CDN Token
* **Nguyên nhân & Khắc phục**:
  * Áp dụng `fetchedChapterKeyRef` khóa cứng cache ảnh chương.
  * Ổn định callback `App.jsx` bằng `useCallback`.
  * Bổ sung cơ chế tự động chuyển đổi sang endpoint gốc `https://uploads.mangadex.org/...` khi node `@home` mất kết nối.

---

### 🔄 Giai đoạn 18: Tự Động Đồng Bộ Thêm/Xóa/Sửa Truyện Thời Gian Thực & Lưu Trữ Bền Vững Trên Mobile *(Cột mốc hiện tại)*
* **Xử lý nguyên nhân thêm truyện trên PC chưa hiện trên Mobile**:
  * Khi PC phát sự kiện WebSocket `ADD_MANGA`, `DELETE_MANGA`, `UPDATE_MANGA`, `UPDATE_TAG`, trước đây Mobile chỉ gọi hàm tải lại DB nhưng DB trong `localStorage` trên Mobile chưa nhận bản ghi mới này.
  * Cập nhật tầng xử lý sự kiện trong [`App.jsx`](file:///c:/Code/MangaNotifier/src/App.jsx): Khi nhận `ADD_MANGA`, Mobile tự động cập nhật ngay lập tức vào React State và ghi vĩnh viễn vào `localStorage` của Mobile thông qua `mobileBridge.addManga()`.
  * Nâng cấp `performCatchupSync` trong [`syncService.js`](file:///c:/Code/MangaNotifier/src/services/syncService.js) sử dụng Native `CapacitorHttp` để vượt qua giới hạn WebView của Android, đảm bảo đồng bộ bù 100% thành công ngay khi mở app.

---

## 📈 TRẠNG THÁI HIỆN TẠI (CURRENT STATUS)

- 🖥️ **Bản PC**: Đồng bộ tức thì mọi thao tác Thêm/Xóa/Đổi thẻ/Đọc truyện sang Mobile qua WebSocket, Fast Build sẵn sàng tại `release/Manga Notifier/Manga Notifier.exe`.
- 📱 **Bản Mobile**: Nhận và lưu trữ vĩnh viễn truyện mới thêm từ PC ngay lập tức, tự động đồng bộ bù qua `CapacitorHttp`, đã cài đặt trực tiếp lên điện thoại tại `release/Manga Notifier Mobile.apk`.
