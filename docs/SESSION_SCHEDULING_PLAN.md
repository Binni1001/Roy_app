# KẾ HOẠCH XẾP LỊCH BUỔI CẦU, ĐĂNG KÝ THÊM VÀ TUYỂN VÃNG LAI

Ngày soạn: 23/09/2026.

Trạng thái (24/09/2026): ĐÃ ĐƯỢC CHO PHÉP TRIỂN KHAI TỪNG BƯỚC. Bước 1 có code/test; người dùng đã gửi ảnh SQL thành công và kiểm tra REST chỉ đọc xác nhận bảng/RPC lịch bận tồn tại. Bước 1B/2A đã có hồ sơ level/cặp và xếp thử/chỉnh nháp; chưa chạy migration hồ sơ trên Supabase thật, chưa lưu/duyệt/công bố lịch hoặc nghiệm thu deploy. Các quyết định chưa chốt bên dưới vẫn giữ nguyên trạng thái chờ.

Tài liệu này thay thế đề xuất “6 suất cố định + 2 suất linh hoạt”. Không bao gồm việc xây lại toàn bộ database V2.

Điều chỉnh đã chốt: mỗi buổi tối đa 8 người; bỏ hoàn toàn điều kiện tuyển khách theo số chẵn/lẻ. Mọi chỗ trống đều ưu tiên thành viên cố định trước, sau đó mới đến vãng lai.

## 1. Các yêu cầu đã thống nhất

| Nội dung | Quy tắc |
| --- | --- |
| Lịch chơi | Thứ Hai, thứ Ba, thứ Tư, thứ Sáu, thứ Bảy, Chủ nhật; nghỉ thứ Năm. |
| Giờ chơi | 17:30–19:30, múi giờ Asia/Ho_Chi_Minh. |
| Sân và sức chứa | 1 sân/buổi, tối đa 8 người; không bắt buộc đủ 8. |
| Lượt cố định | Mỗi thành viên cố định được xếp 4 buổi trên 4 ngày khác nhau mỗi tuần, khi dữ liệu lịch rảnh và sức chứa cho phép. Không được báo đã đáp ứng khi thực tế thiếu buổi. |
| Lượt thêm | Hai ngày chơi còn lại của từng người có thể đăng ký thêm nếu còn chỗ; người đăng ký hợp lệ trước được ưu tiên trước. |
| Lịch bận | Không khai báo thay đổi thì giữ lịch rảnh/bận thường lệ. Admin có quyền sửa lịch bận của từng người trong kỳ. |
| Cặp đi cùng | Là ưu tiên xếp chung buổi, không phải điều kiện bắt buộc và không bắt buộc ghép đôi trong mọi trận. |
| Level | Trộn trình độ trong các buổi; không tách thành buổi chỉ dành cho một mức trình độ. |
| Hủy tham gia | Phải báo trước 12:00 trưa ngày chơi; báo muộn được đánh dấu để cảnh cáo. |
| Tuyển người vào chỗ trống | Ưu tiên thành viên cố định trong kỳ trước, sau đó mới đến vãng lai. Áp dụng cả chỗ trống sau xếp lịch và chỗ có người báo nghỉ; không xét số chẵn/lẻ. |
| Quyền duyệt | Hệ thống xếp bản nháp; admin kiểm tra, chỉnh sửa và duyệt. Admin duyệt người nhận chỗ/tuyển khách. |
| Phạm vi CLB | Lịch, quyền truy cập và tài chính của từng CLB độc lập. Tài khoản quản trị không trở thành người chơi chỉ vì có quyền quản lý. |

“Hai ngày còn lại” là hai ngày ngoài lịch 4 ngày của MỖI NGƯỜI, không phải hai ngày chung cả CLB chỉ dành cho đăng ký thêm. Có quyền đăng ký không đồng nghĩa chắc chắn có chỗ.

## 2. Sức chứa và nguyên tắc tuyển người

### 2.1. Sức chứa có thể không đủ để mỗi người có 4 buổi

- 6 buổi/tuần × 8 người = 48 lượt tối đa/tuần.
- N thành viên cố định cần 4 × N lượt/tuần.
- 11 thành viên cần 44 lượt, còn tối đa 4 lượt đăng ký thêm trong cả tuần.
- 12 thành viên cần 48 lượt, không còn lượt thêm nếu mọi suất cố định vẫn được giữ; chỉ mở thêm chỗ khi có người báo nghỉ.
- 13 thành viên cần 52 lượt: đã vượt sức chứa 4 lượt, chưa tính lượt thêm hay khách.
- Vì vậy, tối đa 12 thành viên mới có khả năng đáp ứng 4 buổi/người với cấu hình hiện tại. Đây chỉ là điều kiện về tổng sức chứa; lịch bận tập trung có thể khiến ít người hơn vẫn không xếp được.

