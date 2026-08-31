# 🛡️ Quy Tắc Làm Việc Dự Án Manga Notifier (Project Guidelines & Invariants)

Tài liệu quy tắc hành vi và chuẩn mực bắt buộc dành cho AI Assistant khi làm việc trong dự án Manga Notifier:

## 1. 📖 Đọc & Nắm Bắt Tài Liệu Dự Án Trước Khi Bắt Đầu
- Trước khi bắt tay vào thực hiện bất kỳ yêu cầu mới nào trong mỗi phiên làm việc, **BẮT BUỘC** phải chủ động đọc và tham chiếu các file tài liệu Markdown của dự án:
  - [`README.md`](file:///c:/Code/MangaNotifier/README.md): Tổng quan kiến trúc Cross-Platform (PC & Mobile), tính năng và hướng dẫn build/run.
  - [`.agents/plans/PROGRESS.md`](file:///c:/Code/MangaNotifier/.agents/plans/PROGRESS.md): Toàn bộ lịch sử tiến trình phát triển và các giải pháp kỹ thuật đã giải quyết.
  - [`.agents/plans/FUTURE_PLAN.md`](file:///c:/Code/MangaNotifier/.agents/plans/FUTURE_PLAN.md): Lộ trình và kế hoạch các tính năng dự kiến triển khai.
- Việc đọc tài liệu giúp đảm bảo nắm vững toàn diện ngữ cảnh dự án, kiến trúc plugin, và tránh làm hỏng các tính năng đã được hoàn thiện trước đó.

## 2. 🔒 Tuyệt Đối Không Tự Ý Xóa Dữ Liệu / Mã Nguồn
- **Bảo toàn mã nguồn**: Tuyệt đối không tự ý xóa bỏ các file, tính năng, thư mục hoặc logic mã nguồn hiện có nếu chưa có sự đồng ý hoặc chỉ định rõ ràng từ người dùng.
- **Bảo toàn dữ liệu người dùng**: Luôn giữ an toàn tuyệt đối cho cơ sở dữ liệu truyện (`mangas.json`, `history`, `settings`), tiến trình đọc và cấu hình token người dùng.

## 3. ⚡ Luôn Phân Tích Đa Chiều & Đề Xuất Giải Pháp Tối Ưu
- Trước khi thực thi bất kỳ tính năng hay sửa lỗi nào, luôn phân tích thấu đáo nguyên nhân gốc rễ và đánh giá toàn diện các phương án.
- **Khi đưa ra bất kỳ phương án nào, BẮT BUỘC phải luôn chỉ rõ**:
  - 🟢 **Ưu điểm**: Những lợi ích mang lại (hiệu năng, độ mượt mà, tính bảo mật, tiện lợi, dễ mở rộng).
  - 🔴 **Nhược điểm & Đánh đổi**: Các mặt hạn chế (độ phức tạp, tài nguyên sử dụng, rủi ro tương thích, phụ thuộc mạng/môi trường).
- Luôn ưu tiên giải pháp tối ưu nhất về:
  - **Hiệu năng & Tiết kiệm tài nguyên**: Tải ảnh nhanh, có lazy loading, chống nghẽn CDN, không giật lag.
  - **Trải nghiệm Người dùng (UX/UI)**: Mượt mà, trực quan, thẩm mỹ cao, phù hợp riêng cho từng nền tảng (PC / Mobile).
  - **Độ ổn định & Khả năng mở rộng**: Code sạch, kiến trúc module hóa rõ ràng, dễ bảo trì lâu dài.

## 4. 📝 Tự Động Cập Nhật Tài Liệu Markdown Sau Mỗi Phiên Làm Việc
- Sau mỗi lần hoàn thành các thay đổi, sửa lỗi hoặc thêm tính năng mới, **BẮT BUỘC** phải tự động rà soát và cập nhật đồng bộ các file tài liệu Markdown của dự án:
  - [`README.md`](file:///c:/Code/MangaNotifier/README.md): Cập nhật nếu có thay đổi về tính năng tổng quan, hướng dẫn cài đặt/chạy hoặc cấu trúc dự án.
  - [`.agents/plans/PROGRESS.md`](file:///c:/Code/MangaNotifier/.agents/plans/PROGRESS.md): Ghi lại chi tiết các công việc, tính năng mới và các lỗi kỹ thuật đã được giải quyết trong phiên.
  - [`.agents/plans/FUTURE_PLAN.md`](file:///c:/Code/MangaNotifier/.agents/plans/FUTURE_PLAN.md): Đánh dấu hoàn thành các hạng mục đã xong và bổ sung các kế hoạch/ý tưởng mới nếu có.
- Đảm bảo tài liệu luôn là nguồn tham chiếu chuẩn xác, đầy đủ và cập nhật nhất của dự án.

## 5. 💬 Quy Tắc Phản Hồi Theo Đúng Mục Đích Ngữ Cảnh Của Người Dùng
- **Khi người dùng đưa ra "Thắc mắc"**:
  - Chủ động giải thích cặn kẽ, rõ ràng và thấu đáo nguyên nhân, cơ chế hoạt động để giải tỏa hoàn toàn các điểm chưa rõ.
- **Khi người dùng đặt "Câu hỏi"**:
  - Trả lời trực diện, chính xác, ngắn gọn và có cơ sở kỹ thuật/thực tế rõ ràng vào đúng trọng tâm câu hỏi.
- **Khi người dùng nêu "Ý kiến / Đề xuất"**:
  - Lắng nghe, phân tích và đánh giá khách quan các ưu điểm, nhược điểm, tính khả thi của ý kiến đó; đưa ra nhận xét và các giải pháp tối ưu bổ trợ nếu cần.
- **Khi người dùng yêu cầu "Check / Kiểm tra"**:
  - Lập tức tiến hành rà soát, kiểm thử toàn diện mã nguồn/hệ thống/tính năng được yêu cầu; chủ động tìm ra nguyên nhân gốc rễ và tự động khắc phục (fix) ngay nếu nằm trong khả năng, sau đó kiểm thử xác nhận và báo cáo kết quả chi tiết.
