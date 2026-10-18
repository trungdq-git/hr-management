# Phase 2 – Resource Planning

Thứ tự thực hiện: lịch tháng → cấu hình capacity nhân viên/tháng → phép/ngày không khả dụng → engine capacity thống nhất → allocation matrix → lịch sử và kiểm thử.

## Dữ liệu và tính toán

- Bổ sung EmployeeCapacitySetting (employee, month unique, calendar, participationRate, version). Lưu cấu hình từng tháng để đổi lịch/tỷ lệ không làm thay đổi cấu hình các tháng đã ghi nhận. CalendarId trên Employee từ Phase 1 vẫn là fallback cho dữ liệu cũ; UI thiết lập tháng sẽ tạo bản ghi riêng. Thay đổi lịch ngày/phép hồi tố là điều chỉnh chủ động, được audit và tính lại; không đóng sổ ở phase này.
- Một CalendarMonth có standardDays > 0 và đầy đủ ngày trong tháng, kể cả cuối tuần (fraction=0). Tạo mẫu T2–T6 là hành động rõ ràng của người dùng; không tự nhận diện ngày lễ theo luật. Ngày lễ/nghỉ bù/thứ bảy làm việc chỉnh trên từng ngày. Ngày công chuẩn là mẫu số độc lập, không tự trừ ngày lễ/phép.
- Phép và không khả dụng dùng một bản ghi/nhân viên/ngày, kind LEAVE hoặc UNAVAILABLE; fraction là ngày công tương đương (0–1). Không trừ nghỉ phép trên cuối tuần thêm lần nữa; giới hạn mức trừ ở workingFraction. Đặt fraction=0 là hủy về nghiệp vụ; giữ hàng có version tăng và audit để ngăn lỗi stale update sau chu kỳ hủy/tạo lại.
- Capacity = tổng max(workingFraction − absenceFraction, 0) trong khoảng joinDate..exitDate × participationRate / standardDays. Ngoài khoảng làm việc cả tháng thì capacity=0 dù chưa có lịch. Tháng có nhân viên nhưng thiếu lịch/standard thì capacity=null, không giả định 0.
- Tổng Planned/Actual tách riêng. Available = Capacity − Planned có thể âm; Utilization = Planned/Capacity, null khi capacity=0 hoặc chưa đủ dữ liệu. Tổng MM cộng theo độ chính xác 4 số, hiển thị 2 số half-up. 100% allocation tương đương 1 MM chuẩn, không phải 100% capacity sau phép; utilization dùng capacity thực tế.
- Các ô matrix thể hiện tổng tất cả dự án của nhân viên để không che quá tải khi lọc dự án. Chế độ dự án hiển thị phần Planned/Actual của dự án và đối chiếu tổng của nhân viên. Nhân viên chưa phân bổ chỉ tính khi capacity biết và >0, planned=0. Những tháng ngoài employment vẫn giữ dữ liệu phân bổ cũ để cảnh báo.

## API và ghi dữ liệu

- ADMIN/MANAGER được ghi, VIEWER đọc; mọi route kiểm tra quyền/Origin. API lịch, cấu hình capacity, absence và effort đều ghi audit cùng transaction.
- Calendar month khóa bản ghi calendar trước khi ghi toàn bộ ngày, expectedVersion null khi tạo. Capacity/absence/effort khóa employee (sắp xếp ID khi bulk). Mọi chỉnh sửa kiểm tra version; xung đột trả 409, yêu cầu tải lại. Planned và Actual có version độc lập; không ghi đè một loại khi chỉ sửa loại kia.
- Effort unique assignment+month; upsert assignment giữ lịch sử và cho phép đa dự án. Không xóa allocation; đưa Planned/Actual về 0 để hủy số liệu nhưng giữ version và audit.
- Không nhận MM âm/NaN/quá Decimal, tối đa 4 số thập phân; tháng YYYY-MM 1900–2199. Phân bổ dương phải giao khoảng tháng với ngày làm việc và thời gian dự án. PIPELINE không nhận effort dương; CANCELLED không nhận planned dương, vẫn cho phép chỉnh actual lịch sử. COMPLETED cho phép điều chỉnh tháng lịch sử trong thời gian dự án. Capacity không đủ vẫn cho lưu và cảnh báo; chưa có lịch thì cảnh báo chưa thể đánh giá.
- Actual khác planned: form chọn loại cần sửa, không tự điền actual từ planned. Chưa nhập actual hiển thị “—”, khác actual=0.
- Audit allocation/actual hỗ trợ truy vấn theo employee/project/month; ghi metadata định danh trong snapshot để lịch sử không mất khi thay đổi assignment.

## Phạm vi

Capacity Planning gồm lịch ngày, thiết lập nhân viên/tháng và phép. Allocation Matrix 6 tháng, qua năm, tìm kiếm/lọc vai trò/địa điểm/dự án/cảnh báo, xem nhân viên hoặc dự án, MM/% và modal chỉnh effort. Dashboard và Employee Detail dùng chung engine. Seed Phase 2 opt-in, idempotent, không ghi đè thiết lập đã có, không dùng dữ liệu thật.