Cần biết số thành viên cố định thực sự thuộc diện xếp lịch. Nếu vượt khả năng, phải được chủ CLB chọn điều chỉnh số sân/khung giờ hoặc chỉ tiêu buổi. Không tự giảm từ 4 xuống 3, vượt 8 người, hoặc loại bớt thành viên để làm lịch trông hợp lệ.

Hệ thống được tạo bản nháp có cảnh báo thiếu buổi để admin xem, nhưng không được công bố như một lịch đã đáp ứng đầy đủ yêu cầu. Mọi ngoại lệ phải hiển thị rõ và được duyệt riêng; không sửa ngầm quy tắc.

### 2.2. Nguyên tắc tuyển người đã được chốt

- Còn chỗ thì ưu tiên thành viên cố định đủ điều kiện nhận trước.
- Kết thúc bước ưu tiên cố định mà vẫn còn chỗ thì admin có thể duyệt khách vãng lai.
- Số người đang có là chẵn hay lẻ không ảnh hưởng đến điều kiện tuyển.
- Tổng số người được xác nhận, bao gồm cả cố định và vãng lai, không vượt 8.

Không tự động thêm khách chỉ vì thiếu người: vẫn phải có người đăng ký/được mời và được admin duyệt. Số 8 là trần, không phải điều kiện bắt buộc để tổ chức buổi.

## 3. Khai báo lịch bận và tạo lịch tuần

1. Admin chọn CLB, kỳ và tuần cần xếp lịch.
2. Gửi thông báo yêu cầu thành viên cập nhật lịch bận. Bản đầu đề xuất dùng thông báo trong web; chưa mặc định gửi Zalo, email hay SMS.
3. Thành viên khai báo những ngày không thể tham gia; admin có thể nhập/sửa thay, kèm người sửa và thời điểm sửa.
4. Nếu không phản hồi, giữ lịch thường lệ đã lưu. Khi chưa có khai báo bận nào thì mặc định rảnh ở các ngày CLB hoạt động; không tự xóa lịch bận đã có.
5. Đến hạn do admin thiết lập, khóa dữ liệu đầu vào của một phiên bản bản nháp và chạy xếp lịch.
6. Admin xem số người, số buổi từng người, phân bố level, cặp đi cùng và các ràng buộc chưa đáp ứng.
7. Admin chỉnh sửa hoặc yêu cầu xếp lại, sau đó duyệt để công bố.
8. Thành viên nhận lịch đã duyệt; các slot còn trống mới mở đăng ký thêm theo cấu hình.

Đề xuất giữ ổn định 4 ngày theo lịch đã duyệt của từng người trong kỳ, dùng lịch tuần trước làm cơ sở cho tuần sau; chỉ điều chỉnh khi có lịch bận hoặc admin chủ động xếp lại. Cần xác nhận cách giữ lịch này trước khi triển khai.

Các mốc gửi thông báo, hạn cập nhật và giờ mở đăng ký thêm chưa được chốt. Phải cấu hình rõ, không dùng những mốc ví dụ trước đây làm mặc định ngầm.

Nếu lịch bận thay đổi khi bản nháp đã tạo, bản nháp phải được đánh dấu cần kiểm tra lại. Nếu lịch đã công bố, thay đổi phải theo luồng điều chỉnh có thông báo, không âm thầm thay cả danh sách.

## 4. Quy tắc tự xếp lịch

### 4.1. Ràng buộc bắt buộc

- Đúng CLB, đúng kỳ và ngày nằm trong thời gian áp dụng của kỳ.
- Chỉ người đang hoạt động, được phép tham gia và thuộc diện cố định trong kỳ mới được tự xếp 4 buổi.
- Không xếp người vào ngày đã báo bận; không xếp thứ Năm theo lịch hiện tại.
- Một người chỉ có một chỗ trong một buổi, tối đa một buổi trong một ngày của cấu hình này.
- Không buổi nào vượt 8 người, kể cả admin chỉnh tay hoặc nhiều người đăng ký cùng lúc.
- Mục tiêu 4 buổi cố định trên 4 ngày khác nhau/người/tuần. Nếu không đạt, hiển thị số thiếu và nguyên nhân; không tự chuyển yêu cầu thành 3 buổi.
- Không xung đột giờ với một buổi đã xác nhận ở CLB khác nếu hệ thống có dữ liệu đó; không tiết lộ danh sách riêng của CLB khác.

### 4.2. Các ưu tiên tối ưu, không được phá ràng buộc bắt buộc

