export const emptyPerson = {
  full_name: '',
  phone: '',
  email: '',
  attendance_type: 'guest',
  note: '',
}

export const emptyPeriod = {
  name: '',
  start_date: '',
  end_date: '',
  fixed_member_fee: '',
  guest_fee_per_session: '',
  status: 'draft',
}

export const adminTabs = [
  ['dashboard', 'Tổng quan', 'Bức tranh chung'],
  ['analytics', 'Thống kê', 'Báo cáo chi tiết'],
  ['people', 'Nhân sự', 'Người trong câu lạc bộ'],
  ['periods', 'Kỳ quỹ', 'Kỳ sinh hoạt'],
  ['sessions', 'Buổi cầu', 'Lịch đã ghi nhận'],
  ['shuttle', 'Chi cầu', 'Mua và chia cầu'],
  ['debts', 'Công nợ', 'Khoản cần thu'],
  ['fund', 'Sổ quỹ', 'Thu chi câu lạc bộ'],
  ['pk', 'Đấu trường', 'Quản lý kèo PK'],
]

export const userTabs = [
  ['home', 'Trang cá nhân'],
  ['profile', 'Sửa hồ sơ'],
  ['pk', 'Đấu trường'],
  ['debts', 'Công nợ'],
  ['history', 'Lịch sử'],
  ['payment', 'Thanh toán'],
]

export const valueLabels = {
  paid: 'Đã thanh toán',
  unpaid: 'Chưa thanh toán',
  pending: 'Đang chờ',
  cancelled: 'Đã hủy',
  draft: 'Bản nháp',
  open: 'Đang mở',
  active: 'Đang hoạt động',
  closed: 'Đã chốt',
  income: 'Thu',
  expense: 'Chi',
  refund: 'Hoàn tiền',
  adjustment: 'Điều chỉnh',
  monthly_fee: 'Phí tháng',
  guest_fee: 'Phí khách',
  shuttle_fee: 'Phí cầu',
  shuttle_extra: 'Phí cầu',
  other: 'Khác',
  fixed: 'Đánh cố định',
  guest: 'Đánh vãng lai',
}
