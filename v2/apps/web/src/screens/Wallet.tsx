import type { Debt, Wallet as WalletData } from "@roy/shared";
import { useWallet } from "../hooks/useMemberData";
import { debtLabel, formatDate, formatMoney, transactionLabel } from "../lib/format";
import { QueryState } from "./QueryState";

function DebtRow({ debt }: { debt: Debt }) {
  return (
    <li className="row">
      <div>
        <div className="row-title">{debtLabel(debt.type)}</div>
        <div className="row-sub">
          {debt.periodName}
          {debt.description ? ` · ${debt.description}` : ""}
        </div>
      </div>
      <div className="row-end">
        <div className="row-amount">{formatMoney(debt.amount)}</div>
        <div className="row-sub">
          {debt.paidAt ? `Đã trả ${formatDate(debt.paidAt)}` : formatDate(debt.createdAt)}
        </div>
      </div>
    </li>
  );
}

function WalletView({ wallet }: { wallet: WalletData }) {
  const { unpaidDebts, settledDebts, transactions, openLoans } = wallet;
  return (
    <div className="stack">
      <section className="due rise">
        <div>
          <p className="due-label">
            {unpaidDebts.length ? `Cần đóng · ${unpaidDebts.length} khoản` : "Bạn không còn khoản nào cần đóng"}
          </p>
          <p className="due-amount">{formatMoney(wallet.unpaidTotal)}</p>
        </div>
        <p className="due-balance">Số dư {formatMoney(wallet.balance)}</p>
      </section>

      {unpaidDebts.length > 0 && (
        <section className="card rise d1">
          <h2>Khoản chưa trả</h2>
          <ul className="rows">
            {unpaidDebts.map((debt) => (
              <DebtRow key={debt.id} debt={debt} />
            ))}
          </ul>
          <p className="muted small">Trả gộp bằng mã QR sẽ có ở bản cập nhật tới.</p>
        </section>
      )}

      {openLoans.length > 0 && (
        <section className="card rise d1">
          <h2>Tiền mượn cầu chưa nộp quỹ</h2>
          <ul className="rows">
            {openLoans.map((loan) => (
              <li className="row" key={loan.id}>
                <div>
                  <div className="row-title">{loan.quantity} quả</div>
                  <div className="row-sub">
                    {loan.periodName} · mượn {formatDate(loan.borrowedAt)}
                  </div>
                </div>
                <div className="row-amount">{formatMoney(loan.amount)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card rise d2">
        <h2>Đã trả</h2>
        {settledDebts.length ? (
          <ul className="rows">
            {settledDebts.map((debt) => (
              <DebtRow key={debt.id} debt={debt} />
            ))}
          </ul>
        ) : (
          <p className="muted">Các khoản bạn đã trả sẽ hiện ở đây.</p>
        )}
      </section>

      {transactions.length > 0 && (
        <section className="card rise d3">
          <h2>Biến động số dư</h2>
          <ul className="rows">
            {transactions.map((item) => (
              <li className="row" key={item.id}>
                <div>
                  <div className="row-title">{transactionLabel(item.type)}</div>
                  <div className="row-sub">
                    {formatDate(item.createdAt)}
                    {item.description ? ` · ${item.description}` : ""}
                  </div>
                </div>
                <div className={`row-amount ${item.direction}`}>
                  {item.direction === "plus" ? "+" : "−"}
                  {formatMoney(item.amount)}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function Wallet() {
  const query = useWallet();
  return (
    <>
      <h1 className="page-title">Ví</h1>
      <QueryState query={query}>{(wallet) => <WalletView wallet={wallet} />}</QueryState>
    </>
  );
}