- Phân đủ số buổi cho mọi người trước khi tối ưu cặp và level.
- Trộn người mạnh, trung bình và mới; tránh dồn toàn bộ người mạnh hoặc người mới vào một buổi.
- Cố gắng xếp các cặp ưu tiên cùng ngày khi cả hai rảnh và còn sức chứa.
- Hạn chế thay đổi lịch cố định đã quen thuộc; hiển thị khi không thể giữ cặp hoặc giữ ngày cũ.

Level do admin nhập theo một thang thống nhất, đề xuất 3 mức “Mới / Trung bình / Khá–mạnh”; chưa được chốt số mức. Chưa suy level từ PK, không thay đổi hệ thống xếp hạng hiện tại. Người thiếu level phải được báo rõ, không âm thầm coi là yếu.

Khi một người trong cặp nghỉ, đề xuất người còn lại vẫn giữ chỗ và tự báo nghỉ nếu cần. Không tự hủy cả cặp; không tự tạo chuỗi nhóm bắt buộc từ các cặp ưu tiên.

Không hứa luôn có lời giải khi lịch bận không cho phép. Phân biệt “vi phạm điều kiện sức chứa chắc chắn” và “thuật toán chưa tìm được phương án”; admin phải thấy được ai thiếu ngày và buổi nào đang nghẽn.

## 5. Đăng ký thêm và hàng chờ

1. Chỉ mở trên lịch đã được duyệt/công bố, ở các ngày người đó chưa có chỗ và không báo bận.
2. Hiển thị số người đã xác nhận, số chỗ còn lại, thứ tự yêu cầu và trạng thái chờ duyệt.
3. Thứ tự do thời điểm máy chủ nhận yêu cầu hợp lệ quyết định, có khóa thứ tự ổn định khi trùng thời gian; không lấy giờ trên thiết bị người dùng.
4. Admin duyệt theo thứ tự hợp lệ trong cùng nhóm ưu tiên; xử lý thành viên cố định trước các yêu cầu khách chưa được duyệt. Không được bỏ qua người cố định đến trước chỉ vì level/cặp của người đến sau phù hợp hơn. Từ chối phải có lý do và lưu lịch sử.
5. Yêu cầu đang chờ duyệt/chờ chỗ chưa phải một suất đã xác nhận. Giao diện phải nói rõ điều này.
6. Khi hết chỗ, yêu cầu sau nằm trong hàng chờ. Khi có người hủy, xử lý lại thứ tự và kiểm tra điều kiện trước khi duyệt người tiếp theo.
7. Gửi lại yêu cầu do mạng lỗi không tạo lượt mới hay đổi thứ tự. Hủy rồi đăng ký lại thì lấy thứ tự mới.
8. Hai người cùng xin chỗ cuối chỉ có một người được xác nhận. Kiểm tra sức chứa, thứ tự và ghi nhận phải trong cùng giao dịch tại database.

Đăng ký theo cặp không được tự chiếm hai chỗ hoặc vượt hàng chờ; bản đầu xử lý từng người. Cặp là ưu tiên của bước phân lịch cố định.

Giới hạn 4 buổi là số buổi ĐƯỢC PHÂN CỐ ĐỊNH, không phải cấm tham gia buổi thứ 5/6 khi đăng ký thêm thành công. Hủy một buổi không tự bảo đảm có một suất bù ở buổi khác, không tự sắp xếp lại tất cả mọi người.

## 6. Báo nghỉ, cảnh cáo và tuyển người thay

### 6.1. Mốc thời gian

- Báo trước 12:00 ngày chơi: đúng hạn.
- Báo từ 12:00 trở đi: đề xuất tính là báo nghỉ muộn theo nghĩa “trước 12h”. Dùng thời điểm máy chủ, múi giờ Việt Nam.
- Vẫn nhận báo nghỉ muộn để danh sách và chỗ trống chính xác.
- Lưu thời điểm báo, lý do, người thao tác và nhãn “Báo nghỉ muộn”; admin xem lịch sử để cảnh cáo.
- Chưa tự phạt tiền, khóa tài khoản hoặc cấm đăng ký sau một số lần cảnh cáo nếu chủ CLB chưa chốt chính sách.
- Đề xuất không nhận đăng ký/tuyển thay mới sau 17:30; việc bổ sung người thực tế đến muộn thuộc luồng điểm danh của admin và vẫn không được vượt 8.
- Vắng không báo là trạng thái riêng, do admin xác nhận khi điểm danh; không đánh đồng với đã báo nghỉ muộn.

Admin sửa lịch bận trước khi công bố không phải là báo nghỉ muộn. Sau công bố, việc sửa lịch bận liên quan đến chỗ đã xác nhận phải thể hiện rõ hành động hủy, không được dùng chỉnh lịch bận để xóa dấu vết cảnh cáo.

