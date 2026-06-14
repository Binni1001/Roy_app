import { Panel, SimpleTable } from '../../components/common'
import { CheckoutBox, DebtTable } from '../../components/finance'
import { formatDate, formatMoney } from '../../utils/appUtils'

function TabBanner({ src, alt, children }) {
  return (
    <div className="tab-banner">
      <img src={src} alt={alt} className="tab-banner-img" />
      <div className="tab-banner-overlay">{children}</div>
    </div>
  )
}

export function UserContent({ activeTab, debts, unpaidDebts, transactions, sessions, checkout }) {
  if (activeTab === 'debts') {
    return (
      <>
        <TabBanner src="/images/player-fist.jpg" alt="Công nợ">
          <span className="eyebrow">Công nợ</span>
          <h2>Theo dõi khoản thanh toán</h2>
        </TabBanner>
        <section className="grid two">
          <Panel title="Cần thanh toán"><DebtTable debts={unpaidDebts} /></Panel>
          <Panel title="Tất cả công nợ"><DebtTable debts={debts} /></Panel>
        </section>
      </>
    )
  }

  if (activeTab === 'history') {
    return (
      <>
        <TabBanner src="/images/rackets-grass.jpg" alt="Lịch sử">
          <span className="eyebrow">Lịch sử</span>
          <h2>Nhìn lại hành trình của bạn</h2>
        </TabBanner>
        <section className="grid two">
          <Panel title="Lịch sử số dư">
            <SimpleTable rows={transactions} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
          </Panel>
          <Panel title="Buổi cầu trong kỳ">
            <SimpleTable rows={sessions} columns={[['play_date', 'Ngày', formatDate], ['shuttle_used_count', 'Số cầu'], ['note', 'Ghi chú']]} />
          </Panel>
        </section>
      </>
    )
  }

  if (activeTab === 'payment') {
    return (
      <>
        <TabBanner src="/images/shuttle-green.jpg" alt="Thanh toán">
          <span className="eyebrow">Thanh toán</span>
          <h2>Thanh toán nhanh qua PayOS</h2>
        </TabBanner>
        <section className="grid one">
          <Panel title="Lệnh thanh toán PayOS"><CheckoutBox checkout={checkout} /></Panel>
        </section>
      </>
    )
  }

  // Home tab
  return (
    <>
      <TabBanner src="/images/player-walk.jpg" alt="Trang cá nhân">
        <span className="eyebrow">Trang cá nhân</span>
        <h2>Tổng quan hoạt động của bạn</h2>
      </TabBanner>
      <section className="grid three">
        <Panel title="Công nợ gần nhất"><DebtTable debts={debts.slice(0, 5)} /></Panel>
        <Panel title="Lịch sử gần đây">
          <SimpleTable rows={transactions.slice(0, 5)} columns={[['created_at', 'Ngày', formatDate], ['amount', 'Số tiền', formatMoney], ['description', 'Nội dung']]} />
        </Panel>
        <Panel title="Lịch chơi">
          <SimpleTable rows={sessions.slice(0, 5)} columns={[['play_date', 'Ngày', formatDate], ['shuttle_used_count', 'Số cầu'], ['note', 'Ghi chú']]} />
        </Panel>
      </section>
    </>
  )
}
