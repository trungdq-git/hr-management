# Báo cáo Phase 3 – Capability Management

Ngày hoàn thành: 17/10/2026. Phiên bản: **0.3.0**.

## Chức năng hoàn thành

- **Skill Matrix `/skills`**: bảng nhân viên × kỹ năng với proficiency 1–5, sticky header/cột nhân viên, tìm nhân viên/kỹ năng, lọc nhóm/vị trí, chọn tháng đối chiếu available MM; hiển thị khác nhau giữa chưa đánh giá và mức 1. ADMIN/MANAGER sửa/gỡ/khôi phục rating từ từng ô; VIEWER chỉ đọc.
- **Danh mục theo 8 nhóm**: Programming Languages, Frameworks, Cloud, Database, Testing, AI Tools, Project Management, Japanese Communication. Tạo/sửa tên/nhóm, lưu trữ và khôi phục, tìm/lọc, xem mức sử dụng trong nhân viên và dự án. Tên không phân biệt hoa/thường; không archive khi còn requirement có hiệu lực.
- **Resource Search**: tìm tổ hợp kỹ năng ALL/ANY với ngưỡng riêng, level 1–6, JLPT tối thiểu, tên/mã/vị trí/địa điểm và available MM theo tháng. Capacity và tổng planned được tính bởi engine Phase 2. Mặc định chỉ tìm người có MM khả dụng đã biết; tùy chọn xem cả quá tải hoặc thiếu lịch được phân biệt rõ. Kết quả có chứng cứ mức kỹ năng, Capacity/Planned/Available và link sang matrix lọc theo nhân viên.
- **Project Skill Requirements `/projects/[id]`**: tạo/sửa/gỡ/khôi phục yêu cầu proficiency và MM ước tính theo kỹ năng. Link từ tên dự án trong Portfolio; tìm ứng viên áp dụng toàn bộ requirement dự án theo AND. Chọn dự án chưa có yêu cầu hiển thị cảnh báo, không khẳng định đã xác minh phù hợp.
- **Tích hợp hồ sơ**: Employee Detail chỉ hiển thị rating/catalog có hiệu lực, có link cập nhật matrix; sidebar và Settings hiển thị Capability Management v0.3.0.
- **Audit/concurrency**: active/version cho Skill, EmployeeSkill, ProjectSkillRequirement; gỡ mềm giữ bản ghi/phiên bản, audit trước/sau cùng transaction. Lock skill trước employee/project; stale edit/create trả 409, hai request sửa đồng thời không ghi đè. Hộp thoại dùng dữ liệu mới sau tải lại khi gặp xung đột.
- **Migration và seed**: migration thứ tư áp dụng thành công vào PostgreSQL demo, không reset dữ liệu. Seed capability opt-in bổ sung rating/yêu cầu cho hồ sơ và 6 dự án giả, có audit; không ghi đè record đang có, kể cả record đã gỡ. Giữ 30 nhân viên và 8 dự án demo.
- **Tài liệu**: [thiết kế Phase 3](phase-3-design.md), ERD/quy tắc bổ sung và README đã cập nhật lệnh nâng cấp, seed, thao tác và kiểm thử.

## Quy tắc đáng chú ý

- Skill proficiency 1–5, employee level 1–6 và JLPT là ba dữ liệu khác nhau. JLPT N2 nhận N1/N2, NONE chỉ nhận chưa có chứng chỉ. Không suy kỹ năng giao tiếp tiếng Nhật từ JLPT.
- Kỹ năng thủ công hỗ trợ AND/OR; requirement dự án luôn AND, không bị nới lỏng bởi OR. Rating không có/đã gỡ/catalog archived không thỏa kỹ năng.
- AVAILABLE: capacity đã biết và available > 0; ngưỡng MM > 0 luôn yêu cầu dữ liệu khả dụng đã biết. KNOWN/ANY với ngưỡng 0 có thể xem quá tải; ANY còn cho xem thiếu lịch và hiển thị “Chưa xác định”.
- Điều kiện làm việc theo join/exit date của tháng; hồ sơ kỹ năng là trạng thái hiện tại. Search lịch sử không phải tái dựng năng lực tại thời điểm quá khứ.
- MM ước tính theo kỹ năng của dự án không phải monthly demand. Các kỹ năng có thể chồng lặp cùng một nhân viên, vì vậy không cộng MM qua kỹ năng để suy headcount, demand hoặc forecast.
- Search không tự ghi assignment/allocation; việc chốt phân bổ vẫn thực hiện tại Planning và phải kiểm tra khả dụng mới nhất.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Prisma Client generate | Đạt |
| Migration deploy demo | Đạt, 4 migrations, schema up to date |
| Prisma schema diff so với database demo | Không khác biệt |
| ESLint | Đạt, không lỗi/cảnh báo |
| TypeScript typecheck | Đạt |
| Production build | Đạt |
| Unit test | **37/37 đạt** (thêm 12 test capability) |
| Integration test PostgreSQL thật | **34/34 đạt** (thêm 10 test capability) |
| Tổng Vitest | **71/71 đạt**, 6 test files |
| HTTP smoke production | Đạt: login, redirect, 14 trang/chế độ, API history, API search và logout |
| Browser visual/interaction QA | Chưa thực hiện: tool trả inventory apps/browsers trống |

