# Phase 5 – Reporting, Excel và production readiness · v0.5.0

Ngày bàn giao: 18/10/2026. Triển khai tiếp trên Phase 1–4, giữ dữ liệu demo giả và lịch sử hiện có. Chưa triển khai ra Internet.

## Chức năng hoàn thành

- `/reports`: báo cáo 6 tháng Headcount/Capacity/Planned/Actual/Available/Utilization, thiếu lịch và quá tải. Bộ lọc tháng/dự án/vai trò/địa điểm; trạng thái trống khác 0; phân biệt actual đã ghi nhận với khai báo đầy đủ. Dùng chung engine MM/capacity hiện có.
- Export XLSX nguồn lực, forecast ba kịch bản, nhân viên, dự án, Planned và Actual. Ô số/ngày có kiểu, freeze header, autofilter và sheet hướng dẫn/định nghĩa; chuỗi bắt đầu `=` được ghi là text, không tạo công thức. File là snapshot lúc xuất, không tự tính lại khi sửa Excel.
- Import XLSX Employee/Project/Planned/Actual, mỗi file một loại; mã nghiệp vụ làm khóa upsert. Template và preview có lỗi theo dòng, phát hiện khóa/email trùng, tham chiếu PM/employee/project, MM âm/precision/tháng/ngày không hợp lệ. Planned/Actual gọi cùng service transaction như matrix; không đổi capacity hoặc nhập demand/kỹ năng qua template thiếu ngữ nghĩa.
- Preview bắt buộc, ký số gắn actor, hạn 10 phút và fingerprint dữ liệu/tham chiếu. Commit chỉ nhận token, kiểm tra lại trong transaction Serializable; stale/conflict trả 409. Toàn file + audit từng dòng + ImportBatch cùng transaction. Batch ID duy nhất hỗ trợ retry cùng token đã commit; không lưu file/token trong DB/log.
- Giới hạn XLSX 2 MiB, 200 dòng, 20 cột, giải nén 16 MiB/128 entry/8 MiB mỗi entry và giới hạn tỷ lệ nén. Kiểm tra kích thước thực bằng stream trước parser, từ chối macro/formula/hyperlink/external links/embedded objects/DTD/entity. Không hỗ trợ XLS/XLSM/CSV.
- `/audit`: ADMIN/MANAGER lọc actor/entity/action/ngày theo giờ Việt Nam, 30 bản ghi/trang, xem before/after, lọc phòng vệ password/token/secret; không có API sửa/xóa audit. VIEWER đọc/export báo cáo, không import hoặc đọc Audit Log.
- Migration thứ sáu thêm ImportBatch, LoginThrottle, User.sessionVersion và index AuditLog. Đã áp dụng vào demo localhost; schema diff không khác biệt, không reset hoặc tạo thêm nhân viên/dự án.
- Production preparation: PostgreSQL login throttle atomic chia sẻ nhiều process, thu hồi toàn bộ phiên bằng sessionVersion/CLI có audit, security headers, API no-store, liveness/readiness, preflight cấu hình, backup/restore script, Docker standalone non-root, CI workflow và runbook quyền DB/TLS/backup/rollback/monitoring.
- Dev/build dùng Webpack chính thức của Next.js sau khi quan sát Turbopack lỗi subprocess CSS trên Windows; build production đã thành công. `npm start` dùng script standalone, sao chép static và bind loopback; Docker chạy server trực tiếp sau reverse proxy.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| ESLint | Đạt |
| TypeScript | Đạt |
| Production build Webpack + standalone | Đạt |
| Unit test | **68/68**, gồm 10 Excel và 2 production preflight |
| Integration PostgreSQL thật | **59/59**, gồm 15 test Phase 5 |
| Tổng test | **127/127**, 9 file; regression Phase 1–4 đạt |
| HTTP smoke production | 16 trang/chế độ, auth/logout, API history/search/forecast/reporting, XLSX, readiness và security headers đạt |
| Migration/schema | 6 migration áp dụng; không khác biệt schema |
| Dependency audit production | **0 advisory**, `npm audit --omit=dev` |
| Preflight trên cấu hình demo | Từ chối đúng: môi trường/DB role/password demo, thiếu HTTPS origin và seed password |
| Docker image / CI remote | Chưa chạy: không có Docker CLI và chưa có pipeline remote |
| Backup/restore thực tế | Chưa chạy thành công: thiếu pg_dump/pg_restore; script báo lỗi rõ ràng |

Unit test kiểm tra template, number/date/zero/blank, formula injection, hyperlink/sheet/header sai, file/dòng quá giới hạn, payload XML có tỷ lệ nén bất thường, audit redaction và cấu hình production. Integration dùng database PostgreSQL tạm riêng trên port OS cấp; kiểm tra RBAC/Origin, preview không ghi, create/update theo mã, token giả/hết hạn/khác actor, stale fingerprint, import đồng thời, retry idempotent, rollback audit và rollback dòng trước khi dòng sau vi phạm constraint DB. Planned/Actual riêng biệt, PM/status/date/MM validation, export đối chiếu engine, filter audit theo ngày Việt Nam, throttle đồng thời và thu hồi phiên đều có test.

