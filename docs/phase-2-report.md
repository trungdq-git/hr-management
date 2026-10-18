# Báo cáo Phase 2 – Resource Planning

Ngày hoàn thành: 17/10/2026. Phiên bản: **0.2.0**.

## Chức năng hoàn thành

Triển khai theo thứ tự lịch → capacity → allocation như yêu cầu. [Thiết kế Phase 2](phase-2-design.md) ghi rõ công thức, quy tắc và ranh giới nghiệp vụ.

1. **Working Calendar**: tạo nhiều lịch; thiết lập standard working days theo tháng; chỉnh từng ngày với fraction 0–1, ghi chú lễ/nghỉ bù; điền mẫu T2–T6 theo thao tác chủ động. API buộc đủ ngày và không trùng ngày trong tháng, kể cả cuối tuần.
2. **Monthly Capacity**: gán lịch và participation rate cho nhân viên/tháng; hỗ trợ bulk giữ tỷ lệ riêng của từng người. Tính từ lịch/ngày lễ, phép/không khả dụng, ngày vào/nghỉ việc và tỷ lệ tham gia. Phân biệt capacity thiếu dữ liệu với capacity 0; available có thể âm; utilization không áp dụng khi mẫu số 0.
3. **Phép và không khả dụng**: nhập/sửa/hủy nghỉ theo ngày, LEAVE/UNAVAILABLE; hủy giữ fraction=0 với phiên bản tăng, không reset version. Không trừ thêm nghỉ cuối tuần/lễ, không trừ quá fraction làm việc của ngày.
4. **Allocation Matrix**: sáu tháng xuyên năm, nhân viên × tháng, xem theo nhân viên hoặc dự án, MM/% chuẩn, tìm tên/mã, lọc vị trí/địa điểm/dự án/cảnh báo. Chỉnh từng tháng và từng dự án; tự tính tổng đa dự án, available, utilization; đánh dấu quá tải, chưa phân bổ hoặc thiếu lịch.
5. **Planned/Actual độc lập**: nhập đúng loại cần thay đổi, version riêng, không tự sao chép planned sang actual. Actual chưa nhập hiển thị “—”; ghi 0 giữ bản ghi lịch sử. Một nhân viên có thể có nhiều assignment.
6. **Lịch sử phân bổ**: xem tối đa 100 thay đổi gần nhất theo nhân viên/tháng trong dialog, gồm trước/sau, dự án, loại Planned/Actual, người sửa và giờ Việt Nam. API hỗ trợ thêm lọc dự án; cần đăng nhập để đọc.
7. **Concurrency và audit**: khóa row calendar/employee trong transaction, optimistic version chống stale update và stale create. Bulk settings ghi toàn bộ hoặc rollback. Audit và thay đổi dữ liệu ghi cùng transaction; VIEWER không được ghi, API kiểm tra Origin.
8. **Tích hợp**: Dashboard và Employee Detail dùng engine capacity chung; Dashboard hiển thị cảnh báo quá tải/chưa phân bổ và Actual tổng đã ghi nhận. Khi lọc dự án, tổng allocation của nhân viên vẫn tính tất cả dự án để không che quá tải.
9. **Migration/seed**: migration thứ ba thêm EmployeeCapacitySetting, AbsenceKind, version, index và ràng buộc dữ liệu; snapshot lịch/tỷ lệ của những tháng đã cấu hình ở Phase 1, không reset dữ liệu. Seed Phase 2 opt-in cho 30 hồ sơ giả, lịch 10/2026–03/2027, planned/actual, ví dụ đa dự án vượt capacity và nghỉ phép. Seed có audit, không ghi đè dữ liệu hiện có, đã áp dụng vào PostgreSQL demo localhost.

## Business rules đã kiểm tra

