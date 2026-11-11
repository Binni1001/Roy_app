/**
 * Period report: pure functions that turn period data into a printable HTML document.
 * Page 1 is a short summary anyone can read; an optional appendix holds the details.
 * Nothing here touches the DOM, so it can be unit tested.
 */

import { computeMonthStanding, isCloseoutDebt } from './memberStanding.js'
import {
  EXPENSE_CATEGORIES, INCOME_CATEGORIES, expenseCategoryKey, groupFund, incomeCategoryKey
} from './fundCategories.js'

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function fmt(amount) {
  if (amount == null) return '—'
  return Number(amount).toLocaleString('vi-VN') + 'đ'
}

export function fmtDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

// Technical descriptions -> readable Vietnamese
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

const isIncome = (f) => ['income', 'adjustment'].includes(f.transaction_type)
const sum = (list, pick) => list.reduce((total, item) => total + (Number(pick(item)) || 0), 0)

/** All numbers shown in the report, computed once. */
export function summarizePeriod({ debts = [], fund = [], shuttleExpenses = [] } = {}) {
  // End-of-period shuttle debts are settled with the period but collected in the
  // next one, so they are not part of what is "due this period".
  const liveDebts = debts.filter((d) => d.status !== 'cancelled')
  const validDebts = liveDebts.filter((d) => !isCloseoutDebt(d))
  const closeoutUnpaid = liveDebts.filter((d) => isCloseoutDebt(d) && d.status === 'unpaid')
  const closeoutUnpaidPeople = new Set(closeoutUnpaid.map((d) => d.person?.id || d.person_id || d.person?.full_name))
  const totalDebt = sum(validDebts, (d) => d.amount)
  const paidAmt = sum(validDebts.filter((d) => d.status === 'paid'), (d) => d.amount)
  const unpaidAmt = sum(validDebts.filter((d) => d.status === 'unpaid'), (d) => d.amount)

  const byPerson = new Map()
  for (const d of validDebts) {
    const name = d.person?.full_name || d.person?.nickname || '?'
    const key = d.person?.id || d.person_id || name
    if (!byPerson.has(key)) byPerson.set(key, { name, paid: 0, unpaid: 0 })
    const entry = byPerson.get(key)
    if (d.status === 'paid') entry.paid += Number(d.amount) || 0
    else if (d.status === 'unpaid') entry.unpaid += Number(d.amount) || 0
  }
  const people = [...byPerson.values()]
  const debtors = people.filter((p) => p.unpaid > 0).sort((a, b) => b.unpaid - a.unpaid)

  const totalIncome = sum(fund.filter(isIncome), (f) => f.amount)
  const totalExpense = sum(fund.filter((f) => !isIncome(f)), (f) => f.amount)

  const debtById = new Map(debts.map((d) => [d.id, d]))

  const tubes = sum(shuttleExpenses.filter((e) => e.buy_type === 'tube'), (e) => e.tube_count)
  const singles = sum(shuttleExpenses.filter((e) => e.buy_type === 'single'), (e) => e.single_count)

  return {
    totalDebt,
    paidAmt,
    unpaidAmt,
    paidPercent: totalDebt > 0 ? Math.round((paidAmt / totalDebt) * 100) : 0,
    people,
    debtors,
    paidPeopleCount: people.length - debtors.length,
    closeoutUnpaidAmt: sum(closeoutUnpaid, (d) => d.amount),
    closeoutUnpaidCount: closeoutUnpaidPeople.size,
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    incomeGroups: groupFund(fund.filter(isIncome), (f) => incomeCategoryKey(f, debtById), INCOME_CATEGORIES),
    expenseGroups: groupFund(fund.filter((f) => !isIncome(f)), expenseCategoryKey, EXPENSE_CATEGORIES),
    shuttle: {
      count: shuttleExpenses.length,
      total: sum(shuttleExpenses, (e) => e.total_amount),
      tubes,
      singles,
      pieces: shuttleExpenses.reduce((total, e) => total + (e.buy_type === 'tube'
        ? (Number(e.tube_count) || 0) * (Number(e.shuttle_per_tube) || 0)
        : (Number(e.single_count) || 0)), 0)
    }
  }
}