### 6.2. Ưu tiên thành viên cố định trước khách

1. Có chỗ trống sau xếp lịch hoặc có người báo nghỉ: cập nhật số chỗ và kiểm tra hàng chờ thành viên cố định trước.
2. Thông báo cơ hội nhận chỗ cho các thành viên cố định đủ điều kiện, chưa có chỗ trong buổi và không báo bận.
3. Các yêu cầu hợp lệ được xử lý theo thứ tự đến trước; admin duyệt.
4. Chỉ chuyển sang xét tuyển khách sau khi không còn yêu cầu nội bộ đủ điều kiện chưa xử lý và đã kết thúc bước mời nội bộ.
5. “Không có người nội bộ nhận” phải là trạng thái admin xác nhận hoặc hết hạn đăng ký nội bộ đã cấu hình, không suy đoán mọi người bận chỉ vì chưa trả lời ngay.

Hạn chờ nội bộ trước khi mở khách chưa được chốt. Bản đầu đề xuất admin bấm “Chốt mời nội bộ / Xét tuyển khách”; nếu sau này tự động hóa thì cần thời gian cụ thể và xử lý riêng các ca báo nghỉ muộn.

### 6.3. Số chỗ có thể tuyển — không xét chẵn/lẻ

Chỉ tính số người đã XÁC NHẬN tham gia còn hiệu lực tại thời điểm xét tuyển; không tính người hủy, chờ duyệt hay chờ chỗ.

| Số người sau bước ưu tiên cố định | Số chỗ tối đa còn có thể duyệt cho khách |
| --- | --- |
| 8 | 0; đã đủ chỗ. |
| 7 | Tối đa 1 khách. |
| 6 | Tối đa 2 khách. |
| 5 | Tối đa 3 khách. |
| 4 | Tối đa 4 khách. |
| Dưới 4 | Tối đa 8 trừ số người đã xác nhận; cảnh báo ít người để admin quyết định tổ chức/tuyển thêm, không tự hủy buổi. |

Các con số trên là giới hạn còn có thể nhận, không phải số khách bắt buộc tuyển. Khi đã đủ 8, không nhận thêm cả thành viên cố định lẫn khách.

Trước khi duyệt khách phải kiểm tra lại số người, hàng chờ nội bộ và điều kiện tuyển trong cùng giao dịch. Ví dụ đề xuất khách khi còn 7 nhưng một thành viên vừa được duyệt làm số lượng thành 8 thì không tiếp tục tự duyệt khách theo dữ liệu cũ.

Đề xuất không đẩy khách ĐÃ ĐƯỢC DUYỆT ra để lấy chỗ cho thành viên đăng ký muộn. Ưu tiên cố định áp dụng khi xét các yêu cầu chưa được duyệt; thay đổi tiếp theo phải tính lại sức chứa và hàng chờ.

## 7. Điểm danh và tiền buổi

Đăng ký, có chỗ được duyệt, thực tế có mặt và công nợ là các khái niệm riêng.

- Mỗi buổi cần danh sách điểm danh cho cả thành viên cố định và khách, không chỉ danh sách khách như hiện tại.
- Đề xuất chỉ phát sinh phí vãng lai khi admin xác nhận có tham gia; đăng ký/chờ/hủy chưa tạo khoản thu.
- Thành viên cố định nhận suất thêm/thay thế không tự đổi thành khách. Đề xuất giữ cách thu theo kỳ và chưa thu phụ phí lượt thêm; cần chủ CLB xác nhận trước khi nối tài chính.
- Tiền chia cầu và mức miễn 0/50/100% giữ nghiệp vụ hiện có, không tự tính lại từ số buổi đăng ký hay cảnh cáo.
- Phí khách bỏ trống phải dùng mức của kỳ; số 0 nhập rõ là miễn phí, không được nhầm hai trường hợp.
- Chốt điểm danh/tạo phí phải chống ghi trùng, có giao dịch nguyên tử; lỗi tạo nợ không được để lại nửa thao tác.
- Không tự hủy rồi tạo lại khoản nợ đã thanh toán hoặc đã đối trừ khi sửa điểm danh. Cần luồng điều chỉnh có kiểm tra, lý do và lịch sử; chặn thao tác không an toàn trước khi có luồng đó.
- Mọi khoản thu, đối trừ và liên kết kỳ phải giữ trong đúng CLB. Không chỉ kiểm tra group ở giao diện; phải rà cả trigger/RPC tài chính khi chèn nợ.

Chưa đưa thanh toán trước để giữ chỗ, phạt hủy muộn hoặc hoàn phí tự động vào phạm vi này.

