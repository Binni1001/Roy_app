import { Panel, SimpleTable } from '../../components/common'
import { CheckoutBox, DebtTable } from '../../components/finance'
import { formatDate, formatMoney } from '../../utils/appUtils'

export function UserContent({ activeTab, debts, unpaidDebts, transactions, sessions, checkout }) {
  if (activeTab === 'debts') {
    return (
      <div className="tab-scene" style={{ '--tab-img': 'url(/images/player-fist.jpg)' }}>
        <section className="grid two">
          <Panel title="Cần thanh toán"><DebtTable debts={unpaidDebts} /></Panel>
          <Panel title="Tất cả công nợ"><DebtTable debts={debts} /></Panel>
        </section>
      </div>
    )
  }

  if (activeTab === 'history') {
    return (
      <div className="tab-scene" style={{ '--tab-img': 'url(/images/rackets-grass.jpg)' }}>
        <section className="grid two">
          <Panel title="Lịch sử số dư">
            <SimpleTable rows={transactions} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
          </Panel>
          <Panel title="Buổi cầu trong kỳ">
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
          <Panel title="Lệnh thanh toán PayOS"><CheckoutBox checkout={checkout} /></Panel>
        </section>
      </div>
    )
  }

  return (
    <div className="tab-scene" style={{ '--tab-img': 'url(/images/player-walk.jpg)' }}>
      <section className="grid three">
        <Panel title="Công nợ gần nhất"><DebtTable debts={debts.slice(0, 5)} /></Panel>
        <Panel title="Lịch sử gần đây">
          <SimpleTable rows={transactions.slice(0, 5)} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
        </Panel>
        <Panel title="Lịch chơi">
          <SimpleTable rows={sessions.slice(0, 5)} columns={[['play_date', 'Ngày', formatDate], ['shuttle_used_count', 'Số cầu'], ['note', 'Ghi chú']]} />
        </Panel>
      </section>
    </div>
  )
}
