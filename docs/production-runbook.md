# Vận hành IT-RMS v0.5

Ứng dụng đã có kiểm tra kỹ thuật cho Phase 1–5. Việc đưa lên production cần môi trường, tài khoản và kiểm chứng dưới đây; chưa có deployment nào được thực hiện trong phase này.

## Cấu hình và tài khoản

1. Dùng PostgreSQL managed hoặc cluster có backup, monitoring và TLS xác minh CA. Tách role migration/owner khỏi runtime. Không dùng superuser hoặc tài khoản demo cho app.
2. Đặt `DATABASE_URL`, `SESSION_SECRET` ngẫu nhiên ít nhất 48 ký tự, `APP_ORIGIN=https://...`, `NODE_ENV=production`; bỏ `SEED_DEMO_PASSWORD`. Không ghi các giá trị thật vào source, Docker image, log hoặc lệnh CI có echo. Chạy `npm run check:production` trong môi trường đích; lệnh chỉ kiểm tra cấu hình, không chứng minh quyền DB/TLS thực tế.
3. Provision user ADMIN bằng quy trình quản trị có kiểm soát, hash bcrypt và audit, không chạy demo seed trong production. Chưa có UI tạo user/reset password/MFA/SSO. Không sử dụng user `@example.test` của demo trên Internet.
4. Reverse proxy kết thúc HTTPS, giữ Host/protocol nhất quán để kiểm tra Origin. Giới hạn request body 2 MiB cho preview, 1 MiB cho commit; timeout và giới hạn đồng thời import theo tài nguyên. HSTS cấu hình ở proxy sau khi xác nhận toàn bộ domain dùng HTTPS. CSP hiện chặn frame/object/base/form khác nguồn; chưa dùng nonce/strict script CSP.

Mẫu quyền runtime cần được DBA áp dụng/kiểm tra trên database đích (không tự chạy trong ứng dụng):

```sql
-- Role itrms_runtime được tạo và quản lý credential ngoài source.
GRANT CONNECT ON DATABASE itrms TO itrms_runtime;
GRANT USAGE ON SCHEMA public TO itrms_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO itrms_runtime;
GRANT INSERT, UPDATE ON "Employee", "Project", "Skill", "EmployeeSkill",
  "ProjectSkillRequirement", "ProjectAssignment", "MonthlyAllocation", "MonthlyActualEffort",
  "WorkingCalendar", "CalendarDay", "CalendarMonth", "EmployeeAbsence",
  "EmployeeCapacitySetting", "MonthlyProjectDemand", "MonthlySkillDemand",
  "ForecastScenario", "ScenarioProjectProbability", "LoginThrottle" TO itrms_runtime;
GRANT DELETE ON "CalendarDay", "MonthlySkillDemand", "LoginThrottle" TO itrms_runtime;
GRANT INSERT ON "AuditLog", "ImportBatch" TO itrms_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog", "ImportBatch" FROM itrms_runtime;
-- Không cấp CREATE/ALTER/DROP, quyền owner hoặc UPDATE User cho runtime.
```

`AuditLog` còn có trigger append-only; owner/superuser vẫn có thể thay đổi schema, vì vậy phải quản lý credential migration riêng. Thu hồi phiên dùng operator role có quyền UPDATE User và INSERT AuditLog; không cấp role này cho web runtime.

## Build, migrate và triển khai

```powershell
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=moderate
```

`package-lock.json` khóa phiên bản. Node 24; Vitest 5 đã được kiểm thử trên Node 24.22. ExcelJS dùng override UUID 11.1.1 giữ API CommonJS v4 đã dùng và tránh advisory phiên bản cũ. Audit dev còn cảnh báo chuỗi ESLint/glob; không đưa dev dependencies/test server vào runtime và không chạy glob từ nguồn không tin cậy. Không dùng `npm audit fix --force` hạ Next ESLint về major cũ.

Backup trước migration. Chạy `npm run db:migrate` bằng migration role trong release job duy nhất; không chạy `db push`, reset hoặc seed production. Phase 5 là migration thứ sáu, thêm bảng phục vụ import/login và version phiên; giữ dữ liệu cũ. Sau đó chạy web bằng runtime credential. `npm start` phục vụ localhost; production dùng standalone/Docker sau reverse proxy.

Dockerfile tạo build stage và runtime standalone non-root, có readiness healthcheck. Build bằng `docker build -t itrms:0.5.0 .`; truyền secret khi chạy bằng secret manager/env runtime, không qua build arguments. Image runtime không có Prisma CLI, PostgreSQL tools hoặc seed; release/maintenance job riêng dùng source checkout đầy đủ. Chưa build/chạy Docker trong môi trường hiện tại vì không có Docker CLI. Linux CI cũng chưa có run từ remote; workflow đã được tạo nhưng không đồng nghĩa CI đã chạy.