## 8. Giao diện dự kiến

### Admin

- Cấu hình lịch CLB: ngày chơi, khung giờ, sân, sức chứa, số buổi cố định và các mốc đăng ký.
- Lịch bận theo kỳ/tuần: sửa thay thành viên, xem lịch thường lệ và ngoại lệ theo ngày.
- Hồ sơ xếp lịch: level, cặp ưu tiên, điều kiện tham gia.
- Bảng nháp tuần: danh sách từng ngày, số người / 8, số buổi từng người / 4, phân bố level và cảnh báo.
- Nút xếp nháp, chỉnh người giữa các ngày, kiểm tra lại, duyệt và công bố.
- Chi tiết buổi: danh sách xác nhận, yêu cầu chờ duyệt, hàng chờ, báo nghỉ muộn và bước tuyển thay nội bộ/khách.
- Điểm danh và xem khoản thu liên quan; quyền tài chính phải tách khỏi quyền duyệt lịch nếu chưa đủ điều kiện phân quyền an toàn.

### Thành viên

- Xem lịch cá nhân và lịch buổi đã công bố của CLB được phép truy cập.
- Khai báo lịch bận, xem thay đổi admin đã nhập thay.
- Báo nghỉ một buổi với cảnh báo mốc 12h.
- Xem slot trống ở ngày chưa có lịch; gửi yêu cầu đăng ký thêm và xem thứ tự/trạng thái.
- Xem thông báo duyệt/từ chối, thay đổi lịch và cảnh cáo của bản thân.

Không công khai lý do bận riêng tư hoặc lịch cảnh cáo của người khác. Tài khoản quản trị và người đã nghỉ không xuất hiện trong lựa chọn người chơi và bị chặn cả ở API.

## 9. Hướng thay đổi dữ liệu

Thiết kế dưới đây là các KHÁI NIỆM cần lưu, chưa phải danh sách bảng SQL được duyệt. Rà schema/constraint thực tế trước, ưu tiên tái sử dụng và không tạo bảng trùng chức năng.

| Khái niệm | Nội dung cần lưu / hướng xử lý |
| --- | --- |
| Cấu hình buổi của CLB | Ngày chơi, giờ, múi giờ, sức chứa, sân, chỉ tiêu tuần và mốc đăng ký. |
| Lịch bận | Người + CLB + kỳ, ngày thường lệ/ngoại lệ theo ngày, phạm vi hiệu lực, người sửa. Ngoại lệ theo ngày có thứ tự ưu tiên rõ ràng. |
| Hồ sơ xếp lịch | Level theo CLB, cặp ưu tiên, lịch ngày cố định đã duyệt để tham chiếu tuần sau. |
| Bản kế hoạch tuần | Tuần, CLB, kỳ liên quan, trạng thái nháp/duyệt/công bố, phiên bản, dữ liệu đầu vào và cảnh báo. |
| Buổi cầu | Mở rộng `badminton_sessions` cho lịch tương lai, thời gian, sức chứa và trạng thái dự kiến/đã công bố/đã hoàn tất/đã hủy. |
| Tham gia và yêu cầu | Một nguồn danh sách chuẩn cho mỗi người/buổi: nguồn suất phân lịch/đăng ký thêm/thay thế, thứ tự, trạng thái duyệt/hủy/chờ, thời điểm và điểm danh. Loại tính phí cố định/vãng lai lưu riêng với nguồn suất. |
| Khách và khoản thu | Tái sử dụng `guest_attendances`/`debts` cho xác nhận thực tế và liên kết công nợ; không đếm một khách hai lần ở hai nguồn danh sách. |
| Thông báo và nhật ký | Tận dụng notifications sau khi kiểm tra phân quyền; lưu sự kiện duyệt/sửa/hủy/cảnh cáo bền vững, không lấy hộp thông báo có thể xóa làm nhật ký kiểm toán. |

Ràng buộc kỹ thuật bắt buộc:

- Chống trùng người/buổi, trùng buổi/sân/khung giờ; kiểm tra liên kết đúng CLB và kỳ.
- Số lượng được duyệt, thứ tự hàng chờ và tuyển khách phải được kiểm tra trong giao dịch có khóa phù hợp, không chỉ đếm ở frontend.
- Khi admin duyệt một bản nháp đã cũ, phải báo xung đột phiên bản và kiểm tra lại thay vì ghi đè dữ liệu mới.
- Dữ liệu từng CLB được phân quyền ở backend và RLS phù hợp; service role không phải lý do để bỏ kiểm tra quyền.
- Hoạt động gửi thông báo có cơ chế chống trùng và thử lại; thông báo lỗi không được làm nhân đôi đặt chỗ hay khoản thu.
- Không xóa lịch sử chỉ để tái tạo lịch tuần. Hủy buổi đã có người/tiền dùng trạng thái và nhật ký; không cascade xóa công nợ.
- Tuần giao giữa hai kỳ phải gắn từng buổi đúng kỳ, tránh cấp hai lần chỉ tiêu 4 buổi hoặc sinh lịch ngoài kỳ. Cách áp dụng chỉ tiêu cho tuần thiếu ngày/người vào giữa tuần cần được chốt rõ.

