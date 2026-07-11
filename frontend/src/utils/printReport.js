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

// Dọn mô tả kỹ thuật -> tiếng Việt dễ đọc
function cleanDesc(desc) {
  if (!desc) return '—'
  const s = String(desc)
    .replace(/\s*\[guest_attendance:[^\]]*\]/gi, '')
    .replace(/shuttle_extra/gi, 'tiền cầu bù cuối kỳ')
    .replace(/monthly_fee/gi, 'quỹ tháng')
    .replace(/guest_fee/gi, 'khách vãng lai')
    .replace(/^Thu tien\s*-?\s*/i, '')
    .replace(/^Thu\s*-\s*/i, '')
    .trim()
  return s || '—'
}

const norm = (s) => (s || '').toLowerCase()

// Gom khoản THU vào nhóm dễ hiểu
function incomeCategory(f) {
  const d = norm(f.description)
  if (d.includes('mang sang')) return 'Số dư kỳ trước chuyển sang'
  if (d.includes('shuttle_extra') || d.includes('tiền cầu') || d.includes('tien cau')) return 'Tiền cầu (bù cuối kỳ)'
  if (d.includes('quỹ tháng') || d.includes('monthly_fee') || d.includes('quy thang')) return 'Quỹ tháng'
  if (d.includes('vãng lai') || d.includes('vang lai') || d.includes('guest') || d.includes('khach')) return 'Khách vãng lai'
  if (d.includes('sân') || d.includes('san')) return 'Tiền sân / ống cầu (thành viên ứng)'
  return 'Thu khác'
}

// Gom khoản CHI vào nhóm dễ hiểu
function expenseCategory(f) {
  if (f.transaction_type === 'refund') return 'Hoàn tiền cho thành viên'
  const d = norm(f.description)
  if (d.includes('kết chuyển') || d.includes('ket chuyen')) return 'Kết chuyển sang kỳ sau'
  if (d.includes('lưới') || d.includes('luoi') || d.includes('keo')) return 'Lưới / keo / phụ kiện'
  if (d.includes('sân') || d.includes('san')) return 'Tiền sân'
  if (d.includes('cầu') || d.includes('cau')) return 'Mua cầu'
  return 'Chi khác'
}