Vitest nâng lên 5.0.5, ExcelJS dùng UUID 11.1.1 override; các test XLSX/CF cơ bản và build đã đi qua dependency mới. Full dev audit còn **5 high advisory** trong chuỗi ESLint/fast-glob/micromatch/braces; chưa có đường nâng tương thích được xác minh. Không chạy auto-fix ép hạ major Next ESLint. Không đưa dev tooling vào runtime; cần tiếp tục theo dõi và vá trước khi dùng công cụ với glob không tin cậy. Nguồn API đã đối chiếu: [ExcelJS](https://github.com/exceljs/exceljs), [yauzl](https://github.com/thejoshwolfe/yauzl), [Vitest migration](https://vitest.dev/guide/migration/), [UUID](https://github.com/uuidjs/uuid).

## Browser smoke đã thực hiện

Trên trình duyệt in-app, bản production localhost:3001: đăng nhập ADMIN demo; mở Reports; lọc PM/Onsite; đối chiếu 1 nhân viên, Planned 0,6 MM và capacity 0,7636 MM tháng 10/2026; tải Excel nhân viên theo bộ lọc; chọn file vừa tải; preview 1 dòng cập nhật/0 lỗi; commit thành công; lọc Audit Log theo ImportBatch và mở after snapshot. Thông tin nhân viên giữ nguyên, chỉ updatedAt/audit/batch thay đổi; không tạo thêm nhân viên/dự án. Đã sửa độ rộng JSON audit sau khi xem ảnh, tránh cột chi tiết quá hẹp.

Đã kiểm tra breakpoint 390×844: Audit Log/Reports không làm tràn ngang toàn trang; bảng cuộn trong panel, menu mobile điều hướng được sang Reports, nút preview chưa chọn file bị khóa. Viewport đã được khôi phục. JSON before/after nằm ở hàng toàn chiều rộng để dễ đọc.

Ảnh kiểm tra lưu trong `.tools/phase5-reports.png` và `.tools/phase5-audit.png` (ignored). Đây là smoke có thao tác thật, chưa phải bộ E2E tự động đầy đủ hoặc kiểm chứng responsive trên mọi thiết bị. Các lỗi/RBAC/concurrency được kiểm tra thêm ở integration API.

## Chưa hoàn thành và vấn đề còn lại

- Chưa xác nhận production-ready hoặc deploy. Docker/CI Linux, runtime DB role, HTTPS/CA, gateway limits, observability và restore drill cần được chạy trên hạ tầng đích. Backup script không thể chứng minh restore khi máy thiếu client tools.
- Chưa có password reset/MFA/SSO/UI quản trị user, thu hồi riêng từng thiết bị, closed-month/approval workflow, audit retention UI, báo cáo lịch sử tại một snapshot bất biến hoặc kiểm thử tải lớn.
- Login throttle theo email có thể bị gây khóa tài khoản/đổ nhiều key; cần gateway rate limit IP/global và maintenance xóa counter hết hạn. Không xóa audit tự động.
- Report đọc capacity/forecast từ nhiều nguồn hiện tại, chưa là snapshot transaction duy nhất toàn bộ nghiệp vụ. File xuất ghi thời điểm/bộ lọc; không dùng làm hồ sơ đóng sổ bất biến. Một số export có thể lớn tới 10.000 dòng, còn cần server-side pagination/streaming và đo tải cho đội ngũ lớn.
- Import tối đa 200 dòng, một loại/file; không import demand/skills/calendar/user, không đổi mã hoặc xóa lịch sử. Export lớn hơn 200 dòng cần chia file có chủ đích trước khi import lại; server vẫn kiểm tra trùng khóa từng file, không tự chia.
- Forecast vẫn theo tháng, dùng kỹ năng/trạng thái hiện tại, chưa tối ưu lịch ngày. Các giới hạn Phase 2–4 trong README tiếp tục có hiệu lực.

## Cách chạy và bước tiếp theo

Giữ `.env`/database, chạy `npm ci`, `npm run db:generate`, `npm run db:migrate`, rồi `npm run dev`. Mở `/reports?month=2026-10` và `/audit`. Không cần seed riêng Phase 5; dữ liệu demo đầy đủ dùng chuỗi seed Phase 1–4 đã hướng dẫn trong [README](../README.md).

Tiếp theo: UAT theo vai trò, tự động hóa browser E2E gồm import lỗi/download/mobile, kiểm chứng Docker/CI và quyền DB, restore drill/PITR, kiểm thử tải và cấu hình vận hành theo [production runbook](production-runbook.md). Chỉ chốt release sau khi các bằng chứng này đạt.