## 10. Những điểm đã đối chiếu trong source hiện tại

- `backend/src/modules/badminton-sessions/badmintonSessions.service.js` đang chặn ngày tương lai. Cần tách nghiệp vụ “lên lịch” với “ghi nhận đã chơi”; không chỉ bỏ kiểm tra ngày cho mọi thao tác.
- Buổi hiện lưu chủ yếu ngày, số cầu và ghi chú; chưa có luồng phiên bản bản nháp, sức chứa và danh sách đăng ký tổng quát.
- `frontend/src/features/admin/panels/SessionsPanel.jsx` đang có tạo/sửa buổi, ghi khách và xem khách; cần mở rộng trải nghiệm lịch tuần và người tham gia.
- Ghi khách hiện tạo attendance rồi tạo nợ ở các thao tác riêng; sửa/xóa khách có nhánh hủy nợ cũ. Phải xử lý an toàn tài chính trước khi gắn vào luồng duyệt/điểm danh mới.
- Form khách hiện chuyển tiền trống thành 0; phải tách “chưa nhập” với “miễn phí”.
- SQL trong repo có trigger gọi đối trừ theo `person_id`. Cần xác minh phiên bản đang chạy và phạm vi CLB trước khi kích hoạt phát sinh phí mới; chưa kết luận schema production giống hoàn toàn source.
- Hiện có các thay đổi cục bộ chưa commit thuộc công việc trước. Việc soạn tài liệu này không gộp, ghi đè hay coi các thay đổi đó đã triển khai production.

## 11. Thứ tự triển khai và checklist

Chỉ đánh dấu hoàn thành khi đã có sản phẩm và bằng chứng kiểm tra tương ứng. Bản kế hoạch không đồng nghĩa tính năng đã hoàn thành.

### Giai đoạn 0 — Chốt đầu vào

- [x] Soạn bản nháp kế hoạch và đối chiếu các điểm tích hợp chính trong source.
- [x] Chủ CLB chốt giới hạn 8 người/buổi, bỏ điều kiện chẵn/lẻ và ưu tiên cố định trước vãng lai; đã cập nhật tài liệu, chưa triển khai tính năng.
- [ ] Xác nhận số thành viên cố định, kiểm tra khả năng đáp ứng 4 buổi/người.
- [ ] Chốt giữ lịch 4 ngày trong kỳ hay xếp lại mỗi tuần; lịch bận ngoại lệ.
- [ ] Chốt thang level, thời điểm thu lịch bận/chốt lịch/mở đăng ký thêm.
- [ ] Chốt hạn ưu tiên nội bộ trước khách, ngưỡng ít người và tuần không trọn vẹn.
- [ ] Chốt phí lượt thêm và thời điểm tính phí khách; chưa mặc định coi các đề xuất tài chính đã được duyệt.

### Giai đoạn 1 — Dữ liệu và phân quyền

- [x] Bước 1A: code khai báo lịch bận thường lệ/ngoại lệ theo ngày, admin theo CLB và user tự sửa; revision + audit nguyên tử; migration đã thử trên PostgreSQL nhúng. Người dùng gửi ảnh SQL thành công, REST chỉ đọc xác nhận bảng/RPC; chưa nghiệm thu ghi dữ liệu production. Xem `docs/SESSION_PLANNING_STAGE1.md`.
- [x] Bước 1B: hồ sơ level thủ công/cặp ưu tiên theo kỳ, admin đúng CLB, revision/audit/kiểm tra tư cách cả hai người. Migration mới chỉ chạy local với dữ liệu giả; thang 3 mức là giả định tạm cần nghiệm thu. Xem `docs/SESSION_PLANNING_STAGE2A.md`.
- [x] Kiểm tra sức chứa 8 người × 6 ngày và khả năng đáp ứng 4 buổi dựa trên lịch rảnh thực tế; không xếp/duyệt lịch ở bước này.
- [x] Đối chiếu tên cột public liên quan qua Supabase REST chỉ đọc. Không đọc/in hồ sơ cá nhân hay khóa, không thay đổi dữ liệu.
- [x] Kiểm tra riêng bản Git sẽ commit: 108 test backend + 30 test frontend, syntax check, lint và build đạt local. Không bao gồm các thay đổi tài chính dang dở ngoài phạm vi.
- [ ] Đọc schema, FK, index, trigger/RPC thực tế liên quan; không suy từ schema visualizer.
- [ ] Thiết kế migration bổ sung, kiểm tra trên môi trường thử nghiệm có dữ liệu đã ẩn danh.
- [ ] Cấu hình lịch CLB, lịch bận, level và cặp ưu tiên theo đúng phạm vi.
- [ ] Thiết lập điều kiện người chơi, phân quyền admin/user và nhật ký thay đổi cho toàn bộ luồng (phần lịch bận đã có; booking/duyệt/điểm danh chưa có).
- [ ] Kiểm tra tương thích dữ liệu buổi cũ, không tự suy diễn attendance của thành viên cố định trong lịch sử.

