# Xếp lịch — bước 1B/2A: level, cặp ưu tiên và bản nháp thử

Cập nhật: 24/09/2026. Phạm vi hoàn tất trong source: hồ sơ xếp lịch và công cụ xếp thử cho admin. **Chưa có lưu phiên bản lịch, duyệt/công bố hoặc giữ chỗ.** Không thay đổi buổi cầu, khách hoặc công nợ cũ.

## Dùng thử trên web sau khi cập nhật code và database

1. Chọn kỳ → Buổi cầu → **Lịch bận và sức chứa**; kiểm tra ngày bận trước.
2. Mở **Hồ sơ và xếp thử**, chọn từng thành viên đủ điều kiện.
3. Nhập level và người đi cùng ưu tiên, bấm **Lưu hồ sơ và làm mới đầu vào**.
4. Bấm **Tạo bản nháp thử** để xem sáu ngày, số người từng buổi, số buổi mỗi người và kết quả ghép cặp.
5. Mở **Chỉnh người trong ngày** để điều chỉnh. Bỏ ngày cũ trước khi thêm ngày mới nếu người đó đã đủ bốn buổi.
6. Bấm **Kiểm tra nháp đã chỉnh**. Máy chủ kiểm tra lại đầu vào hiện tại, ngày bận, người hợp lệ, trùng người, tối đa 8 người/buổi và tối đa 4 suất cố định/người.

Hồ sơ được lưu vào database theo **kỳ**, không sửa PK/rating hoặc hồ sơ CLB khác. Nháp chỉ tồn tại ở màn hình đang mở: đổi kỳ/tuần, tải lại, đóng phần xếp thử hoặc lưu hồ sơ sẽ bỏ nháp. UI nói rõ “CHƯA LƯU / CHƯA CÔNG BỐ”; không có nút duyệt giả.

### Các giả định tạm thời cần nghiệm thu

- Thang level tạm dùng 3 mức: **Mới / Trung bình / Khá–mạnh**. Chủ CLB chưa trả lời câu hỏi chốt thang; có thể điều chỉnh trước triển khai lưu/duyệt lịch. Không suy level từ PK. Không nhập thì lưu `null` và cảnh báo, không coi là người mới.
- Mỗi người chọn một người đi cùng ưu tiên trong kỳ. A chọn B không tự sửa B; nếu cả A và B cùng chọn nhau thì chỉ tính một cặp. Chuỗi A–B–C không trở thành nhóm bắt buộc.
- Xếp độc lập từng tuần, chưa giữ bốn ngày ổn định qua cả kỳ. Lịch bận vẫn lưu thường lệ theo kỳ và ngoại lệ theo ngày.
- Chỉ xếp thử thành viên cố định đủ điều kiện; chưa đưa khách hay lượt đăng ký thêm vào bản nháp.

## Quy tắc xếp thử

- Ràng buộc cứng: đúng người/kỳ, đúng ngày rảnh, nghỉ thứ Năm, tối đa 8 người/ngày, một chỗ/người/ngày, tối đa 4 suất cố định/người.
- Trước hết tìm số lượt tối đa có thể xếp bằng min-cost max-flow; ưu tiên phân lượt cho những người đang ít buổi trước khi thêm lượt thứ tư, rồi cân bằng số người giữa các ngày. Thiếu sức chứa vẫn trả nháp kèm số thiếu từng người; không giấu người chưa được xếp đủ.
- Sau đó tối ưu có giới hạn bằng chuyển ngày/đổi chỗ: cân bằng số người → phân bố level → tăng số ngày đi cùng cặp. Không thay đổi số lượt đã phân cho mỗi người hoặc phá ràng buộc cứng. Đây là phương án đề xuất, **không cam kết cặp/level tối ưu toàn cục**.
- 11 người rảnh đủ: 44/48 lượt; 12 người: 48/48; 13 người: ít nhất thiếu 4. Lịch bận dồn ngày có thể khiến ít người hơn vẫn thiếu chỗ.
- Thiếu level, chưa ghép đủ cặp, thiếu buổi, tuần chỉ giao một phần với kỳ đều hiển thị. Không tự giảm chỉ tiêu cho tuần lẻ.
- Nháp chưa kiểm tra trùng giờ với booking CLB khác, chưa dùng lịch đã duyệt tuần trước. Hai việc này bắt buộc giải quyết trước công bố thật.

## API và an toàn