export function printPeriodReport({ period, debts = [], fund = [], shuttleExpenses = [], members = [] }) {
  const now = new Date()
  const exportDate = fmtDate(now.toISOString())

  // ── Công nợ ──
  const validDebts  = debts.filter((d) => d.status !== 'cancelled')
  const paidDebts   = validDebts.filter((d) => d.status === 'paid')
  const unpaidDebts = validDebts.filter((d) => d.status === 'unpaid')
  const totalDebt   = validDebts.reduce((s,d) => s + Number(d.amount), 0)
  const paidAmt     = paidDebts.reduce((s,d) => s + Number(d.amount), 0)
  const unpaidAmt   = unpaidDebts.reduce((s,d) => s + Number(d.amount), 0)

  // ── Quỹ ──
  const isIncome = (f) => ['income', 'adjustment'].includes(f.transaction_type)
  const totalIncome  = fund.filter(isIncome).reduce((s,f) => s+Number(f.amount), 0)
  const totalExpense = fund.filter((f) => !isIncome(f)).reduce((s,f) => s+Number(f.amount), 0)
  const balance = totalIncome - totalExpense

  const totalShuttle = shuttleExpenses.reduce((s,e) => s+Number(e.total_amount), 0)
  // Thống kê số lượng cầu
  const totalTubes   = shuttleExpenses.filter((e) => e.buy_type === 'tube')
    .reduce((s,e) => s + Number(e.tube_count || 0), 0)
  const totalSingles = shuttleExpenses.filter((e) => e.buy_type === 'single')
    .reduce((s,e) => s + Number(e.single_count || 0), 0)
  const totalShuttleQua = shuttleExpenses.reduce((s,e) =>
    s + (e.buy_type === 'tube'
      ? Number(e.tube_count || 0) * Number(e.shuttle_per_tube || 0)
      : Number(e.single_count || 0)), 0)

  // Gom nhóm thu/chi
  const incomeGroups = {}
  const expenseGroups = {}
  fund.forEach((f) => {
    const amt = Number(f.amount) || 0
    if (isIncome(f)) {
      const c = incomeCategory(f); incomeGroups[c] = (incomeGroups[c] || 0) + amt
    } else {
      const c = expenseCategory(f); expenseGroups[c] = (expenseGroups[c] || 0) + amt
    }
  })
  const groupRows = (groups, color) => Object.entries(groups)
    .sort((a,b) => b[1] - a[1])
    .map(([name, amt]) => `
      <div class="cf-row">
        <span class="cf-cat">${name}</span>
        <span class="cf-amt" style="color:${color}">${fmt(amt)}</span>
      </div>`).join('')

  // ── Bảng thành viên ──
  const debtByPerson = {}
  validDebts.forEach((d) => {
    const name = d.person?.full_name || d.person?.nickname || '?'
    if (!debtByPerson[name]) debtByPerson[name] = { paid: 0, unpaid: 0 }
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
      </tr>`).join('')

  // ── Phụ lục chi tiết (đã Việt hoá, tách Thu/Chi) ──
  const detailRows = (list) => list
    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
    .map((f) => `
      <tr>
        <td>${fmtDate(f.created_at)}</td>
        <td>${f.person?.full_name || '—'}</td>
        <td class="num">${fmt(f.amount)}</td>
        <td>${cleanDesc(f.description)}</td>
      </tr>`).join('')
  const incomeDetail  = detailRows(fund.filter(isIncome))
  const expenseDetail = detailRows(fund.filter((f) => !isIncome(f)))

  const shuttleRows = shuttleExpenses
    .sort((a,b) => new Date(b.buy_date || b.created_at) - new Date(a.buy_date || a.created_at))
    .map((e) => `
      <tr>
        <td>${fmtDate(e.buy_date || e.created_at)}</td>
        <td>${e.buyer?.full_name || '—'}</td>
        <td>${e.buy_type === 'tube' ? `${e.tube_count} ống × ${e.shuttle_per_tube}` : `${e.single_count} quả lẻ`}</td>
        <td class="num">${fmt(e.total_amount)}</td>
        <td>${e.note || '—'}</td>
      </tr>`).join('')

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
    h3 { font-size: 11px; font-weight: 700; color: #555; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: 0.03em; }

    /* Dòng tiền tóm tắt */
    .cashflow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .cf-box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px 14px; }
    .cf-box.in  { background: #f4fbf5; border-color: #cfe9d3; }
    .cf-box.out { background: #fdf5f5; border-color: #f0d4d4; }
    .cf-head { display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed #ccc; }
    .cf-title { font-size: 12px; font-weight: 800; }
    .cf-box.in .cf-title { color: #2e7d32; }
    .cf-box.out .cf-title { color: #c62828; }
    .cf-total { font-size: 15px; font-weight: 800; }
    .cf-box.in .cf-total { color: #2e7d32; }
    .cf-box.out .cf-total { color: #c62828; }
    .cf-row { display:flex; justify-content:space-between; padding: 3px 0; font-size: 11px; }
    .cf-cat { color: #444; }
    .cf-amt { font-weight: 600; }
    .cf-balance { margin-top: 12px; text-align:center; background:#fbf6e9; border:1px solid #ecdcb0; border-radius:8px; padding: 10px; }
    .cf-balance .bl-label { font-size: 11px; color:#8a6d1a; text-transform:uppercase; letter-spacing:.05em; }
    .cf-balance .bl-value { font-size: 18px; font-weight: 800; color:#b8860b; }
    .cf-balance .bl-note { font-size: 10px; color:#999; margin-top:2px; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-weight: 600; color: #444; font-size: 10px; text-transform: uppercase; }
    td { padding: 5px 8px; border: 1px solid #eee; vertical-align: top; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    tr:nth-child(even) td { background: #fafafa; }

    .status-chip { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .chip-paid   { background: #e8f5e9; color: #2e7d32; }
    .chip-unpaid { background: #ffebee; color: #c62828; }

    .muted-note { font-size: 10px; color: #999; margin-bottom: 8px; }
    .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; font-size: 10px; color: #999; text-align: center; }

    @media print {
      body { padding: 12px; font-size: 11px; }
      .no-print { display: none !important; }
      section { break-inside: avoid; }
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
      <div class="label">Số dư quỹ cuối kỳ</div>
      <div class="value">${fmt(balance)}</div>
    </div>
  </div>

  ${fund.length > 0 ? `
  <section>
    <h2>Dòng tiền trong kỳ</h2>
    <p class="muted-note">Tổng hợp tiền vào / ra của quỹ, gom theo mục đích cho dễ xem.</p>
    <div class="cashflow">
      <div class="cf-box in">
        <div class="cf-head"><span class="cf-title">💰 TIỀN VÀO</span><span class="cf-total">${fmt(totalIncome)}</span></div>
        ${groupRows(incomeGroups, '#2e7d32') || '<div class="cf-row"><span class="cf-cat">Không có</span></div>'}
      </div>
      <div class="cf-box out">
        <div class="cf-head"><span class="cf-title">💸 TIỀN RA</span><span class="cf-total">${fmt(totalExpense)}</span></div>
        ${groupRows(expenseGroups, '#c62828') || '<div class="cf-row"><span class="cf-cat">Không có</span></div>'}
      </div>
    </div>
    <div class="cf-balance">
      <div class="bl-label">Số dư quỹ cuối kỳ</div>
      <div class="bl-value">${fmt(balance)}</div>
      ${balance === 0 ? '<div class="bl-note">Đã chốt & kết chuyển sang kỳ sau</div>' : ''}
    </div>
  </section>` : ''}

  <section>
    <h2>Tình trạng đóng tiền theo thành viên</h2>
    <table>
      <thead><tr><th>Họ tên</th><th>Đã đóng</th><th>Còn nợ</th><th>Trạng thái</th></tr></thead>
      <tbody>${debtRows || '<tr><td colspan="4" style="text-align:center;color:#999">Không có dữ liệu</td></tr>'}</tbody>
    </table>
  </section>

  ${shuttleExpenses.length > 0 ? `
  <section>
    <h2>Chi phí mua cầu (${shuttleExpenses.length} lần — tổng ${fmt(totalShuttle)})</h2>
    <p class="muted-note">
      Tổng đã mua: <strong>${totalTubes} ống</strong>${totalSingles > 0 ? ` + <strong>${totalSingles} quả lẻ</strong>` : ''}
      = <strong>${totalShuttleQua} quả cầu</strong> · Chi <strong>${fmt(totalShuttle)}</strong>
    </p>
    <table>
      <thead><tr><th>Ngày</th><th>Người mua</th><th>Số lượng</th><th class="num">Tổng tiền</th><th>Ghi chú</th></tr></thead>
      <tbody>${shuttleRows}</tbody>
    </table>
  </section>` : ''}

  ${fund.length > 0 ? `
  <section>
    <h2>Phụ lục — Chi tiết giao dịch quỹ</h2>
    <p class="muted-note">Danh sách đầy đủ để đối chiếu (${fund.length} giao dịch).</p>

    <h3>Tiền vào — ${fmt(totalIncome)}</h3>
    <table>
      <thead><tr><th>Ngày</th><th>Người</th><th class="num">Số tiền</th><th>Nội dung</th></tr></thead>
      <tbody>${incomeDetail || '<tr><td colspan="4" style="text-align:center;color:#999">Không có</td></tr>'}</tbody>
    </table>

    <h3>Tiền ra — ${fmt(totalExpense)}</h3>
    <table>
      <thead><tr><th>Ngày</th><th>Người</th><th class="num">Số tiền</th><th>Nội dung</th></tr></thead>
      <tbody>${expenseDetail || '<tr><td colspan="4" style="text-align:center;color:#999">Không có</td></tr>'}</tbody>
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
