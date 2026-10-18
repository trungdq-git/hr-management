# DX Service – IT Resource Management System

Ứng dụng quản lý nguồn lực IT Outsourcing, giao diện tiếng Việt, Enterprise SaaS Navy/White/Orange. **Đã triển khai Phase 1–5, đến Reporting, Excel và các công cụ chuẩn bị production (v0.5.0)**. Các kiểm chứng hạ tầng trước release được ghi riêng trong runbook.

## Stack

Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, shadcn/ui Button (Radix Slot/CVA), Recharts 3, PostgreSQL, Prisma 7 (pg driver adapter), Zod, bcrypt, JOSE, ExcelJS/yauzl và Vitest 5. `package-lock.json` khóa phiên bản thực tế; dùng `npm ci` để tái lập. Dùng Node.js 24 LTS, npm 11. PostgreSQL 17+.

Tài liệu chính thức đã đối chiếu: [Next.js](https://nextjs.org/docs/app), [Prisma 7](https://www.prisma.io/docs/orm/v7), [embedded-postgres](https://github.com/leinelissen/embedded-postgres). Package embedded-postgres là tiện ích **dev/test** có nhãn beta; ứng dụng dùng Prisma + pg chuẩn và PostgreSQL Docker/managed trong môi trường triển khai.

## Chức năng Phase 1

- Đăng nhập/đăng xuất, session 8 giờ, cookie HttpOnly/SameSite, RBAC ở server. ADMIN/MANAGER tạo/sửa; VIEWER chỉ đọc. Kiểm tra trạng thái user ở mỗi lần truy cập bảo vệ.
- Danh sách nhân viên: tìm tên/mã/email, lọc vị trí/trạng thái/địa điểm, phân trang, tạo/sửa hồ sơ, chi tiết kỹ năng và dự án đã tham gia. Không xóa lịch sử.
- Danh mục dự án: tìm kiếm, lọc 5 trạng thái, tạo/sửa, gán PM hợp lệ, theo dõi contracted/forecast MM tổng vòng đời.
- Dashboard: tháng/dự án/vai trò/địa điểm, headcount theo ngày vào/nghỉ việc, dự án trong tháng, biểu đồ vai trò và trạng thái danh mục. MM được đọc từ dữ liệu thực; capacity cần lịch đầy đủ, không suy diễn từ headcount. Khi lọc dự án, chọn nhân sự có assignment vào dự án nhưng vẫn dùng tổng allocation của họ để không che khuất quá tải. Khi lọc vai trò/địa điểm, danh mục chỉ gồm dự án có assignment phù hợp.
- Mô hình cho 5 phase, CHECK constraints, unique tháng/assignment, FK RESTRICT, Audit Log before/after trong cùng transaction và trigger append-only.
- Loading/empty/error states, menu mobile, bảng cuộn ngang, form dialog có validation ở server.
- Demo nền tảng: **30 nhân viên giả, 8 dự án, 3 user**, 10 kỹ năng và assignments. `db:seed` chỉ tạo dữ liệu Foundation. Seed Resource Planning là lệnh riêng bên dưới; không tạo forecast/demand giả.

## Chức năng Phase 2

- **Capacity Planning `/capacity`**: tạo lịch, chọn tháng, nhập ngày công chuẩn, fraction ngày làm việc 0–1 và ghi chú lễ/nghỉ bù. Nút điền mẫu T2–T6 có chủ đích; không tự áp ngày lễ theo luật.
- **Capacity nhân viên**: gán lịch và tỷ lệ cho từng nhân viên/tháng hoặc cả danh sách; bulk giữ tỷ lệ riêng, ghi trong transaction. Theo dõi ngày khả dụng, Capacity/Planned/Actual/Available/Utilization, chưa phân bổ và vượt capacity.
- **Phép & không khả dụng**: mỗi nhân viên/ngày có fraction 0–1 và loại LEAVE/UNAVAILABLE; đặt 0 để hủy, giữ bản ghi có version mới và audit. Nghỉ cuối tuần/ngày lễ không bị trừ thêm.
- **Allocation Matrix `/allocations`**: cửa sổ 6 tháng xuyên năm, hàng nhân viên/cột tháng, xem theo nhân viên hoặc dự án. Tìm/lọc vai trò, địa điểm, dự án và cảnh báo; MM/% chuẩn; nhấn ô để ghi Planned hoặc Actual riêng.
- Mỗi nhân viên có thể ở nhiều dự án. Chấp nhận tổng allocation > capacity và tô cảnh báo rõ; không dùng pipeline như allocation đã cam kết. Chưa nhập actual là “—”, khác đã nhập 0. Tổng actual là tổng công đã ghi nhận, không suy từ planned.
- **Lịch sử** Planned/Actual theo nhân viên/tháng, snapshot trước/sau, người sửa, thời gian Việt Nam; tối đa 100 thay đổi gần nhất. API có bộ lọc project. Thay đổi lịch, setting, absence cũng có audit, giao diện tra cứu audit tổng quát dành Phase 5.
- Kiểm tra version cho từng loại ghi, row lock tránh ghi đè khi sửa đồng thời; xung đột trả 409. Audit và dữ liệu ghi cùng transaction. Migration thứ ba nâng cấp dữ liệu Phase 1 mà không reset database.
- Dashboard và Employee Detail dùng chung engine capacity. **Không có calendar đầy đủ → capacity chưa xác định; ngoài khoảng ngày làm việc cả tháng → capacity 0.**

## Chức năng Phase 3

- **`/skills` · Skill Matrix**: bảng nhân viên × kỹ năng theo 8 nhóm, proficiency 1–5; tìm theo nhân viên/kỹ năng, lọc nhóm/vị trí, chọn tháng đối chiếu available MM. Bấm ô để thêm/sửa/gỡ/khôi phục rating. Ô “—” chưa đánh giá hoặc đã gỡ, khác mức 1. Kỹ năng là hồ sơ hiện tại, không phải snapshot theo tháng.
- **Danh mục kỹ năng**: tạo/sửa tên và nhóm; lưu trữ/khôi phục, tìm/lọc, xem số nhân viên có rating và dự án đang yêu cầu. Tên duy nhất không phân biệt hoa/thường; trim và gộp whitespace. Không archive khi còn requirement có hiệu lực, kể cả dự án đã kết thúc; cần gỡ requirement rõ ràng trước.
- **Tìm nhân sự**: AND/OR cho các kỹ năng bổ sung, ngưỡng riêng 1–5; kết hợp tên/mã/vị trí/địa điểm, employee level 1–6, JLPT tối thiểu và available MM theo tháng từ engine Phase 2. JLPT N2 nhận N1/N2; NONE chỉ nhận chưa có chứng chỉ. Japanese Communication vẫn là kỹ năng độc lập.
- **Khả dụng**: AVAILABLE yêu cầu capacity biết và available > 0. KNOWN nhận cả quá tải nếu ngưỡng MM=0; ANY nhận cả thiếu lịch nếu ngưỡng=0. Ngưỡng > 0 luôn yêu cầu available MM đã biết và đạt ngưỡng. Không coi thiếu lịch là có sẵn nguồn lực. Kết quả sắp theo available giảm dần, giữ tổng allocation mọi dự án, có liên kết sang matrix đã lọc nhân viên.
- **`/projects/[id]` · Yêu cầu kỹ năng**: proficiency tối thiểu, MM ước tính theo kỹ năng toàn dự án, trạng thái có hiệu lực/gỡ. Liên kết từ tên dự án trong Portfolio. Nút tìm nhân sự áp dụng mọi requirement dự án theo AND, độc lập chế độ OR cho kỹ năng bổ sung. Dự án chưa có yêu cầu sẽ cảnh báo chưa đủ cơ sở xác minh phù hợp.
- **Lịch sử và quyền**: version tăng khi sửa/gỡ/khôi phục, row lock tránh lost update, snapshot before/after và audit cùng transaction; ADMIN/MANAGER được ghi, VIEWER đọc/tìm kiếm. Không xóa rating/requirement, không tự tạo allocation từ kết quả matching.
- Migration thứ tư nâng cấp Skill/EmployeeSkill/ProjectSkillRequirement, giữ mọi dữ liệu trước đó. Employee Detail chỉ hiển thị rating/catalog còn hiệu lực và có link cập nhật matrix. Chưa có history UI chung cho kỹ năng (audit được lưu để Phase 5 tra cứu).

## Chức năng Phase 4

- **`/forecast`**: dự báo cửa sổ 6 tháng xuyên năm; nhập tổng demand dự án/tháng, các phần công việc theo kỹ năng chính và proficiency tối thiểu. Tổng MM kỹ năng không vượt demand; kiểm tra cả ở PostgreSQL.
- **Conservative / Base / Optimistic**: cấu hình xác suất từng Pipeline, kiểm tra thứ tự tăng dần. Chưa nhập khác 0%; không tự gán xác suất. Confirmed và Pipeline luôn riêng biệt; chỉ Weighted Pipeline tham gia tổng kỳ vọng.
- **Supply, Resource Gap, Skill Gap và Staffing Gap**: dùng capacity Phase 2, hồ sơ kỹ năng Phase 3; thiếu lịch/demand/xác suất được báo rõ và không đổi thành 0. Demand là tổng nhu cầu, đã gồm phần allocated; không cộng allocation lần nữa.
- **Điều phối và tuyển dụng**: max-flow giữ ngân sách MM từng người, tránh đếm trùng đa kỹ năng; gợi ý chỉ dùng MM còn rảnh sau mọi cam kết. Tuyển dụng dựa trên thiếu hụt năng lực khi có thể bố trí lại toàn bộ capacity; lấy đỉnh 6 tháng, không cộng các tháng. Quy đổi 1 MM/người/tháng chỉ là giả định; chưa đủ hồ sơ kỹ năng thì không công bố đầu người.
- **Dashboard**: Capacity/Allocation/Demand, Utilization Trend, phân bổ theo dự án, phân bố kỹ năng và Resource Gap 6 tháng. Bộ lọc vai trò/địa điểm thu hẹp supply; demand vẫn là tổng nhu cầu các dự án trong phạm vi, không tự chia theo vai trò/địa điểm. Biểu đồ kỹ năng đếm người có rating, không phải MM.
- ADMIN/MANAGER ghi, VIEWER đọc cả chi tiết demand; version chống ghi đè, audit before/after cùng transaction. Migration thứ năm nâng cấp dữ liệu hiện có, không reset database.

## Chức năng Phase 5

- **`/reports`**: tổng hợp 6 tháng Headcount/Capacity/Planned/Actual/Available/Utilization, thiếu lịch và quá tải; lọc tháng bắt đầu, dự án, vai trò, địa điểm. Export XLSX nguồn lực, forecast ba kịch bản, nhân viên, dự án, Planned và Actual. File là snapshot tại lúc xuất, không phải workbook tự tính lại sau khi sửa ô.
- **Excel import**: template riêng cho Employee/Project/Planned/Actual; xem trước và lỗi từng dòng, bắt buộc mọi dòng hợp lệ. Tham chiếu bằng mã nghiệp vụ; mã có sẵn cập nhật, mã mới tạo mới. Planned/Actual cùng quy tắc và audit Phase 2. Không import demand/kỹ năng/user/lịch trong phiên bản này.
- Chỉ XLSX tối đa 2 MiB, 200 dòng; kiểm tra ZIP giải nén tối đa 16 MiB/128 entry. Không nhận công thức, macro, hyperlink, external link hoặc embedded object. Blank khác 0, không tự biến ô MM trống thành số 0.
- Preview ký số gắn tài khoản, hạn 10 phút, chứa fingerprint dữ liệu/tham chiếu. Commit xác minh lại trong transaction Serializable; dữ liệu đổi trả 409. Toàn bộ file, audit từng dòng và batch ghi cùng transaction; retry cùng token đã commit trả batch cũ. Không lưu file/token vào DB.
- **`/audit`**: ADMIN/MANAGER tra cứu theo actor/entity/action/ngày giờ Việt Nam, 30 bản ghi/trang, xem before/after; lọc phòng vệ password/token/secret. VIEWER được xem/export báo cáo nhưng không xem audit hoặc import.
- Production preparation: login throttle PostgreSQL chia sẻ giữa process, sessionVersion và CLI thu hồi phiên, security headers, no-store API, liveness/readiness, kiểm tra cấu hình, script backup/restore an toàn, Docker standalone non-root và CI workflow. Xem [runbook](docs/production-runbook.md) về quyền DB, TLS, restore, rollback và các việc cần xác minh trước release.

## Chạy localhost

### 1. Cài dependency và cấu hình

```powershell
npm ci
npm run setup:local
npm run db:generate
```

`setup:local` tạo `.env` với secret ngẫu nhiên và cấu hình demo, không ghi đè file hiện có. Có thể tự sao chép `.env.example` thành `.env`, đặt DATABASE_URL, SESSION_SECRET ngẫu nhiên >= 32 ký tự và SEED_DEMO_PASSWORD 12 ký tự trở lên (tối đa 72 byte). Không commit `.env`.

Workspace hiện có Node portable tại `.tools/node-v24.22.0-win-x64`. Nếu `node` chưa có trong PATH, chạy đầu mỗi terminal:

```powershell
$env:Path = "$PWD\.tools\node-v24.22.0-win-x64;$env:Path"
```

### 2. Khởi động PostgreSQL (chọn một cách)

**Docker (khuyến nghị)**:

```powershell
docker compose up -d db
```

Hoặc **PostgreSQL local trong workspace**, không cần Docker, giữ terminal này mở:

```powershell
npm run db:local
```

Database local giữ dữ liệu tại `.tools/local-postgres`; Ctrl+C dừng server và giữ dữ liệu. Chỉ bind 127.0.0.1. Nếu dịch vụ đúng DATABASE_URL đã chạy, script thông báo tái sử dụng và thoát. Không khởi động Docker trên port đã có dịch vụ khác. Nếu dùng PostgreSQL có sẵn, cấu hình DATABASE_URL tương ứng.

### 3. Migration, seed và ứng dụng (terminal thứ hai)

```powershell
npm run db:migrate
npm run db:seed
npm run db:seed:planning
npm run db:seed:capabilities
npm run db:seed:forecast
npm run dev
```

Truy cập **http://127.0.0.1:3000**. `db:seed:planning` là tùy chọn cho demo: tạo lịch/tháng 10/2026–03/2027, capacity, planned, actual tháng 10, ngày nghỉ mẫu, một nhân viên đa dự án vượt capacity và nhân viên chưa phân bổ. Tất cả thay đổi seed Phase 2 có audit; chạy lại không ghi đè dữ liệu đã có. Lịch demo không đại diện lịch lễ pháp định. Để tự cấu hình từ trống, bỏ qua lệnh này. Không dùng seed demo trên dữ liệu thật.

`db:seed:capabilities` là tùy chọn demo Phase 3: bổ sung rating và yêu cầu cho 6 dự án giả từ Foundation, không ghi đè rating/yêu cầu đã có (kể cả đã gỡ), không tạo thêm nhân viên/dự án. Mọi ghi có audit và bị chặn trong production. Seed không thay đổi level/JLPT và không seed demand/forecast. Để demo tìm kiếm có capacity, chạy seed planning trước.

`db:seed:forecast` bổ sung demand 10/2026–03/2027 và xác suất rõ ràng cho ba kịch bản, dùng 30 nhân viên/8 dự án giả sẵn có. Chạy sau seed planning/capabilities để có đủ đầu vào. Seed có audit, không ghi đè demand/xác suất đã có (kể cả xác suất đã xóa), bị chặn trong production. Mở `/forecast?month=2026-10` để xem demo.

Với workspace đã chạy Phase 1/2/3: giữ `.env` và database, chạy `npm run db:generate`, `npm run db:migrate`, rồi các seed bổ sung nếu cần demo. Nếu server cũ đang chạy, dừng và khởi động lại để nạp build/client mới; không chạy `next dev` và `next build` đồng thời trên cùng checkout. Nếu port 3000 bận, dùng `npm run dev -- --port 3001`.

Tài khoản demo:

| Email | Quyền |
| --- | --- |
| admin@example.test | ADMIN |
| manager@example.test | MANAGER |
| viewer@example.test | VIEWER |

Mật khẩu theo SEED_DEMO_PASSWORD. Với `setup:local`, mặc định demo là `DxService-Demo-2026!`. Chỉ dùng localhost. Seed chạy lặp không ghi đè hồ sơ đã sửa hoặc mật khẩu user đã có; đổi biến môi trường không tự đổi mật khẩu tài khoản cũ. Seed bị chặn nếu NODE_ENV=production.

### 4. Kiểm tra

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Integration test tự tạo một cluster **PostgreSQL thật** riêng trên **cổng localhost tạm do OS cấp**, chạy `prisma migrate deploy`, seed hai lần và gọi API handlers/Prisma thật. Chỉ mock cookie boundary `next/headers`, không mock database, password hashing hoặc session signing. Cluster dừng sau test; thư mục tạm được giữ trong `.tools/pg-test-*` để kiểm tra và tránh xóa nhầm dữ liệu. Vitest tự cấp DATABASE_URL cho database test riêng, không dùng DATABASE_URL cá nhân. Windows sandbox có thể cần quyền chạy process/đọc OS user; chạy terminal bình thường ngoài sandbox trong trường hợp đó. Cổng động giúp tránh xung đột với lần chạy test khác; lỗi startup giữ log để chẩn đoán.

Khi dev server và database đang chạy, kiểm tra HTTP qua Next runtime:

```powershell
npm run test:http
```

Lệnh này dùng tài khoản demo trong `.env`; kiểm tra login, redirect, 16 trang/chế độ, API history/resource search/forecast/reporting, tải XLSX, readiness/security headers và logout. Có thêm audit LOGIN; không thay đổi hồ sơ nhân viên/dự án. Khi dùng port khác, đặt `$env:SMOKE_ORIGIN='http://127.0.0.1:3001'` trước khi chạy. Browser smoke Phase 5 đã kiểm tra luồng export/import một dòng demo và Audit Log; chưa phải bộ E2E tự động đầy đủ.

Bộ kiểm tra Phase 1–5 đạt **127/127: 68 unit và 59 integration PostgreSQL thật**, bao phủ MM/capacity/matching/forecast, XLSX parser, production preflight, CRUD/RBAC, version/concurrency, audit rollback, seed, import atomic/idempotent và đối chiếu báo cáo. Kết quả ghi trong [báo cáo Phase 5](docs/phase-5-report.md). HTTP smoke kiểm tra thêm báo cáo, Audit Log, download XLSX, readiness và security headers.

Build production local: `npm run build`, sau đó `npm start` (hoặc `npm start -- --port 3001`). Dev/build dùng Webpack do lỗi subprocess CSS Turbopack trên Windows hiện tại; không cần đổi framework. Script start nạp `.env`, sao chép static vào standalone và phục vụ loopback. Docker chạy standalone trực tiếp, bind 0.0.0.0 sau reverse proxy. Cookie Secure khi NODE_ENV=production; môi trường triển khai phải dùng HTTPS. Không triển khai các tài khoản hoặc mật khẩu demo lên Internet.

Kiểm tra trước production và công cụ vận hành:

```powershell
npm run check:production
npm audit --omit=dev --audit-level=moderate
npm run db:backup -- .tools/backups/before-release.dump
# Restore chỉ vào database trống riêng, theo docs/production-runbook.md.
```

## Cấu trúc

```text
src/app/(workspace)/   Dashboard, employees, projects, capacity, allocations, skills, forecast, reports, audit, settings
src/app/api/           Auth và API tạo/sửa được bảo vệ
src/components/        Shell, biểu đồ, planning/capability/forecast UI, form/bảng và shadcn/ui
src/lib/               Auth, validation, services, capacity/MM, Prisma
prisma/                Schema, migration và seed demo
tests/                 Unit và integration PostgreSQL
scripts/               Setup demo, database local, HTTP smoke
docs/                  Kiến trúc/ERD và báo cáo phase
```

Xem [thiết kế kiến trúc, ERD, quy tắc và lộ trình](docs/architecture.md), [thiết kế Phase 2](docs/phase-2-design.md), [thiết kế Phase 3](docs/phase-3-design.md), [báo cáo Phase 1](docs/phase-1-report.md), [báo cáo Phase 2](docs/phase-2-report.md), [báo cáo Phase 3](docs/phase-3-report.md).

## Quy tắc dữ liệu

Tháng là DATE ngày 01, không dùng tên tháng hoặc index không có năm. MM Decimal(12,4), hiển thị tối đa 2 số. Allocation/Actual/Demand >= 0; allocation có thể vượt capacity và phải cảnh báo. Capacity = ngày khả dụng/ngày công chuẩn; Available = Capacity − tổng allocation; Utilization null nếu Capacity=0. Nghỉ phép, lễ, ngày vào/nghỉ việc và tỷ lệ tham gia ảnh hưởng capacity. Chưa đủ lịch thì không công bố số capacity toàn bộ. Schema không lưu capacity tổng hợp dư thừa.

Tỷ lệ tham gia lưu theo tháng trong EmployeeCapacitySetting, thay đổi tháng mới không thay đổi cấu hình tháng cũ. Migration snapshot lịch/tỷ lệ hiện có cho những tháng đã có lịch ở Phase 1; Employee.calendarId vẫn là fallback dữ liệu cũ. Sửa lịch/phép hồi tố sẽ tính lại capacity và lưu audit, chưa có đóng sổ. Ngày nghỉ đã hủy giữ fraction=0 để tránh reset version khi tạo lại.

100% allocation = 1 MM theo ngày công chuẩn, không phải 100% capacity sau ngày nghỉ. Capacity 0 vẫn phát hiện allocation dương; utilization hiển thị “Không áp dụng”. Chưa có lịch vẫn được nhập phân bổ nhưng cảnh báo chưa đủ dữ liệu để đánh giá quá tải. MM hiển thị 2 số, nên dùng ô chi tiết/giá trị nhập để xử lý chênh lệch rất nhỏ ở 4 số.

Forecast MM trên dự án là ước tính tổng vòng đời do người dùng nhập, không lấy thay cho MonthlyProjectDemand. MM trong yêu cầu kỹ năng cũng không phải monthly demand và không được cộng qua các kỹ năng (có thể chồng lặp cùng một người). Forecast Phase 4 dùng demand tháng và xác suất nhập rõ ràng; pipeline vẫn tách biệt, không tự gán xác suất. Pipeline không nhận Planned/Actual dương; Cancelled chỉ cho điều chỉnh actual lịch sử hoặc đưa planned về 0. Tháng ghi effort dương phải có thời gian giao nhau giữa nhân viên, dự án và tháng.

## Giới hạn và triển khai sau

Chưa xác nhận production-ready: chưa có password reset, MFA/SSO, UI quản trị tài khoản, session revocation theo từng thiết bị và observability đầy đủ. Login throttle theo email đã lưu PostgreSQL, dùng chung nhiều process; vẫn cần gateway rate limit theo IP/global. JWT đăng xuất bằng xóa cookie; CLI `npm run auth:revoke -- admin-email target-email` tăng sessionVersion để thu hồi toàn bộ phiên của tài khoản, có audit. Operator cần quyền OS/DB phù hợp; lệnh không xác thực actor bằng mật khẩu. Xem runbook cho restore drill, Docker/CI và browser coverage thực tế.

App không có DELETE cho dữ liệu nhân sự/dự án. Trạng thái RESIGNED cần exitDate; những assignment cũ được giữ. Audit trigger chặn UPDATE/DELETE, nhưng production cần DB role giới hạn quyền (không dùng superuser), bảo vệ migration và chính sách lưu trữ riêng. Reverse proxy cần giữ Host/protocol công khai nhất quán để kiểm tra Origin. Excel import/export Phase 5 đã có giới hạn và validation; chưa hỗ trợ XLS/XLSM/CSV hoặc import mọi module.

Giới hạn Phase 2: chưa có khóa đóng sổ tháng, mass-edit/copy allocation, workflow phê duyệt nghỉ phép và browser E2E. Dữ liệu hiện tải theo cửa sổ tháng cho bộ demo 30 người; cần pagination/virtualization ở server và đo hiệu năng khi triển khai quy mô lớn. Assignment giữ suốt vòng đời, không có DELETE; phân bổ/actual được đưa về 0 để hủy và giữ lịch sử.

Giới hạn Capability: hồ sơ kỹ năng là trạng thái hiện tại, không có chứng nhận/chu kỳ phê duyệt hay snapshot hiệu lực theo tháng. Audit lưu thay đổi nhưng chưa có UI timeline kỹ năng. Search trên một tháng không chứng minh cùng người đáp ứng MM cả giai đoạn hoặc đủ headcount; đây là dữ liệu đầu vào để quản lý quyết định phân bổ. Cần đo tải/phân trang search phía server cho đội ngũ lớn.

Giới hạn Forecast: mô hình MM tháng, chưa tối ưu lịch từng ngày; dự án bắt đầu/kết thúc giữa tháng cần rà soát lịch trước khi chốt. Dùng trạng thái dự án và rating hiện tại, chưa có snapshot forecast bất biến hoặc dự báo học tập/attrition. Mọi requirement dự án là bộ kỹ năng nền AND; phần công việc theo kỹ năng chính không chồng MM. Chưa định danh kỹ năng thì chỉ nêu thiếu MM thuần như cận dưới, không suy đầu người. Chưa đo tải production cho bộ tối ưu và bảng lớn.

Xem [thiết kế Phase 4](docs/phase-4-design.md) và [báo cáo Phase 4](docs/phase-4-report.md).

Xem [thiết kế Phase 5](docs/phase-5-design.md), [báo cáo Phase 5](docs/phase-5-report.md) và [runbook production](docs/production-runbook.md). Tiếp theo là UAT và kiểm chứng hạ tầng: Docker/CI Linux, restore drill, tải lớn, quyền runtime DB, TLS/gateway và các luồng browser E2E còn lại. Chưa triển khai lên Internet.
