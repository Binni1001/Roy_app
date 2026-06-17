/**
 * Generate and open a print-ready report window for a period.
 * User can print → Save as PDF from browser dialog.
 */

function fmt(amount) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

const DEBT_TYPE_LABEL = {
  monthly_fee: 'Phí tháng',
  guest_fee:   'Phí khách',
  shuttle_extra: 'Phí cầu',
  other: 'Khác',
}

const FUND_TYPE_LABEL = {
  income:     'Thu',
  expense:    'Chi',
  refund:     'Hoàn tiền',
  adjustment: 'Điều chỉnh',
}

const STATUS_LABEL = {
  paid:      'Đã thanh toán',
  unpaid:    'Chưa thu',
  cancelled: 'Đã hủy',
}

export function printPeriodReport({ period, debts = [], fund = [], shuttleExpenses = [], members = [] }) {
  const now = new Date()
  const exportDate = fmtDate(now.toISOString())

  // Compute stats
  const validDebts  = debts.filter((d) => d.status !== 'cancelled')
  const paidDebts   = validDebts.filter((d) => d.status === 'paid')
  const unpaidDebts = validDebts.filter((d) => d.status === 'unpaid')
  const totalDebt   = validDebts.reduce((s,d) => s + Number(d.amount), 0)
  const paidAmt     = paidDebts.reduce((s,d) => s + Number(d.amount), 0)
  const unpaidAmt   = unpaidDebts.reduce((s,d) => s + Number(d.amount), 0)

  const income  = fund.filter((f) => f.transaction_type === 'income').reduce((s,f) => s+Number(f.amount), 0)
  const expense = fund.filter((f) => f.transaction_type === 'expense').reduce((s,f) => s+Number(f.amount), 0)
  const refund  = fund.filter((f) => f.transaction_type === 'refund').reduce((s,f) => s+Number(f.amount), 0)
  const adjust  = fund.filter((f) => f.transaction_type === 'adjustment').reduce((s,f) => s+Number(f.amount), 0)
  const balance = income + adjust - expense - refund

  const totalShuttle = shuttleExpenses.reduce((s,e) => s+Number(e.total_amount), 0)

  // Group debts by person
  const debtByPerson = {}
  validDebts.forEach((d) => {
    const name = d.person?.full_name || d.person?.nickname || '?'
    if (!debtByPerson[name]) debtByPerson[name] = { paid: 0, unpaid: 0, items: [] }
    debtByPerson[name].items.push(d)
    if (d.status === 'paid') debtByPerson[name].paid += Number(d.amount)
    else debtByPerson[name].unpaid += Number(d.amount)
  })

  const debtRows = Object.entries(debtByPerson)
    .sort((a, b) => b[1].unpaid - a[1].unpaid)
    .map(([name, d]) => `
      <tr>
        <td>${name}</td>
        <td style="color:#2e7d32">${fmt(d.paid)}</td>
        <td style="color:#c62828">${d.unpaid > 0 ? fmt(d.unpaid) : '—'}</td>
        <td><span class="status-chip ${d.unpaid > 0 ? 'chip-unpaid' : 'chip-paid'}">${d.unpaid > 0 ? 'Còn nợ' : 'Đã đủ'}</span></td>
      </tr>
    `).join('')

  const fundRows = [...fund]
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    .map((f) => `
      <tr>
        <td>${fmtDate(f.created_at)}</td>
        <td>${FUND_TYPE_LABEL[f.transaction_type] || f.transaction_type}</td>
        <td>${f.person?.full_name || '—'}</td>
        <td style="color:${['income','adjustment'].includes(f.transaction_type) ? '#2e7d32' : '#c62828'}">
          ${['income','adjustment'].includes(f.transaction_type) ? '+' : '-'}${fmt(f.amount)}
        </td>
        <td>${f.description || '—'}</td>
      </tr>
    `).join('')

  const shuttleRows = shuttleExpenses
    .sort((a,b) => new Date(b.buy_date || b.created_at) - new Date(a.buy_date || a.created_at))
    .map((e) => `
      <tr>
        <td>${fmtDate(e.buy_date || e.created_at)}</td>
        <td>${e.buyer?.full_name || '—'}</td>
        <td>${e.buy_type === 'tube' ? `${e.tube_count} ống × ${e.shuttle_per_tube}` : `${e.single_count} quả lẻ`}</td>
        <td>${fmt(e.total_amount)}</td>
        <td>${e.note || '—'}</td>
      </tr>
    `).join('')

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <title>Báo cáo kỳ ${period?.name || ''}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #222; background: #fff; padding: 24px; }

    .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 12px; }
    .club-name { font-size: 18px; font-weight: 800; color: #1a1a1a; }
    .period-name { font-size: 13px; color: #555; margin-top: 4px; }
    .export-info { text-align: right; font-size: 11px; color: #777; }

    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
    .summary-card { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; }
    .summary-card .label { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .summary-card .value { font-size: 16px; font-weight: 700; }
    .card-green .value { color: #2e7d32; }
    .card-red   .value { color: #c62828; }
    .card-blue  .value { color: #1565c0; }
    .card-gold  .value { color: #b8860b; }

    section { margin-bottom: 22px; }
    h2 { font-size: 13px; font-weight: 700; color: #333; border-left: 3px solid #b8860b; padding-left: 8px; margin-bottom: 8px; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-weight: 600; color: #444; font-size: 10px; text-transform: uppercase; }
    td { padding: 5px 8px; border: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }

    .status-chip { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .chip-paid   { background: #e8f5e9; color: #2e7d32; }
    .chip-unpaid { background: #ffebee; color: #c62828; }

    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #999; text-align: center; }

    @media print {
      body { padding: 12px; font-size: 11px; }
      .no-print { display: none !important; }
      .summary-grid { grid-template-columns: repeat(4, 1fr); }
      @page { margin: 15mm; size: A4 portrait; }
    }
  </style>
</head>
<body>

  <div class="no-print" style="text-align:center;margin-bottom:16px">
    <button onclick="window.print()" style="padding:10px 28px;font-size:14px;background:#b8860b;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:700">
      🖨️ In / Lưu PDF
    </button>
    <button onclick="window.close()" style="padding:10px 20px;font-size:14px;background:#eee;border:none;border-radius:6px;cursor:pointer;margin-left:10px">
      Đóng
    </button>
  </div>

  <div class="report-header">
    <div>
      <div class="club-name">🏸 Roy Badminton Club</div>
      <div class="period-name">Kỳ: <strong>${period?.name || 'N/A'}</strong>
        ${period?.start_date ? ` | ${fmtDate(period.start_date)}` : ''}
        ${period?.end_date ? ` – ${fmtDate(period.end_date)}` : ''}
      </div>
    </div>
    <div class="export-info">
      <div>Báo cáo tài chính</div>
      <div>Xuất ngày: ${exportDate}</div>
      <div>Thành viên: ${members.length} người</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card card-blue">
      <div class="label">Tổng công nợ</div>
      <div class="value">${fmt(totalDebt)}</div>
    </div>
    <div class="summary-card card-green">
      <div class="label">Đã thu</div>
      <div class="value">${fmt(paidAmt)}</div>
    </div>
    <div class="summary-card card-red">
      <div class="label">Còn nợ</div>
      <div class="value">${fmt(unpaidAmt)}</div>
    </div>
    <div class="summary-card card-gold">
      <div class="label">Số dư quỹ</div>
      <div class="value">${fmt(balance)}</div>
    </div>
  </div>

  <section>
    <h2>Tình trạng thanh toán theo thành viên</h2>
    <table>
      <thead><tr><th>Họ tên</th><th>Đã đóng</th><th>Còn nợ</th><th>Trạng thái</th></tr></thead>
      <tbody>${debtRows || '<tr><td colspan="4" style="text-align:center;color:#999">Không có dữ liệu</td></tr>'}</tbody>
    </table>
  </section>

  ${fund.length > 0 ? `
  <section>
    <h2>Sổ quỹ câu lạc bộ (${fund.length} giao dịch)</h2>
    <table>
      <thead><tr><th>Ngày</th><th>Loại</th><th>Người</th><th>Số tiền</th><th>Nội dung</th></tr></thead>
      <tbody>${fundRows}</tbody>
    </table>
    <p style="margin-top:6px;font-size:11px;color:#555">
      Thu: <strong style="color:#2e7d32">${fmt(income)}</strong> &nbsp;|&nbsp;
      Chi: <strong style="color:#c62828">${fmt(expense)}</strong> &nbsp;|&nbsp;
      Số dư: <strong style="color:#b8860b">${fmt(balance)}</strong>
    </p>
  </section>` : ''}

  ${shuttleExpenses.length > 0 ? `
  <section>
    <h2>Chi phí cầu (${shuttleExpenses.length} lần mua — tổng ${fmt(totalShuttle)})</h2>
    <table>
      <thead><tr><th>Ngày</th><th>Người mua</th><th>Số lượng</th><th>Tổng tiền</th><th>Ghi chú</th></tr></thead>
      <tbody>${shuttleRows}</tbody>
    </table>
  </section>` : ''}

  <div class="footer">
    Báo cáo được xuất tự động từ hệ thống Roy Badminton Club · ${exportDate}
  </div>

</body>
</html>`

  const win = window.open('', '_blank', 'width=900,height=700')
  if (!win) {
    alert('Trình duyệt đã chặn cửa sổ mới. Vui lòng cho phép popup cho trang này.')
    return
  }
  win.document.write(html)
  win.document.close()
}