- Capacity MM = Available Working Days / Standard Working Days, trong đó ngày khả dụng đã nhân participation rate và giới hạn join/exit date. Giữ độ chính xác ngày đến 8 số khi nhân hai đầu vào 4 số; chỉ làm tròn MM cuối về 4 số, hiển thị 2 số.
- Allocation = tổng planned, Actual là công được nhập riêng; Available = Capacity − Allocation. Capacity 0 vẫn báo allocation dương là quá tải; thiếu lịch không giả định capacity bằng 0.
- 100% allocation = 1 MM chuẩn; utilization so với capacity thực tế sau nghỉ.
- Effort dương cần khoảng thời gian giao nhau giữa nhân viên, dự án và tháng. Pipeline không nhận planned/actual dương. Cancelled không nhận planned dương nhưng cho sửa actual lịch sử; có thể đưa số liệu cũ về 0 mà không xóa lịch sử.
- Sửa lịch/phép hồi tố chủ động sẽ tính lại capacity và được audit. Cấu hình lịch/tỷ lệ theo tháng riêng không bị thay bởi thiết lập một tháng mới.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma generate | Đạt |
| Migration deploy database demo | Đạt, 3 migration, schema up to date |
| ESLint | Đạt, không lỗi/cảnh báo |
| TypeScript typecheck | Đạt |
| Production build | Đạt |
| Unit test | **25/25 đạt** |
| Integration test trên PostgreSQL thật | **24/24 đạt** |
| Tổng Vitest | **49/49 đạt**, 5 test files |
| HTTP smoke production | Đạt: login, protected redirect, 10 trang/chế độ, API history, logout |
| Browser UI/E2E | Chưa thực hiện: công cụ trả inventory apps/browsers trống |

Integration test giữ các test Phase 1 và bổ sung lịch tháng đầy đủ/sai ngày, validation, capacity settings theo tháng/bulk rollback, giảm capacity khi nghỉ, hủy nghỉ/stale version, nhiều dự án, Planned/Actual độc lập, query lịch sử đúng tháng, hai request sửa đồng thời (một thành công/một 409), pipeline/cancelled/ngày làm việc và project window, audit failure rollback, constraint DB và seed idempotent. Cookie boundary được mock; Prisma, PostgreSQL, transaction và tính MM là thật.

Đã phát hiện/sửa trong quá trình kiểm tra: metadata tháng trong snapshot audit bị Date ghi đè khiến lọc YYYY-MM không khớp; giữ version tăng khi hủy nghỉ để tránh stale update sau tạo lại; kiểm tra khoảng giao nhau thực tế khi dự án kết thúc trước ngày nhân viên gia nhập nhưng vẫn cùng tháng. Các fixture Phase 1 chạy trước Phase 2 để seed kế hoạch không làm sai giả định kiểm thử nền tảng.

HTTP smoke dùng **127.0.0.1:3001** vì port 3000 đã có dịch vụ. Không dừng dịch vụ có sẵn. PostgreSQL localhost có sẵn đã được tái sử dụng; script db:local được sửa để nhận biết dịch vụ đang chạy thay vì khởi động thêm.

## Chức năng chưa hoàn thành

Không còn hạng mục bắt buộc Phase 2 chưa triển khai. Các chức năng ngoài phạm vi hiện tại:

- Phase 3: cập nhật Skill Matrix, tìm tổ hợp kỹ năng/level/JLPT/khả dụng, project skill requirements.
- Phase 4: demand tháng, forecast, scenario có xác suất, resource/skill gap và đề xuất tuyển dụng.
- Phase 5: Excel import/export, báo cáo, Audit Log UI tổng quát và production hardening.

## Vấn đề và giới hạn còn tồn tại

- Chưa có kiểm tra bố cục và thao tác trực tiếp trong browser: modal, phím tắt, mobile layout và hydration cần browser E2E/visual QA khi có công cụ khả dụng. HTTP smoke xác minh server render, không thay thế browser test.
- Chưa có khóa đóng sổ tháng, phê duyệt ngày nghỉ, copy/bulk-edit allocation hoặc virtualized matrix. Bulk assignment capacity tối đa 500 người/request; UI hiện phù hợp demo 30 người. Cần pagination/virtualization và kiểm tra tải cho quy mô lớn.
- History dialog hiển thị 100 thay đổi gần nhất trong tháng, không có pagination/export ở Phase 2. Thay đổi lịch/settings/absence đã được audit nhưng chưa có UI tra cứu audit tổng quát.
- Một record nghỉ/nhân viên/ngày; nếu có nhiều nguyên nhân trong ngày thì tổng hợp fraction vào một record và ghi rõ lý do. Không tự đồng bộ ngày lễ pháp định hoặc HR leave system.
- Những giới hạn auth/production của Phase 1 vẫn còn: rate limit theo process, chưa SSO/MFA/reset password/session revocation từng thiết bị, observability/backup và DB role giới hạn quyền cần hoàn thiện trước production.

## Phase tiếp theo

Đề xuất **Phase 3 – Capability Management**: CRUD Skill Matrix theo 8 nhóm, proficiency 1–5, tìm tổ hợp kỹ năng/level/JLPT kèm available MM từ engine Phase 2, và yêu cầu kỹ năng cho từng dự án. Chỉ triển khai forecast khi supply và demand có dữ liệu đáng tin cậy.