### Giai đoạn 2 — Xếp nháp và duyệt lịch

- [x] Bước 2A: tự xếp thử theo lịch rảnh, 8 người/ngày, chỉ tiêu 4 buổi, ưu tiên level/cặp; UI chỉnh và kiểm tra lại với token đầu vào, báo thiếu lượt rõ ràng. Nháp chưa lưu, chưa duyệt/công bố; đã thử tương tác bằng dữ liệu giả.
- [ ] Tạo buổi tương lai và kế hoạch tuần, gắn đúng kỳ.
- [x] Kiểm tra sức chứa/chỉ tiêu trước khi xếp thử; chặn vượt giới hạn và trùng người khi kiểm tra nháp chỉnh tay. Cần kiểm tra lại nguyên tử khi duyệt ở bước 2B.
- [ ] Xếp lịch 4 ngày với lịch bận, level, cặp ưu tiên và tính ổn định.
- [ ] UI chỉnh nháp, cảnh báo không đáp ứng, duyệt/công bố có kiểm tra phiên bản.
- [ ] Thông báo lịch đã duyệt, thay đổi và chống gửi trùng.

### Giai đoạn 3 — Slot thêm, báo nghỉ và tuyển thay

- [ ] Hàng chờ theo thứ tự máy chủ, admin duyệt đúng thứ tự hợp lệ.
- [ ] Chống vượt 8 và trùng người khi thao tác đồng thời/gửi lại yêu cầu.
- [ ] Báo nghỉ trước/sau 12h, cảnh cáo và lịch sử; không tự phạt tiền.
- [ ] Ưu tiên người nội bộ, chốt bước mời nội bộ rồi mới xét khách.
- [ ] Tuyển khách theo số chỗ còn lại sau bước ưu tiên cố định, không xét chẵn/lẻ; kiểm tra lại khi số lượng thay đổi.

### Giai đoạn 4 — Điểm danh và công nợ an toàn

- [ ] Điểm danh cả cố định/vãng lai, phân biệt đăng ký và có mặt.
- [ ] Phí theo chính sách được duyệt, phân biệt bỏ trống với 0.
- [ ] Attendance và khoản thu nguyên tử, chống trùng, bảo vệ nợ đã thanh toán/đối trừ.
- [ ] Kiểm tra toàn bộ đường đi RPC/trigger để không đối trừ chéo CLB; nếu chưa an toàn thì chưa bật phần phát sinh phí mới.
- [ ] Giữ nguyên lịch sử và nghiệp vụ chia cầu/miễn phần trăm hiện tại.

### Giai đoạn 5 — Kiểm thử, nghiệm thu và đưa lên dùng

- [ ] Backend tests, frontend tests, lint và build.
- [ ] Kiểm thử các tình huống nghiệp vụ ở mục 12 và thao tác thực tế trên điện thoại.
- [ ] Admin nghiệm thu một tuần mẫu trên môi trường thử nghiệm.
- [ ] Sao lưu và có phương án quay lại tương thích trước migration production; không rollback bằng cách xóa dữ liệu mới đã có người dùng.
- [ ] Duyệt và áp dụng migration theo quy trình Supabase SQL Editor của dự án; xác nhận thành công trước bật code phụ thuộc schema mới.
- [ ] Triển khai theo giai đoạn/feature flag nếu cần, kiểm tra frontend và backend cùng phiên bản tương thích.
- [ ] Cập nhật checklist kèm bằng chứng; commit/push phần việc hoàn thành theo yêu cầu trước đây của chủ dự án, không gộp thay đổi không liên quan.
- [ ] Kiểm tra sau deploy; chỉ đánh dấu “đã triển khai” khi đã xác minh, không đồng nhất push Git với migration hoặc deploy thành công.

