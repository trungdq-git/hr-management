# Phase 4 – Resource Forecast

## Kiến trúc và thứ tự

Giữ Next.js/Prisma/PostgreSQL. Bổ sung `forecast-*` cho validation, service, dữ liệu, engine thuần và `max-flow.ts` cho phân phối MM chống đếm trùng. `/forecast` có tổng quan, demand và kịch bản. Capacity luôn lấy từ engine Phase 2, năng lực hiện tại từ Phase 3. Triển khai schema → demand/probability → engine → UI/dashboard → seed/test/docs.

## Mô hình và dữ liệu

- MonthlyProjectDemand là **tổng nhu cầu dự án/tháng**, gồm cả phần đã allocated, có version. Không lấy contractedMm/forecastMm tổng vòng đời thay demand tháng. Không tự nội suy demand từ hợp đồng hay allocation.
- Thêm MonthlySkillDemand (demandId+skillId unique, requiredMm > 0, minProficiency 1–5). Mỗi dòng là một phần công việc có **một kỹ năng chính**, các MM này không chồng lặp, tổng <= demand tháng. Phần còn lại là công việc chung. Requirement dự án Phase 3 là bộ kỹ năng nền bắt buộc cho mọi ứng viên ở dự án; không biến requiredMm vòng đời thành demand tháng.
- Một nhân viên có thể đáp ứng nhiều dòng nhưng mỗi MM chỉ được dùng một lần. Phần công việc chung cần requirement dự án; nếu chưa có cả kỹ năng chính lẫn requirement thì Skill Gap chưa xác định.
- Ba ForecastScenario duy nhất theo kind Conservative/Base/Optimistic. Xác suất từng Pipeline theo scenario nullable, version tăng khi nhập/xóa; null khác 0. Conservative = kỳ vọng chốt thấp, Optimistic = kỳ vọng chốt cao; chỉ kiểm tra thứ tự các xác suất đã nhập. Không có xác suất mặc định ngầm.
- Ghi demand toàn tháng và các dòng kỹ năng trong một transaction, version ở demand cha; audit giữ toàn bộ before/after khi thay dòng con. Ghi probability khóa project, kiểm tra version và audit. Skill archive bị chặn nếu đang dùng trong demand kỹ năng.

## Chỉ số 6 tháng

- Supply MM = tổng capacity, chỉ công bố tổng đầy đủ khi mọi nhân viên trong thời gian làm việc có lịch đầy đủ; vẫn hiện Known Supply để sửa dữ liệu thiếu. Sau exitDate, capacity 0.
- Confirmed Demand = tổng demand của dự án ACTIVE/CONFIRMED giao tháng. Pipeline Demand = tổng raw demand PIPELINE giao tháng, hiển thị riêng. Completed/Cancelled không tham gia forecast; dữ liệu cũ giữ nguyên. Phân loại theo trạng thái dự án hiện tại, thay trạng thái sẽ phân loại lại forecast hiện tại và được audit ở Project.
- Weighted Pipeline = sum(Pipeline MM × probability scenario). Total Expected = Confirmed + Weighted Pipeline; không đổi chỉ số Confirmed. Resource Gap = Supply − Total Expected; âm là thiếu.
- Mọi dự án ACTIVE/CONFIRMED/PIPELINE giao tháng cần một bản ghi demand (0 là xác nhận không có nhu cầu, khác chưa nhập). Mọi Pipeline cần probability rõ ràng kể cả 0. Thiếu input → tổng liên quan và Resource Gap là null; không giả định 0. Không có Pipeline → Weighted Pipeline 0 mà không cần cấu hình thêm.
- Allocation/Actual hiện riêng, không cộng vào demand. Nếu allocation lớn hơn demand dự án hoặc có phân bổ ngoài phạm vi forecast thì hiển thị cảnh báo, không tự sửa demand.
- Đầu vào MM lưu 4 số. Engine dùng đơn vị 0.0001 MM; pipeline nhân probability 4 số bằng integer/BigInt và làm tròn half-up ở từng project. Dòng kỹ năng nhận phần làm tròn bằng largest remainder để tổng dòng bằng tổng project; không phát sinh MM khi chia.

## Skill Gap, điều phối và tuyển dụng

- Dùng max-flow với source→employee (capacity), employee→work profile nếu đạt kỹ năng chính và toàn bộ requirement dự án, profile→sink (expected demand). Một nhân viên chỉ có một ngân sách capacity nên đa kỹ năng không tạo thêm supply.
- Capability Shortfall = expected demand chưa phủ được trong phương án điều phối toàn bộ capacity. Skill Gap = max(Capability Shortfall − max(expected demand − supply, 0), 0): phần thiếu do tổ hợp năng lực vượt ngoài thiếu MM thuần.
- Đây là phân tích với hồ sơ kỹ năng hiện tại, không dự báo học tập/attrition chưa có dữ liệu. Profile chưa định danh năng lực → Skill Gap null, không khẳng định không thiếu kỹ năng.
- Gợi ý điều phối tôn trọng allocation hiện tại: reserve capacity cho mọi project đang allocated (kể cả ngoài tập demand), thu nhỏ tỷ lệ nếu employee bị overallocated. Trước tiên ghép phần đã reserve vào công việc cùng project. Sau đó max-flow phần free=max(capacity−total planned,0) vào phần còn thiếu. Tổng gợi ý của một employee <= free MM, không dùng lặp employee cho nhiều dự án. Không tự sửa allocation hoặc chuyển phần đã cam kết.
- Staffing Gap là phần còn thiếu sau các allocation phù hợp và gợi ý MM rảnh; có thể lớn hơn Capability Shortfall nếu cam kết hiện tại bố trí chưa phù hợp. Nếu Capability Shortfall=0 nhưng Staffing Gap>0, ưu tiên rà soát điều phối thay vì tuyển tự động.
- Recruitment MM = Capability Shortfall khi dữ liệu đủ; nếu thiếu định danh kỹ năng chỉ nêu mức thiếu MM thuần từ Resource Gap. Đầu người quy đổi = ceil(MM thiếu / 1 MM/người/tháng), là giả định minh bạch, không phải quyết định tuyển. Kế hoạch 6 tháng lấy **peak** chứ không cộng các tháng hoặc tổng peak từng skill.
- Khi chưa đủ hồ sơ kỹ năng, không công bố số đầu người; peak MM thiếu thuần vẫn là cận dưới. Quy đổi MM/người không khẳng định một người mới đáp ứng mọi tổ hợp kỹ năng khác nhau.
- Không đề xuất nhân viên nếu khoảng join/exit và thời gian dự án không có ngày giao nhau trong tháng. Đây là mô hình MM tháng, chưa tối ưu lịch từng ngày; dự án bắt đầu/kết thúc giữa tháng có cảnh báo để rà soát lịch ngày trước khi chốt.
- Residual theo profile là một phương án max-flow, không phải phân rã duy nhất. Hiển thị kỹ năng chính/bộ kỹ năng nền cần bổ sung; không cộng headcount các dòng để suy nhu cầu tuyển tổng.

## Kiểm thử

Unit: dữ liệu thiếu/null vs zero, xác suất, trạng thái/dates, demand không cộng allocation, rounding, flow generalist/specialist, đa kỹ năng không double-count, reserved vs free, peak tuyển dụng. Integration PostgreSQL: RBAC/Origin, version/concurrency, audit rollback, demand child sums/FK, probability order/null/0, archive skill dependency, seed idempotent, kết hợp capacity/skills/demand thật. Chạy lint/typecheck/build/test/HTTP smoke; browser QA báo riêng.