Unit test bao phủ ALL/ANY, requirement dự án bắt buộc, JLPT, level/vị trí/địa điểm, rating/catelog inactive, available null/0/âm, làm việc theo tháng, sort ổn định và validation.

Integration giữ toàn bộ regression Phase 1/2 và thêm auth/RBAC/Origin, tên trùng hoa/thường, CRUD/soft remove/restore, version tăng, sửa đồng thời (một 200, một 409), ngăn archive kỹ năng đang được yêu cầu, audit snapshot/rollback, FK/proficiency/MM constraints, seed idempotent, tìm dự án với nguồn capacity thật. Đã xác nhận nhân viên demo đa dự án quá tải bị loại khỏi nhóm AVAILABLE nhưng vẫn xem được ở ANY với ngưỡng 0.

Lần khởi tạo cluster test đầu thất bại trên cổng cố định và teardown bị timeout. Fixture đã được sửa dùng cổng localhost tạm do OS cấp, giữ log startup, chỉ stop khi khởi động thành công. Bộ 71 test chạy lại đạt. Không dừng hoặc sửa dịch vụ test/database có sẵn của người dùng. HTTP smoke dùng server production riêng tại 127.0.0.1:3001 và database demo localhost hiện có.

## Chức năng chưa hoàn thành

Không còn chức năng lõi Phase 3 chưa triển khai. Các hạng mục tiếp theo vẫn nằm ngoài phase này:

- **Phase 4**: MonthlyProjectDemand, supply/demand 6 tháng, xác suất Pipeline theo Conservative/Base/Optimistic, Resource Gap, Skill Gap tổng hợp và đề xuất điều chuyển/tuyển dụng.
- **Phase 5**: Excel import/export, báo cáo, Audit Log UI tổng quát, quản trị tài khoản và production readiness.

## Giới hạn còn tồn tại

- Chưa có browser E2E/visual QA cho matrix, modal, focus, các thao tác filter và bố cục responsive. HTTP smoke chỉ chứng minh route/server render/API, không thay thế kiểm tra trình duyệt.
- Kỹ năng hiện tại không có chu kỳ phê duyệt/chứng nhận, ngày đánh giá hiệu lực hoặc snapshot theo tháng; audit lưu thay đổi nhưng UI timeline kỹ năng dành giai đoạn báo cáo.
- Search là đối chiếu một tháng, không chứng minh đủ nguồn lực cho toàn thời gian dự án. Không có thuật toán tối ưu assignment hoặc dự báo skill-gap ở phase này.
- Catalog archive bị chặn bởi mọi requirement còn hiệu lực, kể cả dự án đã kết thúc; người quản lý phải gỡ requirement chủ động trước khi archive.
- Dataset demo 30 nhân viên tải vào matrix; search hiện đối chiếu ở server theo tập dữ liệu tháng. Cần đo tải, phân trang/virtualization và tối ưu truy vấn khi quy mô lớn.
- Những giới hạn production/auth của Phase 1/2 vẫn còn và đã ghi ở README.

## Phase tiếp theo

Đề xuất **Phase 4 – Resource Forecast**: nhập demand tháng theo dự án, tách Confirmed/Pipeline; lấy supply từ capacity engine, dùng xác suất được cấu hình rõ theo scenario, không tự cộng Pipeline vào Confirmed. Sau đó xây Resource Gap và Skill Gap với quy tắc chống đếm một người nhiều lần khi có nhiều kỹ năng.