## 12. Các ca kiểm thử bắt buộc

1. Một tuần chuẩn có 6 ngày, không tạo buổi thứ Năm; giờ Việt Nam luôn 17:30–19:30.
2. 11 người có lịch rảnh phù hợp: 44 suất cố định, còn tối đa 4 slot thêm. Với 12 người: dùng hết 48 suất, không có slot thêm nếu mọi suất cố định còn hiệu lực; hủy một suất mới mở một chỗ.
3. 13 người: báo thiếu tối thiểu 4 lượt, không tự nhét người thứ 9 hoặc giảm chỉ tiêu.
4. Một người chỉ rảnh 3 ngày: báo không đủ 4 buổi, không tự xếp vào ngày bận.
5. Hai người có cặp ưu tiên nhưng lịch rảnh không giao nhau: giữ điều kiện rảnh, báo chưa ghép được cặp.
6. Không phản hồi thông báo: giữ lịch thường lệ; admin sửa ngoại lệ một ngày không xóa lịch các tuần sau.
7. Mỗi người đủ 4 ngày khác nhau, 2 ngày còn lại chỉ được xác nhận thêm nếu còn chỗ; không phát sinh bảo đảm 6 buổi.
8. Hai người xin slot cuối cùng đồng thời, kể cả admin duyệt ở hai cửa sổ: chỉ một người được nhận, đúng thứ tự.
9. Cố định được xét trước các yêu cầu khách chưa duyệt; trong nhóm cố định, admin không được dùng level/cặp để vượt người đăng ký thêm hợp lệ trước; từ chối có lý do và audit.
10. Gửi lại cùng yêu cầu/điểm danh do lỗi mạng: không trùng suất, không trùng công nợ.
11. Báo nghỉ 11:59:59 đúng hạn, 12:00:00 muộn; hủy không làm mất lịch cố định các buổi tương lai.
12. Đủ 8: không nhận thêm ai. Còn 7: ưu tiên cố định, sau đó có thể duyệt tối đa 1 khách. Còn 6: ưu tiên cố định, sau đó có thể duyệt tối đa 2 khách; không chặn vì số người là chẵn.
13. Đang xét khách từ 7 người nhưng nội bộ vừa nhận làm thành 8: chặn duyệt khách dựa trên số cũ; không vượt hàng ưu tiên.
14. Còn 5/4 người hoặc ít hơn 4, nhiều người hủy liên tiếp: chỉ xét số chỗ còn lại và thứ tự ưu tiên, không có điều kiện chẵn/lẻ; không tự hủy buổi hay tự thêm khách nếu chưa được duyệt.
15. Một người trong cặp nghỉ: không tự hủy người kia. Khách đã duyệt không bị đẩy ra vì thành viên đăng ký sau.
16. Người đã nghỉ hoặc tài khoản quản trị, request tự sửa person_id, admin CLB khác: bị chặn cả UI/API; kiểm tra lại lúc duyệt và công bố.
17. Thành viên thuộc nhiều CLB: không trộn lịch/khách/quỹ, không lộ dữ liệu CLB khác; không nhận hai buổi trùng giờ.
18. Người chờ/hủy không tạo nợ; cố định đăng ký thêm không tự chịu phí khách; phí trống dùng mặc định còn 0 là miễn rõ ràng.
19. Lỗi giữa chốt attendance và tạo nợ: toàn bộ thao tác thất bại an toàn; khoản đã trả/đối trừ không bị hủy/tạo lại âm thầm.
20. Đổi tuần/kỳ nhanh, lỗi API, bản nháp cũ, kỳ đóng, tuần giao hai kỳ, buổi đã hủy và thông báo lỗi: không hiện dữ liệu sai, không ghi chéo hoặc mất lịch sử.

## 13. Phạm vi chưa triển khai trong đợt này

- Xây lại toàn bộ database V2, xóa bảng hoặc xóa lịch sử.
- Tự sắp cặp thi đấu từng trận hoặc thay đổi hệ thống PK/rating.
- Phạt tiền, khóa tài khoản tự động do cảnh cáo, thanh toán giữ chỗ.
- Tích hợp Zalo/SMS/email khi chưa có kênh và quyền triển khai được duyệt.
- Tự tăng sân, giờ hoặc thay chỉ tiêu 4 buổi để vượt giới hạn sức chứa.

Mục tiêu nghiệm thu: admin hiểu được vì sao lịch được xếp như vậy, không có buổi vượt 8, thứ tự đăng ký thêm trong nhóm ưu tiên được bảo vệ, cố định được xét trước vãng lai mà không dùng điều kiện chẵn/lẻ, và lịch mới không làm sai công nợ hay dữ liệu lịch sử.
