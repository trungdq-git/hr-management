# Phase 4 – Resource Forecast · v0.4.0

Ngày bàn giao: 17/10/2026. Phạm vi triển khai tiếp trên Phase 1–3, giữ nguyên 30 nhân viên và 8 dự án giả. Không dùng dữ liệu nhân sự thật.

## Chức năng hoàn thành

- `/forecast`: chọn tháng bắt đầu, cửa sổ 6 tháng xuyên năm, chọn Conservative/Base/Optimistic và tháng phân tích; tổng quan, demand, cấu hình xác suất, trạng thái thiếu dữ liệu và cảnh báo.
- Nhập tổng nhu cầu dự án/tháng và các phần công việc theo kỹ năng chính/proficiency. Phần dư dùng bộ requirement nền của dự án theo AND. Không suy demand từ contracted MM, forecast MM vòng đời, allocation hoặc required MM Phase 3.
- Pipeline raw, Pipeline có trọng số và Confirmed hiển thị riêng. Không có xác suất mặc định; null khác 0. Xác suất có version và thứ tự Conservative ≤ Base ≤ Optimistic. Thiếu lịch/demand/xác suất không được coi là 0.
- Supply từ engine capacity hiện có; Resource Gap, Skill Gap, Capability Shortfall, Staffing Gap, danh sách nhân viên có thể điều phối và nhu cầu tuyển theo peak 6 tháng. Ngân sách MM từng người không được dùng trùng giữa các kỹ năng/dự án. Gợi ý điều phối chỉ dùng phần còn rảnh sau toàn bộ cam kết và không tự sửa phân bổ.
- Dashboard có Capacity vs Allocation vs Demand, Utilization Trend, Resource Distribution by Project, Skill Distribution và Resource Gap 6 tháng. Bộ lọc supply/demand có chú thích phạm vi; kỹ năng đếm người có rating, không phải MM.
- API có RBAC/Origin, validation, version/conflict 409, khóa hàng và audit before/after cùng transaction. VIEWER xem được chi tiết demand nhưng không ghi. Khởi tạo ba scenario idempotent; không tự nhập xác suất.
- Migration thứ năm thêm MonthlySkillDemand, ràng buộc tổng MM kỹ năng bằng deferred trigger, version demand/probability và unique scenario kind. Đã áp dụng vào database demo hiện có; không reset. Prisma báo 5 migration đã cập nhật và schema diff không khác biệt.
- Seed forecast riêng cho 10/2026–03/2027, có audit, giữ bản ghi đã chỉnh sửa/kể cả xác suất đã xóa; không tạo thêm nhân sự/dự án. Đã chạy thành công trên database demo.

## Kết quả kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| ESLint | Đạt |
| TypeScript `tsc --noEmit` | Đạt |
| Next.js production build | Đạt |
| Unit test | 56/56 đạt, gồm 19 test forecast/max-flow/validation |
| Integration PostgreSQL thật | 44/44 đạt, gồm 10 test Phase 4 |
| Tổng test | **100/100**, 7 file |
| HTTP trên bản production port 3001 | Login/redirect, 14 trang/chế độ, history/search/forecast API và logout đạt |
| Migration status và schema diff | 5 migration up to date; không có khác biệt |
| Browser QA | Chưa thực hiện: phiên công cụ không có browser/app khả dụng |

Unit test bao phủ thiếu dữ liệu/null/0, pipeline và confirmed, ngày vào/nghỉ việc không giao dự án, trạng thái dự án, rounding 4 số, bảo toàn tổng MM khi chia, bài toán specialist/generalist, đa kỹ năng, cam kết ngoài phạm vi, quá tải và tuyển theo peak. Integration dùng PostgreSQL riêng trên cổng tạm do OS cấp, migrate/seed thật, chỉ mock cookie boundary. Có kiểm tra quyền/Origin, ghi đồng thời/version, audit rollback, tổng MM con ở database, archive skill dependency, thứ tự xác suất và seed không ghi đè. Bộ regression Phase 1–3 vẫn đạt.

HTTP smoke kiểm tra thêm ba kịch bản × sáu tháng và Resource Gap bằng đơn vị 0.0001 MM. Đây là kiểm tra HTTP/SSR, chưa xác minh trực quan đồ thị, tương tác dialog hoặc responsive trong trình duyệt. Preview riêng đã được dừng sau kiểm tra; database và dịch vụ có sẵn không bị dừng.

## Cách xem demo

Giữ `.env` và database hiện có; chạy `npm run db:generate`, `npm run db:migrate`. Với demo mới, chạy lần lượt `db:seed`, `db:seed:planning`, `db:seed:capabilities`, `db:seed:forecast`, rồi `npm run dev`. Mở `/forecast?month=2026-10` và Dashboard với tháng 10/2026. Khởi động lại server cũ để nạp client/build mới. Chi tiết trong [README](../README.md).

## Chưa hoàn thành và giới hạn

Phase 5 chưa triển khai: Excel import/export, báo cáo tổng hợp, giao diện Audit Log chung và production readiness. Audit quan trọng đã được lưu nhưng chưa có trang tra cứu chung.

Forecast là mô hình MM theo tháng. Chặn gợi ý khi thời gian làm việc và dự án không giao nhau; dự án bắt đầu/kết thúc giữa tháng có cảnh báo, vẫn cần kiểm tra lịch ngày trước khi chốt. Chưa có bộ tối ưu lịch ngày, đóng sổ hoặc snapshot forecast bất biến. Kết quả dùng trạng thái dự án, rating và dữ liệu hiện tại; không phải truy vấn lịch sử tại một thời điểm. Đọc nhiều nguồn chưa đóng trong một snapshot transaction duy nhất.

Requirement nền dự án áp dụng AND cho mọi phần công việc. Các dòng kỹ năng chính phải là phần MM không chồng lặp. Nếu chưa định danh năng lực, Skill Gap chưa xác định; chỉ báo thiếu MM thuần như cận dưới và không công bố số đầu người. Quy đổi 1 MM/người/tháng là giả định minh bạch; số làm tròn không chứng minh một người mới đáp ứng mọi tổ hợp kỹ năng. Residual theo profile là một nghiệm max-flow, không phải phân rã duy nhất hay quyết định tuyển tự động.

Xác suất tạo kỳ vọng theo từng dự án, chưa mô hình tương quan hoặc phân phối rủi ro giữa các Pipeline. Chưa dự báo học tập, attrition hoặc tuyển mới đã lên kế hoạch. Chưa đo tải production với đội ngũ lớn; các giới hạn auth/observability/backup đã ghi trong README vẫn còn. Skill có tham chiếu demand không được archive, kể cả demand lịch sử, nhằm giữ định danh năng lực.

## Phase tiếp theo

Phase 5 – Reporting: mẫu Excel và import preview/validation/transaction, export dữ liệu và báo cáo, Audit Log có bộ lọc, browser E2E, kiểm tra hiệu năng, backup/restore và hardening trước production.