/** One plain sentence that answers "how are we doing this period?" */
export function headline(summary) {
  let text
  if (summary.totalDebt === 0) text = 'Kỳ này chưa có khoản công nợ nào.'
  else if (summary.unpaidAmt === 0) {
    text = `Tất cả ${summary.people.length} thành viên đã đóng đủ. Tổng đã thu ${fmt(summary.paidAmt)}.`
  } else {
    text = `Còn ${summary.debtors.length} người chưa đóng, tổng ${fmt(summary.unpaidAmt)}. `
      + `Đã thu ${fmt(summary.paidAmt)} trên ${fmt(summary.totalDebt)} (${summary.paidPercent}%).`
  }
  if (summary.closeoutUnpaidAmt > 0) {
    text += ` Tiền cầu cuối kỳ: ${summary.closeoutUnpaidCount} người chưa đóng (${fmt(summary.closeoutUnpaidAmt)}), thu vào kỳ sau.`
  }
  return text
}

const rows = (items, render, emptyColspan, emptyText = 'Không có') => items.length
  ? items.map(render).join('')
  : `<tr><td colspan="${emptyColspan}" class="empty">${emptyText}</td></tr>`

const byDate = (field) => (a, b) => new Date(a[field]) - new Date(b[field])

function categoryRows(groups, color) {
  if (!groups.length) return '<div class="cf-row"><span class="cf-cat">Không có</span></div>'
  return groups.map((g) => `
      <div class="cf-row">
        <span class="cf-cat">${esc(g.label)}<small>${esc(g.countText)} · ${esc(g.hint)}</small></span>
        <span class="cf-amt" style="color:${color}">${fmt(g.amount)}</span>
      </div>`).join('')
}

