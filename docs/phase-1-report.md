# Báo cáo Phase 1 – Foundation

## Đã hoàn thành

- Kiểm tra repository ban đầu trống và môi trường thiếu Node/PostgreSQL trong PATH. Chuẩn bị Node 24 LTS portable và PostgreSQL local trong workspace.
- Thiết kế kiến trúc thư mục, ERD, quy tắc nghiệp vụ và lộ trình trước khi triển khai, xem `architecture.md`.
- Next.js App Router/TypeScript/Tailwind/shadcn Button/Recharts/Prisma/PostgreSQL. Build production thành công.
- PostgreSQL schema cho toàn bộ mô hình yêu cầu, thêm CalendarDay/CalendarMonth và xác suất dự án theo kịch bản. Hai migration có unique, CHECK, FK và trigger audit append-only. Áp dụng thành công vào database demo và database integration riêng.
- Đăng nhập/đăng xuất, JWT 8 giờ, cookie HttpOnly, RBAC ADMIN/MANAGER/VIEWER, kiểm tra user active tại server, kiểm tra Origin. Không có public signup.
- Employee Directory, Employee Detail: tạo/sửa, thông tin nhân viên, tìm kiếm, bộ lọc và phân trang; xem kỹ năng và dự án đã ghi nhận.
- Project Portfolio: tạo/sửa, khách hàng/PM/ngày/status/MM, tìm kiếm và lọc. Chỉ chọn PM còn làm việc.
- Executive Dashboard cơ bản với bộ lọc tháng/dự án/vai trò/địa điểm; thống kê headcount, portfolio, biểu đồ vai trò và trạng thái dự án. Capacity tính khi có lịch đầy đủ; seed chưa có lịch nên UI báo chưa thiết lập. Pipeline không cộng vào Confirmed Demand.
- Mutation + Audit Log cùng transaction, snapshot before/after; rollback khi không ghi được audit.
- Seed idempotent 30 nhân viên và 8 dự án, 3 tài khoản, 10 kỹ năng, 24 assignment; toàn bộ danh tính giả @example.test. Chạy seed không ghi đè dữ liệu đang có.
- README, cấu hình mẫu, Docker Compose, script setup local, script PostgreSQL local và HTTP smoke.

## Chưa hoàn thành (đúng phạm vi các phase tiếp theo)

| Phase | Chức năng |
| --- | --- |
| 2 | UI working calendar, nghỉ phép, capacity planning, matrix allocation, planned/actual, lịch sử allocation |
| 3 | Chỉnh sửa skill matrix, tìm tổ hợp kỹ năng/khả dụng, project skill requirements |
| 4 | Nhập demand theo tháng, forecast 6 tháng, weighted pipeline theo scenario, resource/skill gap, đề xuất tuyển dụng |
| 5 | Excel import/export, báo cáo tổng hợp, Audit Log UI, quản trị tài khoản và production hardening |

Các route dành cho phase sau hiển thị thông báo trạng thái và phạm vi dự kiến. Không giả lập chức năng đã hoàn thành. Đã có schema và hàm MM cơ bản để tiếp tục Phase 2.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma Client generate | Đạt |
| Hai migrations + seed demo localhost | Đạt |
| ESLint | Đạt, không lỗi/cảnh báo |
| TypeScript typecheck | Đạt |
| Next.js production build | Đạt |
| Unit test | 15/15 đạt: MM (13), session (1), Origin (1) |
| Integration test PostgreSQL thật | 14/14 đạt |
| Tổng Vitest | **29/29 đạt, 4 test files** |
| Next HTTP smoke | Login, protected redirect, 7 trang và logout đạt |
| Browser visual / interaction QA | Chưa thực hiện: công cụ không có browser khả dụng, `iab` trả Browser is not available |

Integration test dùng cluster PostgreSQL thật riêng tại 127.0.0.1:55439 và Prisma thật, migration deploy thật; seed hai lần kiểm tra idempotency. Test API bao gồm quyền VIEWER, ADMIN/MANAGER, input sai, duplicate, PM không hợp lệ, 404, audit rollback, audit append-only, lịch sử FK, phân bổ trùng/MM âm/ngày đầu tháng, user inactive và capacity sau khi áp lịch/phép. Test capacity tổng hợp xác nhận 21 ngày khả dụng × 0.8 / 22 = 0.7636 MM, allocation 1.2 MM vẫn được lưu và nhận diện quá tải.

Lỗi được phát hiện và sửa: kiểm tra Origin ban đầu dựa vào request.url của Next có thể chuẩn hóa host localhost; hiện đối chiếu Origin với Host thực và protocol, có regression test cho 127.0.0.1. Sandbox Windows chặn os.userInfo khi chạy tsx/embedded PostgreSQL; seed và bộ integration đã chạy lại thành công ngoài sandbox với quyền được cấp.

## Vấn đề còn tồn tại

- Chưa có browser E2E/visual QA; chưa xác minh hydration Recharts, dialog focus và bố cục mobile trực tiếp trên trình duyệt. HTTP smoke chỉ chứng minh server render/route hoạt động.
- Authentication Foundation chưa gồm reset password/MFA/SSO, session store/revocation theo thiết bị và rate limit phân tán. Logout xóa cookie; JWT đã bị sao chép vẫn hợp lệ đến hạn nếu user chưa bị tắt.
- Chưa production-ready: cần PostgreSQL role quyền tối thiểu, HTTPS/reverse proxy, quản lý secrets, backup/restore, quan sát vận hành, distributed rate limit và security review. Native PostgreSQL helper chỉ dùng dev/test.
- Không có Git CLI trong PATH và workspace ban đầu không có repository; chưa tạo commit.
- Seed chưa cấu hình lịch và MM để không tạo kết luận về capacity/forecast chưa có cơ sở. Contracted/Forecast MM của portfolio là tổng vòng đời; dashboard ghi rõ, không coi là demand theo tháng.

## Đề xuất Phase 2

Triển khai lịch làm việc/ngày công chuẩn theo tháng trước, tiếp đến nghỉ phép và participation rate; dùng công thức MM đã kiểm thử để xây Capacity Planning. Sau đó làm Allocation Matrix đa dự án theo tháng, cảnh báo overallocated/unallocated, nhập Actual riêng, kiểm soát chỉnh sửa đồng thời và audit history. Chỉ bắt đầu dự báo sau khi có nguồn supply/demand đầy đủ.