- `GET /api/session-planning/period/:periodId/draft-inputs?week_start=YYYY-MM-DD`: admin/owner mới được xem đầu vào, chỉ trong CLB được quản lý. User thông thường vẫn chỉ dùng API lịch bận của chính mình.
- `PUT /api/session-planning/period/:periodId/people/:personId/profile`: chỉ nhận `expected_revision`, `level` (null/1/2/3), `preferred_partner_id` (null hoặc người hợp lệ khác).
- `POST /api/session-planning/period/:periodId/draft-preview`: nhận `week_start`, `input_version`, tùy chọn `assignments` chứa `{person_id,date}`. Bỏ `assignments` để tự xếp; gửi `[]` là kiểm tra nháp rỗng, không tự xếp lại.
- API không cho client đổi group, period, role hay đánh dấu approved. Tài khoản quản trị/người nghỉ/không thuộc membership active dạng member/không cố định trong kỳ đều không được chọn làm người chơi.
- Kỳ đóng chỉ xem hồ sơ; chặn lưu hồ sơ và tạo/kiểm tra nháp mới. Scope và tư cách người chơi được kiểm tra ở mỗi request, không replay từ cache ghi chung.
- Hồ sơ lưu và audit trong cùng transaction; RPC kiểm tra lại actor từ `auth.users`, group và cả hai người. Expected revision cũ trả 409, không ghi đè.
- Mã phiên bản đầu vào gồm kỳ/nhóm, danh sách người hợp lệ, lịch bận/revision, level/cặp/revision và tuần. Khi dữ liệu đã đổi, preview trả 409 `PLANNING_STALE_INPUT`, UI bỏ nháp cũ và yêu cầu tải lại.
- Đây là kiểm tra bản chụp đầu vào tại lúc request, không khóa lịch liên tục. Không dùng token này thay cho transaction kiểm tra lại khi duyệt/giữ chỗ ở bước sau.
- Nếu một người trong cặp đã nghỉ, API không cho chọn lại, không gửi ID đó trong lựa chọn; báo cặp cũ cần cập nhật. Không xóa hồ sơ/audit lịch sử.

## Migration cần chạy thủ công

File: `supabase/20260923_session_planning_profiles.sql`. Chạy **sau** `20260923_session_planning_preferences.sql`.

- Migration bước 1: người dùng gửi ảnh SQL thành công; kiểm tra REST chỉ đọc đã xác nhận có bảng preferences, audit và RPC. Chưa xác minh nội dung hàm đang chạy hay nghiệm thu ghi dữ liệu trên production.
- Migration bước này **chưa được chạy trên Supabase production**. Chỉ thử trên PostgreSQL nhúng bằng schema tối thiểu và dữ liệu giả.
- Script mới tạo hai bảng `session_planning_profiles`, `session_planning_profile_audits` và RPC `save_session_planning_profile`. RLS bật; anon/authenticated không đọc/ghi/thực thi; backend service_role chỉ đọc bảng, ghi thông qua RPC.
- Không UPDATE/DELETE dữ liệu cũ, không tạo booking/công nợ, không chạy trigger tài chính. Chạy lại không xóa hồ sơ đã có.

Quy trình: xác nhận đúng project và khả năng khôi phục → ưu tiên thử trên staging với schema thực → chạy **toàn bộ file** SQL một lần → xác nhận thành công → kiểm tra frontend/backend cùng phiên bản → thử với người/kỳ dành cho kiểm thử. Không chọn riêng một đoạn SQL giữa BEGIN/COMMIT.

Nếu SQL mới chưa được áp dụng, chỉ phần hồ sơ/xếp thử báo thiếu migration; phần lịch bận bước 1 vẫn hoạt động độc lập. Nếu dừng rollout, tắt phần mới trong code và giữ nguyên bảng/audit, không DROP để quay lại.

## Bằng chứng kiểm thử

- Bộ unit/service kiểm tra cấu hình, các ca 11/12/13 người, lịch bận tập trung, thứ Năm, tuần lẻ, thiếu level, cặp một chiều/hai chiều, chỉnh tay sai, scope/role và đầu vào cũ.
- 35 bộ lịch bận giả có kết quả số lượt bằng bộ kiểm tra max-flow độc lập của bước 1. Kiểm tra giới hạn 499 thành viên vẫn chỉ xếp tối đa 48 lượt, báo phần thiếu.
- SQL chạy thật trên PGlite với dữ liệu giả: chạy lại giữ dữ liệu, revision, quyền đọc/ghi/thực thi, tư cách hai người, kỳ đóng, hai CLB và lỗi audit làm rollback toàn bộ. PGlite một kết nối **không thay thế** kiểm thử tranh chấp nhiều kết nối trên Supabase.
- Đã thao tác trình duyệt trên harness cục bộ: lưu level và tăng revision; tự xếp 11 người đủ bốn buổi; bỏ một suất và kiểm tra ra thiếu một; thay lịch bận ở nơi khác làm nháp cũ bị chặn; tải lại rồi xếp mới; giả lập thiếu migration rồi phục hồi.
- Đã xem bố cục rộng/khung nội dung 390px; các thẻ ngày không tràn ngang, bảng có vùng cuộn riêng. Đây chưa phải nghiệm thu trên điện thoại thật.
- Harness: từ thư mục `frontend`, chạy `node tests/session-planning-ui.harness.mjs`, mở `http://127.0.0.1:5179/`. Chỉ dữ liệu giả trong bộ nhớ, không đọc `.env`, không kết nối Supabase. Tắt bằng Ctrl+C; không dùng harness làm server production.
- Đã kiểm tra riêng đúng bản Git được stage, không mang `.env` hoặc thay đổi tài chính đang dở: **125 test backend, 35 test frontend**, backend syntax check và frontend lint/build đều đạt. Chưa nghiệm thu E2E frontend → backend → Supabase thật; chưa xác minh CI/deploy tự động.

## Bước tiếp theo — 2B

Lưu phiên bản nháp/đầu vào/audit; duyệt và công bố nguyên tử có kiểm tra quyền, lịch bận và sức chứa mới nhất; chặn trùng giờ nhiều CLB; thống nhất giữ lịch qua tuần và tuần giao kỳ; thông báo thay đổi. Sau đó mới nối giữ chỗ, báo nghỉ trước/sau 12h, hàng chờ cố định trước khách và điểm danh/tài chính.
