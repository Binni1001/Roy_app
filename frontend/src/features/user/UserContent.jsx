import { Panel, SimpleTable } from '../../components/common'
import { CheckoutBox, DebtTable } from '../../components/finance'
import { SessionCalendar } from '../../components/SessionCalendar'
import { formatDate, formatMoney } from '../../utils/appUtils'

export function UserContent({ activeTab, debts, unpaidDebts, transactions, sessions, checkout }) {
  if (activeTab === 'schedule') {
    return (
      <div className="tab-scene" style={{ '--tab-img': 'url(/images/court.jpg)' }}>
        <section className="grid one">
          <Panel title="📅 Lịch buổi đánh">
            <SessionCalendar sessions={sessions} />
          </Panel>
        </section>
      </div>
    )
  }

  if (activeTab === 'debts') {
    return (
      <div className="tab-scene" style={{ '--tab-img': 'url(/images/player-fist.jpg)' }}>
        <section className="grid two">
          <Panel title="⚠️ Cần thanh toán"><DebtTable debts={unpaidDebts} /></Panel>
          <Panel title="📋 Tất cả công nợ"><DebtTable debts={debts} /></Panel>
        </section>
      </div>
    )
  }

  if (activeTab === 'history') {
    return (
      <div className="tab-scene" style={{ '--tab-img': 'url(/images/rackets-grass.jpg)' }}>
        <section className="grid two">
          <Panel title="💰 Lịch sử số dư">
            <SimpleTable rows={transactions} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
          </Panel>
          <Panel title="🏸 Buổi cầu trong kỳ">
            <SimpleTable rows={sessions} columns={[['play_date', 'Ngày', formatDate], ['shuttle_used_count', 'Số cầu'], ['note', 'Ghi chú']]} />
          </Panel>
        </section>
      </div>
    )
  }

  if (activeTab === 'payment') {
    return (
      <div className="tab-scene" style={{ '--tab-img': 'url(/images/shuttle-green.jpg)' }}>
        <section className="grid one">
          <Panel title="💳 Lệnh thanh toán PayOS"><CheckoutBox checkout={checkout} /></Panel>
        </section>
      </div>
    )
  }

  // Home tab — quick overview
  const unpaidCount = unpaidDebts.length
  const totalUnpaid = unpaidDebts.reduce((s, d) => s + (d.amount || 0), 0)
  const lastSession = sessions[0]
  const lastTx = transactions[0]

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/player-walk.jpg)' }}>
      {/* Quick summary chips */}
      {(unpaidCount > 0 || lastSession) && (
        <div className="home-summary-row">
          {unpaidCount > 0 && (
            <div className="home-summary-chip home-chip-debt">
              <span className="home-chip-icon">⚠️</span>
              <div>
                <span className="home-chip-label">Chưa thanh toán</span>
                <strong className="home-chip-value">{formatMoney(totalUnpaid)}</strong>
              </div>
            </div>
          )}
          {lastSession && (
            <div className="home-summary-chip home-chip-session">
              <span className="home-chip-icon">🏸</span>
              <div>
                <span className="home-chip-label">Buổi gần nhất</span>
                <strong className="home-chip-value">{formatDate(lastSession.play_date)}</strong>
              </div>
            </div>
          )}
          {lastTx && (
            <div className="home-summary-chip home-chip-tx">
              <span className="home-chip-icon">💰</span>
              <div>
                <span className="home-chip-label">Giao dịch gần nhất</span>
                <strong className="home-chip-value">{formatMoney(lastTx.amount)}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      <section className="grid one">
        <Panel title="⚠️ Công nợ gần nhất"><DebtTable debts={debts.slice(0, 5)} /></Panel>
        <Panel title="💰 Giao dịch gần đây">
          <SimpleTable rows={transactions.slice(0, 5)} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
        </Panel>
        <Panel title="📅 Lịch chơi">
          <SessionCalendar sessions={sessions} />
        </Panel>
      </section>
    </div>
  )
}
