import { useMemo } from 'react'
import { Panel } from '../../../components/common'
import { formatMoney, formatDate } from '../../../utils/appUtils'
import { printPeriodReport } from '../../../utils/printReport'

/* ─────────────────────────────────────────
   CHART PRIMITIVES (pure CSS / SVG)
───────────────────────────────────────── */

/** Horizontal segmented bar: [{value, color, label}] */
function SegmentBar({ segments, height = 12 }) {
  const total = segments.reduce((s, g) => s + g.value, 0)
  if (total === 0) return <div className="an-bar-empty">Chưa có dữ liệu</div>
  return (
    <div className="an-seg-bar" style={{ height }}>
      {segments.map((seg, i) => (
        <div
          key={i}
          className={`an-seg ${seg.cls}`}
          style={{ width: `${(seg.value / total) * 100}%` }}
          title={`${seg.label}: ${formatMoney(seg.value)}`}
        />
      ))}
    </div>
  )
}

/** Donut ring SVG */
function DonutRing({ pct, color = '#4caf7d', size = 80, stroke = 10, label, sub }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const dash = (Math.min(pct, 100) / 100) * circ
  return (
    <div className="an-donut-wrap">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div className="an-donut-center">
        <strong style={{ color }}>{Math.round(pct)}%</strong>
        {sub && <small>{sub}</small>}
      </div>
      {label && <span className="an-donut-label">{label}</span>}
    </div>
  )
}

/** Simple vertical bar chart */
function BarChart({ bars, height = 80 }) {
  const max = Math.max(...bars.map((b) => b.value), 1)
  return (
    <div className="an-barchart" style={{ height }}>
      {bars.map((b, i) => (
        <div key={i} className="an-bar-col">
          <div className="an-bar-track" style={{ height }}>
            <div
              className={`an-bar-fill ${b.cls || 'an-bar-default'}`}
              style={{ height: `${(b.value / max) * 100}%` }}
              title={`${b.label}: ${b.formatted || b.value}`}
            />
          </div>
          <span className="an-bar-x">{b.label}</span>
        </div>
      ))}
    </div>
  )
}

/** Stat card */
function StatCard({ label, value, sub, accent }) {
  return (
    <div className="an-stat-card" style={accent ? { borderColor: accent } : {}}>
      <span className="an-stat-label">{label}</span>
      <strong className="an-stat-value" style={accent ? { color: accent } : {}}>{value}</strong>
      {sub && <small className="an-stat-sub">{sub}</small>}
    </div>
  )
}

/* ─────────────────────────────────────────
   SECTIONS
───────────────────────────────────────── */