const STYLES = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #222; background: #fff; padding: 24px; line-height: 1.45; }
    .report-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .club-name { font-size: 19px; font-weight: 800; }
    .period-name { font-size: 14px; color: #444; margin-top: 3px; }
    .export-info { text-align: right; font-size: 11px; color: #777; }

    .headline { font-size: 16px; font-weight: 700; background: #fbf6e9; border: 1px solid #ecdcb0; border-radius: 8px; padding: 12px 14px; margin-bottom: 8px; }
    .progress { height: 10px; background: #eee; border-radius: 6px; overflow: hidden; margin-bottom: 14px; }
    .progress span { display: block; height: 100%; background: #2e7d32; }

    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
    .summary-card { border: 1px solid #ddd; border-radius: 8px; padding: 10px 12px; }
    .summary-card .label { font-size: 11px; color: #666; margin-bottom: 3px; }
    .summary-card .value { font-size: 17px; font-weight: 800; }
    .summary-card .hint { font-size: 10px; color: #999; margin-top: 2px; }
    .card-blue .value { color: #1565c0; } .card-green .value { color: #2e7d32; }
    .card-red .value { color: #c62828; } .card-gold .value { color: #b8860b; }

    section { margin-bottom: 18px; }
    h2 { font-size: 14px; font-weight: 800; border-left: 4px solid #b8860b; padding-left: 8px; margin-bottom: 8px; }
    h3 { font-size: 11px; font-weight: 700; color: #555; margin: 12px 0 6px; text-transform: uppercase; letter-spacing: .03em; }
    .note { font-size: 11px; color: #777; margin: 4px 0 8px; }

    .debtors { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 18px; }
    .debtor { display: flex; justify-content: space-between; border-bottom: 1px dotted #ccc; padding: 3px 0; }
    .debtor strong { color: #c62828; white-space: nowrap; margin-left: 8px; }

    .cashflow { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .cf-box { border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 12px; }
    .cf-box.in { background: #f4fbf5; border-color: #cfe9d3; } .cf-box.out { background: #fdf5f5; border-color: #f0d4d4; }
    .cf-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; padding-bottom: 5px; border-bottom: 1px dashed #ccc; }
    .cf-title { font-weight: 800; } .cf-total { font-size: 15px; font-weight: 800; }
    .cf-box.in .cf-title, .cf-box.in .cf-total { color: #2e7d32; } .cf-box.out .cf-title, .cf-box.out .cf-total { color: #c62828; }
    .cf-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; font-size: 12px; }
    .cf-cat small { display: block; font-size: 10px; color: #888; font-weight: 400; }
    .cf-amt { white-space: nowrap; }
    .cf-amt { font-weight: 600; }

    .pay-box { border: 1px dashed #b8860b; border-radius: 8px; padding: 10px 14px; background: #fffdf7; }

    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #f5f5f5; text-align: left; padding: 6px 8px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; color: #444; }
    td { padding: 5px 8px; border: 1px solid #eee; vertical-align: top; }
    td.num, th.num { text-align: right; white-space: nowrap; } td.empty { text-align: center; color: #999; }
    tr:nth-child(even) td { background: #fafafa; }
    .chip { display: inline-block; padding: 1px 7px; border-radius: 10px; font-size: 10px; font-weight: 600; }
    .chip-paid { background: #e8f5e9; color: #2e7d32; } .chip-unpaid { background: #ffebee; color: #c62828; }

    .appendix { break-before: page; page-break-before: always; }
    .footer { margin-top: 22px; border-top: 1px solid #ddd; padding-top: 8px; font-size: 10px; color: #999; text-align: center; }
    @media print {
      body { padding: 0; }
      section { break-inside: avoid; }
      tr { break-inside: avoid; }
      @page { margin: 14mm; size: A4 portrait; }
    }
    @media (max-width: 600px) { .summary-grid { grid-template-columns: 1fr 1fr; } .debtors, .cashflow { grid-template-columns: 1fr; } }`

/**
 * options.showNames      – list who still owes (default true); false shows only counts
 * options.includeDetails – append member table, shuttle purchases and fund ledger (default false)
 */
export function buildPeriodReportHtml(
  { period, debts = [], fund = [], shuttleExpenses = [], members = [], balances = [], people = null, settlementPreview = null } = {},
  { showNames = true, includeDetails = false, now = new Date() } = {}
) {
  const s = summarizePeriod({ debts, fund, shuttleExpenses })
  const standing = computeMonthStanding({ settlement: settlementPreview, debts, balances, people })
  const exportDate = fmtDate(now.toISOString())
  const periodName = period?.name || ''
  const dates = [period?.start_date && fmtDate(period.start_date), period?.end_date && fmtDate(period.end_date)]
    .filter(Boolean).join(' – ')

  const debtorSection = s.debtors.length === 0 ? '' : `
  <section>
    <h2>Ai còn phải đóng</h2>
    ${showNames ? `
    <div class="debtors">
      ${s.debtors.map((p) => `<div class="debtor"><span>${esc(p.name)}</span><strong>${fmt(p.unpaid)}</strong></div>`).join('')}
    </div>
    <p class="note">${s.paidPeopleCount} người khác đã đóng đủ.</p>`
    : `<p>${s.debtors.length} người chưa đóng, tổng <strong>${fmt(s.unpaidAmt)}</strong>. ${s.paidPeopleCount} người đã đóng đủ.</p>`}
  </section>`

  // Ai âm, ai dương: shuttle settlement of this period (money fronted − share owed).
  const standingNote = standing.source === 'settlement'
    ? (standing.settled
      ? 'Theo kết quả chia tiền cầu đã chốt: tiền đã ứng mua cầu − phần phải chịu.'
      : 'Dự kiến theo chia tiền cầu, kỳ chưa chốt nên có thể thay đổi.')
    : 'Tính theo số dư được nhận − công nợ chưa đóng (kỳ chưa có kết quả chia cầu).'
  const standingColumn = (title, cls, list, total, sign, rowNote) => `
      <div class="cf-box ${cls}">
        <div class="cf-head"><span class="cf-title">${title}</span><span class="cf-total">${fmt(Math.abs(total))}</span></div>
        ${showNames
    ? (list.length ? list.map((p) => `
        <div class="cf-row"><span class="cf-cat">${esc(p.name)}${rowNote(p)}</span>
          <span class="cf-amt">${sign}${fmt(Math.abs(p.net))}</span></div>`).join('')
      : '<div class="cf-row"><span class="cf-cat">Không có</span></div>')
    : `<div class="cf-row"><span class="cf-cat">${list.length} người</span></div>`}
      </div>`
  const standingSection = standing.positive.length + standing.negative.length === 0 ? '' : `
  <section>
    <h2>Tiền cầu cuối kỳ: ai âm, ai dương</h2>
    <div class="cashflow">
      ${standingColumn('➕ Dương — được nhận lại', 'in', standing.positive, standing.totalPositive, '+', () => '')}
      ${standingColumn('➖ Âm — cần đóng', 'out', standing.negative, standing.totalNegative, '−',
    (p) => (standing.source === 'settlement' ? (p.outstanding > 0 ? ' · thu vào kỳ sau' : ' · đã đóng') : ''))}
    </div>
    <p class="note">${standingNote} Khoản âm chưa đóng sẽ được thu vào kỳ sau.</p>
  </section>`

  const incomeDiffers = s.totalIncome !== s.paidAmt
  const cashflowSection = fund.length === 0 ? '' : `
  <section>
    <h2>Tiền quỹ trong kỳ</h2>
    <div class="cashflow">
      <div class="cf-box in">
        <div class="cf-head"><span class="cf-title">💰 Tiền vào</span><span class="cf-total">${fmt(s.totalIncome)}</span></div>
        ${categoryRows(s.incomeGroups, '#2e7d32')}
      </div>
      <div class="cf-box out">
        <div class="cf-head"><span class="cf-title">💸 Tiền ra</span><span class="cf-total">${fmt(s.totalExpense)}</span></div>
        ${categoryRows(s.expenseGroups, '#c62828')}
      </div>
    </div>
    <p class="note">Quỹ còn lại = Tiền vào − Tiền ra = <strong>${fmt(s.balance)}</strong>${s.balance === 0 ? ' (đã chốt và kết chuyển sang kỳ sau)' : ''}.
      ${incomeDiffers ? 'Tiền vào có thể khác “Đã thu” ở trên vì gồm cả số dư kỳ trước chuyển sang và các khoản thu ngoài công nợ.' : ''}
      Khoản thu được nhóm theo loại công nợ đã đóng; khoản chi được nhóm theo nội dung ghi trong sổ quỹ.</p>
  </section>`

  const shuttleSection = s.shuttle.count === 0 ? '' : `
  <section>
    <h2>Mua cầu trong kỳ</h2>
    <p>${s.shuttle.count} lần mua, tổng <strong>${fmt(s.shuttle.total)}</strong> —
      ${s.shuttle.tubes} ống${s.shuttle.singles > 0 ? ` + ${s.shuttle.singles} quả lẻ` : ''}
      (khoảng <strong>${s.shuttle.pieces} quả</strong>).</p>
  </section>`

  const appendix = !includeDetails ? '' : `
  <div class="appendix">
    <section>
      <h2>Phụ lục 1 — Tình trạng đóng tiền từng thành viên</h2>
      <table>
        <thead><tr><th>Họ tên</th><th class="num">Đã đóng</th><th class="num">Còn nợ</th><th>Trạng thái</th></tr></thead>
        <tbody>${rows([...s.people].sort((a, b) => b.unpaid - a.unpaid), (p) => `
          <tr><td>${esc(p.name)}</td><td class="num">${fmt(p.paid)}</td>
          <td class="num">${p.unpaid > 0 ? fmt(p.unpaid) : '—'}</td>
          <td><span class="chip ${p.unpaid > 0 ? 'chip-unpaid' : 'chip-paid'}">${p.unpaid > 0 ? 'Còn nợ' : 'Đã đủ'}</span></td></tr>`, 4, 'Không có dữ liệu')}</tbody>
      </table>
    </section>
    ${shuttleExpenses.length ? `
    <section>
      <h2>Phụ lục 2 — Các lần mua cầu</h2>
      <table>
        <thead><tr><th>Ngày</th><th>Người mua</th><th>Số lượng</th><th class="num">Tổng tiền</th><th>Ghi chú</th></tr></thead>
        <tbody>${rows([...shuttleExpenses].sort((a, b) => new Date(b.buy_date || b.created_at) - new Date(a.buy_date || a.created_at)), (e) => `
          <tr><td>${fmtDate(e.buy_date || e.created_at)}</td><td>${esc(e.buyer?.full_name || '—')}</td>
          <td>${e.buy_type === 'tube' ? `${esc(e.tube_count)} ống × ${esc(e.shuttle_per_tube)}` : `${esc(e.single_count)} quả lẻ`}</td>
          <td class="num">${fmt(e.total_amount)}</td><td>${esc(e.note || '—')}</td></tr>`, 5)}</tbody>
      </table>
    </section>` : ''}
    ${fund.length ? ['Tiền vào', 'Tiền ra'].map((title, i) => {
      const list = fund.filter((f) => (i === 0 ? isIncome(f) : !isIncome(f))).sort(byDate('created_at'))
      return `
    <section>
      <h2>Phụ lục ${3 + i} — ${title} (${fmt(i === 0 ? s.totalIncome : s.totalExpense)})</h2>
      <table>
        <thead><tr><th>Ngày</th><th>Người</th><th class="num">Số tiền</th><th>Nội dung</th></tr></thead>
        <tbody>${rows(list, (f) => `
          <tr><td>${fmtDate(f.created_at)}</td><td>${esc(f.person?.full_name || '—')}</td>
          <td class="num">${fmt(f.amount)}</td><td>${esc(cleanDesc(f.description))}</td></tr>`, 4)}</tbody>
      </table>
    </section>`
    }).join('') : ''}
  </div>`

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(reportFileName(period))}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="report-header">
    <div>
      <div class="club-name">🏸 Roy Badminton Club</div>
      <div class="period-name">Báo cáo kỳ <strong>${esc(periodName || 'N/A')}</strong>${dates ? ` · ${dates}` : ''}</div>
    </div>
    <div class="export-info">
      <div>Xuất ngày ${exportDate}</div>
      <div>${members.length} thành viên</div>
    </div>
  </div>

  <div class="headline">${esc(headline(s))}</div>
  ${s.totalDebt > 0 ? `<div class="progress"><span style="width:${s.paidPercent}%"></span></div>` : ''}

  <div class="summary-grid">
    <div class="summary-card card-blue"><div class="label">Cần thu trong kỳ</div><div class="value">${fmt(s.totalDebt)}</div></div>
    <div class="summary-card card-green"><div class="label">Đã thu</div><div class="value">${fmt(s.paidAmt)}</div></div>
    <div class="summary-card card-red"><div class="label">Còn phải thu</div><div class="value">${fmt(s.unpaidAmt)}</div></div>
    <div class="summary-card card-gold"><div class="label">Quỹ còn lại</div><div class="value">${fmt(s.balance)}</div><div class="hint">Tiền vào − tiền ra</div></div>
  </div>

  ${debtorSection}
  ${standingSection}
  ${cashflowSection}
  ${shuttleSection}

  ${s.unpaidAmt > 0 ? `
  <section>
    <div class="pay-box"><strong>Cách đóng tiền:</strong> mở ứng dụng Roy Badminton, vào phần công nợ của bạn và chọn “Thanh toán PayOS” để quét mã QR. Hệ thống tự ghi nhận sau khi thanh toán thành công.</div>
  </section>` : ''}

  ${appendix}

  <div class="footer">Báo cáo được xuất tự động từ hệ thống Roy Badminton Club · ${exportDate}</div>
</body>
</html>`
}

/** Used as the document title, which browsers offer as the default PDF file name. */
export function reportFileName(period) {
  const name = String(period?.name || 'bao-cao').trim()
  return `Bao-cao-ky-${name}`.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-')
}