Kiểm tra `/api/health` (liveness) và `/api/health?check=ready` (DB/query/schema Phase 5). Endpoint chỉ trả status, không lộ URL/credential. Readiness lỗi trả 503. Cấu hình DB connect/query timeout ở hạ tầng phù hợp, theo dõi latency; health không kiểm chứng mọi quyền ghi.

## Backup và restore

Cần PostgreSQL client tools có major tương thích server (pg_dump không cũ hơn server); đặt `PG_BIN` tới thư mục chứa `pg_dump`/`pg_restore` nếu chưa có trong PATH. Embedded Postgres trong workspace hiện chỉ có server/initdb, không có hai client tool này.

```powershell
npm run db:backup -- .tools/backups/before-release.dump
# Tạo database đích trống riêng bằng công cụ quản trị trước.
$env:RESTORE_DATABASE_URL = '<URL từ secret manager cho database trống>'
npm run db:restore -- .tools/backups/before-release.dump --confirm-empty-target
```

Script không truyền password vào argv, không in stderr có thể chứa credential, không ghi đè file backup đã có. Restore từ chối database nguồn và database đích có table/view/sequence; dùng single transaction, không `--clean`. Restore không tự tạo/drop database. Khi lỗi, giữ dump để điều tra; file dump có thể chưa đầy đủ nếu backup thất bại, không coi tồn tại file là backup thành công.

Sau restore, đối chiếu migration, số nhân viên/dự án/allocation/demand/audit, chạy readiness và HTTP smoke trên môi trường phục hồi. Kiểm tra trigger append-only và case capacity/forecast đại diện. Mã hóa backup, giới hạn truy cập, retention theo chính sách, lưu một bản ngoài host; xác định RPO/RTO và lịch diễn tập. **Chưa thực hiện restore drill ở phase này vì máy không có pg_dump/pg_restore.** Không đánh dấu production ready trước khi có bằng chứng diễn tập.

Rollback ứng dụng bằng image trước nếu schema vẫn tương thích; migration thêm cột/bảng Phase 5 tương thích cấu trúc đọc cũ, nhưng quay lại app trước Phase 5 sẽ mất kiểm tra sessionVersion nên không làm vậy khi đang xử lý sự cố thu hồi phiên. Không tự xóa migration/bảng để rollback dữ liệu; cần DBA lập kế hoạch restore/PITR trên DB riêng, xác minh rồi mới chuyển kết nối.

## Giám sát, phiên và sự cố

- Theo dõi readiness, HTTP 5xx/409/429, latency, số kết nối/lock DB, dung lượng, audit tăng trưởng và thời gian import. Error response không trả SQL/stack trace, log server chỉ tên lỗi; cần kết nối log/metrics có request ID ở gateway trước production.
- Login giới hạn 10 lần/email/15 phút, counter atomic trong PostgreSQL dùng chung nhiều process; key SHA-256 email, lỗi DB fail closed 503. Vẫn cần rate limit IP/global ở gateway để giảm brute force và tránh tạo nhiều key qua email ngẫu nhiên. Dọn `LoginThrottle` hết hạn bằng scheduled maintenance theo chính sách retention; không xóa AuditLog.
- JWT 8 giờ, HttpOnly/SameSite, Secure khi production. `sessionVersion` kiểm tra mỗi lần đọc user. Thu hồi toàn bộ phiên: `npm run auth:revoke -- admin-email target-email`; lệnh ghi audit, dùng operator credential tin cậy. Đây là công cụ vận hành trực tiếp DB, không phải cơ chế đăng nhập bằng email actor; quyền OS/DB của operator là ranh giới bảo mật. Logout hiện xóa cookie; token đã sao chép cần revoke version/disable user hoặc xoay secret để thu hồi.
- Preview import 10 phút, ký số gắn actor, không lưu file/token trong DB. Sửa dữ liệu hoặc serialization conflict → 409, xem trước lại. Lặp cùng token đã commit trả batch cũ; token hết hạn vẫn phải preview lại. Audit từng dòng và batch là bằng chứng truy vết, không chứa file gốc. Chưa có lịch purge ImportBatch/AuditLog; áp dụng retention hợp lệ bằng quy trình DBA riêng.
- Excel snapshot không phải workbook tính toán lại khi đổi ô: công thức nghiệp vụ chạy trên server tại lúc xuất. Nhập Planned quá capacity được phép; UI nhắc kiểm tra matrix. Không import demand, skill, calendar hoặc user trong v0.5.

## Điều kiện release còn cần xác minh

Kiểm chứng bằng môi trường đích: Docker/CI Linux, browser E2E đầy đủ gồm file import/download và responsive, đo tải import/report/max-flow, restore drill/PITR, TLS/headers/gateway limits, quyền runtime DB, provision tài khoản thật và quan sát vận hành. SSO/MFA/reset password và UI quản trị người dùng vẫn ngoài phạm vi hiện tại. Các mục này là việc còn lại, không phải chức năng đã hoàn thành chỉ vì có runbook.