function DebtSection({ debts }) {
  const all = debts.filter((d) => d.status !== 'cancelled')
  const paid = all.filter((d) => d.status === 'paid')
  const unpaid = all.filter((d) => d.status === 'unpaid')
  const totalAmt   = all.reduce((s, d) => s + Number(d.amount), 0)
  const paidAmt    = paid.reduce((s, d) => s + Number(d.amount), 0)
  const unpaidAmt  = unpaid.reduce((s, d) => s + Number(d.amount), 0)
  const pct = totalAmt > 0 ? (paidAmt / totalAmt) * 100 : 0

  // Group unpaid by person
  const unpaidByPerson = {}
  unpaid.forEach((d) => {
    const name = d.person?.full_name || d.person?.nickname || '?'
    if (!unpaidByPerson[name]) unpaidByPerson[name] = 0
    unpaidByPerson[name] += Number(d.amount)
  })
  const unpaidPeople = Object.entries(unpaidByPerson).sort((a, b) => b[1] - a[1])

  return (
    <Panel title="📋 Tình trạng thu nợ">
      <div className="an-row-wrap">
        <div className="an-col-center">
          <DonutRing pct={pct} color="#4caf7d" size={100} stroke={12} label="Đã thu" />
        </div>
        <div className="an-col-grow">
          <div className="an-stat-row">
            <StatCard label="Tổng cần thu" value={formatMoney(totalAmt)} />
            <StatCard label="Đã thu" value={formatMoney(paidAmt)} accent="#4caf7d" />
            <StatCard label="Còn lại" value={formatMoney(unpaidAmt)} accent="#e57373" />
          </div>
          <SegmentBar segments={[
            { value: paidAmt,   cls: 'an-seg-green',  label: 'Đã thu' },
            { value: unpaidAmt, cls: 'an-seg-red',    label: 'Chưa thu' },
          ]} height={10} />
          <div className="an-legend">
            <span><span className="an-dot an-dot-green" />Đã thu ({paid.length})</span>
            <span><span className="an-dot an-dot-red" />Chưa thu ({unpaid.length})</span>
          </div>
        </div>
      </div>

      {unpaidPeople.length > 0 && (
        <div className="an-unpaid-list">
          <p className="an-section-title">Người chưa đóng tiền</p>
          {unpaidPeople.map(([name, amt]) => (
            <div key={name} className="an-unpaid-row">
              <span className="an-unpaid-name">{name}</span>
              <span className="an-unpaid-amt">{formatMoney(amt)}</span>
              <div className="an-mini-bar-wrap">
                <div className="an-mini-bar" style={{ width: `${Math.min(100, (amt / unpaidAmt) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function FundSection({ fund }) {
  const income   = fund.filter((f) => f.transaction_type === 'income').reduce((s, f) => s + Number(f.amount), 0)
  const expense  = fund.filter((f) => f.transaction_type === 'expense').reduce((s, f) => s + Number(f.amount), 0)
  const refund   = fund.filter((f) => f.transaction_type === 'refund').reduce((s, f) => s + Number(f.amount), 0)
  const adjust   = fund.filter((f) => f.transaction_type === 'adjustment').reduce((s, f) => s + Number(f.amount), 0)
  const balance  = income + adjust - expense - refund

  // Group fund by date for trend chart
  const byDate = {}
  const sorted = [...fund].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let running = 0
  const trend = sorted.map((f) => {
    const delta = f.transaction_type === 'income' || f.transaction_type === 'adjustment'
      ? Number(f.amount) : -Number(f.amount)
    running += delta
    return { label: formatDate(f.created_at).slice(0, 5), value: Math.max(0, running), formatted: formatMoney(running), cls: delta >= 0 ? 'an-bar-income' : 'an-bar-expense' }
  })

  return (
    <Panel title="💰 Biến động quỹ">
      <div className="an-stat-row">
        <StatCard label="Thu" value={formatMoney(income)} accent="#4caf7d" />
        <StatCard label="Chi" value={formatMoney(expense)} accent="#e57373" />
        <StatCard label="Số dư" value={formatMoney(balance)} accent={balance >= 0 ? '#d8ae52' : '#e57373'} />
      </div>

      <SegmentBar segments={[
        { value: income,  cls: 'an-seg-green',  label: 'Thu' },
        { value: expense, cls: 'an-seg-red',    label: 'Chi' },
        { value: refund,  cls: 'an-seg-yellow', label: 'Hoàn' },
      ]} height={10} />

      {trend.length > 0 && (
        <div className="an-trend-section">
          <p className="an-section-title">Số dư tích lũy theo giao dịch</p>
          <BarChart bars={trend.slice(-20)} height={70} />
        </div>
      )}
    </Panel>
  )
}

function ShuttleSection({ shuttleExpenses }) {
  if (!shuttleExpenses || shuttleExpenses.length === 0) {
    return (
      <Panel title="🏸 Chi phí cầu">
        <p className="muted">Chưa có giao dịch mua cầu trong kỳ này.</p>
      </Panel>
    )
  }

  const totalAmt   = shuttleExpenses.reduce((s, e) => s + Number(e.total_amount), 0)
  const totalCount = shuttleExpenses.reduce((s, e) => s + Number(e.total_shuttle_count || 0), 0)
  const byBuyer = {}
  shuttleExpenses.forEach((e) => {
    const name = e.buyer?.full_name || '?'
    if (!byBuyer[name]) byBuyer[name] = { count: 0, amt: 0 }
    byBuyer[name].count++
    byBuyer[name].amt += Number(e.total_amount)
  })

  return (
    <Panel title="🏸 Chi phí cầu">
      <div className="an-stat-row">
        <StatCard label="Tổng chi" value={formatMoney(totalAmt)} accent="#e57373" />
        <StatCard label="Số lần mua" value={`${shuttleExpenses.length} lần`} />
        <StatCard label="Tổng quả" value={`${totalCount} quả`} />
      </div>
      <div className="an-unpaid-list">
        <p className="an-section-title">Người mua cầu</p>
        {Object.entries(byBuyer).sort((a, b) => b[1].amt - a[1].amt).map(([name, d]) => (
          <div key={name} className="an-unpaid-row">
            <span className="an-unpaid-name">{name}</span>
            <span className="an-unpaid-amt">{formatMoney(d.amt)}</span>
            <div className="an-mini-bar-wrap">
              <div className="an-mini-bar an-mini-bar-shuttle" style={{ width: `${Math.min(100, (d.amt / totalAmt) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function MemberSection({ debts, members }) {
  // Build per-person summary
  const personMap = {}
  members.forEach((m) => {
    const id = m.person_id || m.person?.id
    const name = m.person?.full_name || m.person?.nickname || '?'
    personMap[id] = { name, paid: 0, unpaid: 0 }
  })
  debts.filter((d) => d.status !== 'cancelled').forEach((d) => {
    if (!personMap[d.person_id]) {
      personMap[d.person_id] = { name: d.person?.full_name || '?', paid: 0, unpaid: 0 }
    }
    if (d.status === 'paid') personMap[d.person_id].paid += Number(d.amount)
    else personMap[d.person_id].unpaid += Number(d.amount)
  })

  const rows = Object.values(personMap).sort((a, b) => b.unpaid - a.unpaid)
  const fullyPaid = rows.filter((r) => r.unpaid === 0 && r.paid > 0).length
  const hasDebt   = rows.filter((r) => r.unpaid > 0).length
  const noData    = rows.filter((r) => r.paid === 0 && r.unpaid === 0).length

  return (
    <Panel title="👥 Thành viên trong kỳ">
      <div className="an-stat-row">
        <StatCard label="Đã đóng đủ" value={`${fullyPaid} người`} accent="#4caf7d" />
        <StatCard label="Còn nợ"     value={`${hasDebt} người`}   accent="#e57373" />
        <StatCard label="Chưa có nợ" value={`${noData} người`}    />
      </div>
      <div className="an-member-grid">
        {rows.map((r, i) => {
          const status = r.unpaid > 0 ? 'debt' : r.paid > 0 ? 'paid' : 'none'
          return (
            <div key={i} className={`an-member-chip an-chip-${status}`}>
              <span className="an-chip-name">{r.name}</span>
              {status === 'paid' && <span className="an-chip-tag">✓</span>}
              {status === 'debt' && <span className="an-chip-tag an-chip-debt-tag">{formatMoney(r.unpaid)}</span>}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/* ─────────────────────────────────────────
   MAIN EXPORT
───────────────────────────────────────── */

export function AnalyticsPanel({ debts, fund, shuttleExpenses, members, activePeriod }) {
  function handleExport() {
    printPeriodReport({ period: activePeriod, debts, fund, shuttleExpenses, members })
  }

  return (
    <div className="an-root">
      <div className="an-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 className="an-title">📊 Báo cáo kỳ {activePeriod?.name || ''}</h2>
          <p className="an-subtitle muted">Tổng hợp tình hình tài chính và hoạt động</p>
        </div>
        <button className="an-export-btn" onClick={handleExport}>🖨️ Xuất PDF</button>
      </div>
      <section className="grid two">
        <DebtSection debts={debts} />
        <FundSection fund={fund} />
      </section>
      <section className="grid two">
        <MemberSection debts={debts} members={members} />
        <ShuttleSection shuttleExpenses={shuttleExpenses} />
      </section>
    </div>
  )
}
