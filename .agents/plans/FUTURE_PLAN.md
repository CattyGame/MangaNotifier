# 🔮 KẾ HOẠCH PHÁT TRIỂN TƯƠNG LAI (FUTURE PLAN & ROADMAP)

Tài liệu này vạch ra lộ trình kỹ thuật, các tính năng mới và các cải tiến kiến trúc dự kiến sẽ được triển khai cho ứng dụng **Manga Notifier** trong các giai đoạn tiếp theo.

---

## 🎯 CÁC MỤC TIÊU CHIẾN LƯỢC

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      LỘ TRÌNH PHÁT TRIỂN TIẾP THEO                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  [Hạng mục 1: Đồng bộ Đám mây Mọi lúc Mọi nơi (Cloud Sync - Firebase)]  │
│                                    │                                    │
│  [Hạng mục 2: Tải Truyện Đọc Ngoại Tuyến (Offline Chapter Downloader)]  │
│                                    │                                    │
│  [Hạng mục 3: Mở rộng Nguồn Truyện & Tự động Cập nhật Domain Động]      │
│                                    │                                    │
│  [Hạng mục 4: Nâng cấp Trình Đọc Nâng Cao (Manga RTL, Bookmarks, Theme)]│
│                                    │                                    │
│  [Hạng mục 5: Progressive Search Streaming (Hiển thị Kết quả Luồng)]    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 CHI TIẾT CÁC HẠNG MỤC PHÁT TRIỂN

### 🌐 Hạng mục 1: Đồng Bộ Đám Mây Toàn Cầu (Cloud Sync - Firebase / Supabase)

* **Mục tiêu**: Cho phép đồng bộ kho truyện và lịch sử đọc mọi lúc mọi nơi xuyên suốt qua Internet, ngay cả khi bạn dùng 4G ngoài đường và PC ở nhà đang tắt.
* **Giải pháp đề xuất**:
  * Tích hợp **Firebase Firestore / Realtime Database** (hoặc Supabase miễn phí).
  * Mỗi người dùng có một **Mã Khóa Cá Nhân (Sync Key)** hoặc liên kết Google Sign-In.
  * Tự động sao lưu dữ liệu lên đám mây và phục hồi tức thì khi cài đặt app trên thiết bị mới.

---

### 💾 Hạng mục 2: Tải Truyện Đọc Ngoại Tuyến (Offline Chapter Downloader)

* **Mục tiêu**: Tải toàn bộ ảnh của chương truyện về bộ nhớ máy (PC Disk / Bộ nhớ trong Mobile) để đọc mượt mà khi không có kết nối Internet (trên máy bay, xe bus, vùng sóng yếu).
* **Tính năng chi tiết**:
  * Nút **"Tải chương này"** hoặc **"Tải 5 chương tiếp theo"** ngay trong danh sách chương.
  * Quản lý dung lượng đã tải và nút dọn dẹp bộ nhớ đệm (Clear Cache) trong Cài đặt.
  * Trình đọc tự động ưu tiên nạp ảnh từ bộ nhớ cục bộ nếu chương đã được tải trước đó.

---

### 🔍 Hạng mục 3: Mở Rộng Plugin Nguồn Truyện & Tự Động Quét Domain Động

* **Mục tiêu**: Bổ sung thêm nhiều kho truyện phong phú và cơ chế tự động tìm domain mới nhất khi website bị nhà mạng chặn.
* **Kế hoạch triển khai**:
  * Thêm plugin cho các trang truyện phổ biến: **Cmanga, SayTruyen, OtakuSan, CuuTruyen**.
  * Hệ thống tự động cập nhật danh sách domain dự phòng từ GitHub / DNS Resolver mà không cần người dùng phải cập nhật lại app.

---

### 📖 Hạng mục 4: Nâng Cấp Trình Đọc Nâng Cao (Reader Enhancements)

* **Mục tiêu**: Nâng cao trải nghiệm đọc truyện tranh bản quyền và truyện Nhật Bản cổ điển.
* **Kế hoạch triển khai**:
  * Chế độ **Manga Nhật Bản cổ điển (Phải qua Trái - RTL / Double Page)**.
  * Tính năng **Đánh dấu trang yêu thích (Page Bookmarking)** & Ghi chú vào từng trang truyện.
  * Bộ lọc tùy chỉnh hình ảnh: Tăng độ nét (Sharpen), Khử nhiễu ảnh cũ (Denoise), Tùy chỉnh độ sáng/độ tương phản khi đọc ban đêm.

---

### ⚡ Hạng mục 5: Progressive Search Streaming (Hiển Thị Kết Quả Dạng Luồng)

* **Mục tiêu**: Kết quả tìm kiếm xuất hiện tức thì ngay khi từng plugin scraper hoàn tất mà không cần chờ đợi toàn bộ các nguồn.
* **Kế hoạch triển khai**:
  * Phát sự kiện IPC / WebSocket dạng Streaming `search:chunk` cho từng nguồn.
  * Bổ sung bộ nhớ đệm RAM Search Cache để tìm kiếm tức thì 0ms cho các từ khóa đã tra cứu.
