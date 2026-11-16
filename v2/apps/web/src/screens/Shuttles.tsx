import { useState, type FormEvent } from "react";
import type { BuyType, ShuttleOverview } from "@roy/shared";
import {
  useAddExpense,
  useAddLoan,
  useApplyFund,
  useClosePeriod,
  useDeleteExpense,
  useLoanAction,
  useSettle,
  useShuttles,
} from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { formatDate, formatMoney } from "../lib/format";
import { QueryState } from "./QueryState";
import { confirmDialog } from "../lib/dialog";

const todayVn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const digits = (value: string, max = 9) => value.replace(/\D/g, "").slice(0, max);
const signed = (n: number) => (n > 0 ? `+${formatMoney(n)}` : n < 0 ? `−${formatMoney(-n)}` : formatMoney(0));

function Expenses({ data }: { data: ShuttleOverview }) {
  const add = useAddExpense();
  const remove = useDeleteExpense();
  const empty = { buyerId: "", buyType: "tube" as BuyType, tubeCount: "", shuttlePerTube: "12", singleCount: "", totalPrice: "", fundAmount: "", buyDate: todayVn(), note: "" };
  const [form, setForm] = useState(empty);
  const locked = data.settlement.settled;
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate(
      {
        buyerId: form.buyerId,
        buyType: form.buyType,
        tubeCount: Number(form.tubeCount || 0),
        shuttlePerTube: Number(form.shuttlePerTube || 12),
        singleCount: Number(form.singleCount || 0),
        totalPrice: Number(form.totalPrice || 0),
        fundAmount: Number(form.fundAmount || 0),
        buyDate: form.buyDate,
        note: form.note.trim() || null,
      },
      { onSuccess: () => setForm(empty) },
    );
  }

  const personal = Math.max(0, Number(form.totalPrice || 0) - Number(form.fundAmount || 0));

  return (
    <section className="card rise">
      <h2>Mua cầu · {data.expenses.length} lần</h2>
      {!locked && (
        <form className="form person-form" onSubmit={submit} noValidate>
          <div className="two">
            <div>
              <label htmlFor="buyer">Người mua</label>
              <select id="buyer" value={form.buyerId} onChange={(e) => set("buyerId")(e.target.value)}>
                <option value="">Chọn thành viên cố định</option>
                {data.buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="buy-type">Cách mua</label>
              <select id="buy-type" value={form.buyType} onChange={(e) => set("buyType")(e.target.value)}>
                <option value="tube">Theo ống</option>
                <option value="single">Quả lẻ</option>
                <option value="mixed">Cả ống và lẻ</option>
              </select>
            </div>
          </div>
          <div className="three">
            {form.buyType !== "single" && (
              <>
                <div>
                  <label htmlFor="tubes">Số ống</label>
                  <input id="tubes" inputMode="numeric" value={form.tubeCount} onChange={(e) => set("tubeCount")(digits(e.target.value, 3))} />
                </div>
                <div>
                  <label htmlFor="per-tube">Quả mỗi ống</label>
                  <input id="per-tube" inputMode="numeric" value={form.shuttlePerTube} onChange={(e) => set("shuttlePerTube")(digits(e.target.value, 3))} />
                </div>
              </>
            )}
            {form.buyType !== "tube" && (
              <div>
                <label htmlFor="singles">Số quả lẻ</label>
                <input id="singles" inputMode="numeric" value={form.singleCount} onChange={(e) => set("singleCount")(digits(e.target.value, 4))} />
              </div>
            )}
          </div>
          <div className="three">
            <div>
              <label htmlFor="total-price">Tổng giá (đ)</label>
              <input id="total-price" inputMode="numeric" value={form.totalPrice} onChange={(e) => set("totalPrice")(digits(e.target.value))} />
            </div>
            <div>
              <label htmlFor="fund-part">Quỹ chi (đ)</label>
              <input id="fund-part" inputMode="numeric" value={form.fundAmount} onChange={(e) => set("fundAmount")(digits(e.target.value))} placeholder="0" />
            </div>
            <div>
              <label htmlFor="buy-date">Ngày mua</label>
              <input id="buy-date" type="date" max={todayVn()} value={form.buyDate} onChange={(e) => set("buyDate")(e.target.value)} />
            </div>
          </div>
          <p className="muted small">Người mua tự bỏ {formatMoney(personal)}, được chia lại khi chốt. Phần quỹ chi ghi vào sổ quỹ.</p>
          <label htmlFor="buy-note">Ghi chú</label>
          <input id="buy-note" value={form.note} maxLength={500} onChange={(e) => set("note")(e.target.value)} />
          {add.isError && <p className="error">{add.error.message}</p>}
          <div className="actions">
            <button className="btn btn-gold btn-small" type="submit" disabled={add.isPending || !form.buyerId}>
              {add.isPending ? "Đang ghi…" : "Ghi lần mua"}
            </button>
          </div>
        </form>
      )}
      {remove.isError && <p className="error">{remove.error.message}</p>}
      {data.expenses.length > 0 && (
        <ul className="rows">
          {data.expenses.map((e) => (
            <li className="row" key={e.id}>
              <div className="grow">
                <div className="row-title">
                  {e.buyerName} · {e.shuttleCount} quả
                </div>
                <div className="row-sub">
                  {formatDate(e.buyDate)}
                  {e.tubeCount ? ` · ${e.tubeCount} ống × ${e.shuttlePerTube}` : ""}
                  {e.singleCount ? ` · ${e.singleCount} lẻ` : ""}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </div>
              <div className="row-amount">{formatMoney(e.amount)}</div>
              {!locked && (
                <button
                  className="btn btn-dark btn-small"
                  disabled={remove.isPending}
                  onClick={async () => (await confirmDialog(`Xóa lần mua của ${e.buyerName}?`)) && remove.mutate(e.id)}
                >
                  Xóa
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Loans({ data }: { data: ShuttleOverview }) {
  const add = useAddLoan();
  const act = useLoanAction();
  const empty = { personId: "", quantity: "", unitPrice: "", borrowedAt: todayVn(), note: "" };
  const [form, setForm] = useState(empty);
  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));
  const locked = data.settlement.settled;

  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate(
      { personId: form.personId, quantity: Number(form.quantity || 0), unitPrice: Number(form.unitPrice || 0), borrowedAt: form.borrowedAt, note: form.note.trim() || null },
      { onSuccess: () => setForm(empty) },
    );
  }

  return (
    <section className="card rise d1">
      <h2>Mượn cầu đánh sân ngoài</h2>
      <p className="muted small">Người mượn trả tiền vào quỹ. Phải trả hết trước khi chốt chia tiền cầu.</p>
      {!locked && (
        <form className="form person-form" onSubmit={submit} noValidate>
          <div className="two">
            <div>
              <label htmlFor="loan-person">Người mượn</label>
              <select id="loan-person" value={form.personId} onChange={(e) => set("personId")(e.target.value)}>
                <option value="">Chọn người</option>
                {data.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="loan-date">Ngày mượn</label>
              <input id="loan-date" type="date" max={todayVn()} value={form.borrowedAt} onChange={(e) => set("borrowedAt")(e.target.value)} />
            </div>
          </div>
          <div className="two">
            <div>
              <label htmlFor="loan-qty">Số quả</label>
              <input id="loan-qty" inputMode="numeric" value={form.quantity} onChange={(e) => set("quantity")(digits(e.target.value, 4))} />
            </div>
            <div>
              <label htmlFor="loan-price">Giá mỗi quả (đ)</label>
              <input id="loan-price" inputMode="numeric" value={form.unitPrice} onChange={(e) => set("unitPrice")(digits(e.target.value, 7))} />
            </div>
          </div>
          {add.isError && <p className="error">{add.error.message}</p>}
          <div className="actions">
            <button className="btn btn-gold btn-small" type="submit" disabled={add.isPending || !form.personId}>
              {add.isPending ? "Đang ghi…" : `Ghi mượn ${formatMoney(Number(form.quantity || 0) * Number(form.unitPrice || 0))}`}
            </button>
          </div>
        </form>
      )}
      {act.isError && <p className="error">{act.error.message}</p>}
      {data.loans.length > 0 && (
        <ul className="rows">
          {data.loans.map((l) => (
            <li className="row" key={l.id}>
              <div className="grow">
                <div className="row-title">
                  {l.personName} · {l.quantity} quả
                </div>
                <div className="row-sub">
                  {formatDate(l.borrowedAt)} · {l.status === "unpaid" ? "Chưa trả" : l.status === "paid" ? "Đã trả vào quỹ" : "Đã hủy"}
                </div>
              </div>
              <div className="row-amount">{formatMoney(l.amount)}</div>
              {l.status === "unpaid" && !locked && (
                <div className="actions">
                  <button className="btn btn-gold btn-small" disabled={act.isPending} onClick={async () => (await confirmDialog(`${l.personName} đã trả ${formatMoney(l.amount)} vào quỹ?`)) && act.mutate({ id: l.id, action: "repay" })}>
                    Đã trả
                  </button>
                  <button className="btn btn-dark btn-small" disabled={act.isPending} onClick={async () => (await confirmDialog("Hủy khoản mượn này?")) && act.mutate({ id: l.id, action: "cancel" })}>
                    Hủy
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Settlement({ data }: { data: ShuttleOverview }) {
  const s = data.settlement;
  const settle = useSettle();
  const close = useClosePeriod();
  const fund = useApplyFund();
  const [fundForm, setFundForm] = useState({ buyerId: "", amount: "" });
  const buyersWhoPaid = s.lines.filter((l) => l.paid > 0);

  return (
    <section className="card rise d2">
      <h2>Chia tiền cầu {data.period?.name}</h2>
      {s.problem && <p className="notice">{s.problem}</p>}
      <p className="row-sub">
        {s.totalShuttles} quả · tổng tiền cá nhân bỏ ra {formatMoney(s.totalAmount)} · {s.memberCount} thành viên cố định · quỹ còn {formatMoney(s.fundBalance)}
      </p>

      {s.lines.length > 0 && (
        <div className="table-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th>Người</th>
                <th>Miễn</th>
                <th>Đã mua</th>
                <th>Phải chịu</th>
                <th>Chênh lệch</th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.personId}>
                  <td className="row-title">{l.name}</td>
                  <td>{l.discountPercent ? `${l.discountPercent}%` : "—"}</td>
                  <td>{formatMoney(l.paid)}</td>
                  <td>{formatMoney(l.share)}</td>
                  <td className={l.net > 0 ? "fee-paid" : l.net < 0 ? "fee-unpaid" : ""}>{signed(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {s.settled ? (
        <p className="ok">Đã chốt chia tiền cầu. Người dương được cộng số dư, người âm nhận khoản nợ tiền cầu.</p>
      ) : (
        <>
          {s.blocking.length > 0 && (
            <div className="notice">
              <p>Còn {s.blocking.length} khoản phải thu trước khi chốt:</p>
              <ul className="plain">
                {s.blocking.map((b, i) => (
                  <li key={i}>
                    {b.personName} · {b.kind === "shuttle_loan" ? "tiền mượn cầu" : "công nợ"} {b.periodName} · {formatMoney(b.amount)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.fundBalance > 0 && s.blocking.length === 0 && buyersWhoPaid.length > 0 && (
            <form
              className="inline-row"
              onSubmit={(e) => {
                e.preventDefault();
                fund.mutate({ buyerId: fundForm.buyerId, amount: Number(fundForm.amount || 0) }, { onSuccess: () => setFundForm({ buyerId: "", amount: "" }) });
              }}
            >
              <select aria-label="Người nhận tiền quỹ" value={fundForm.buyerId} onChange={(e) => setFundForm({ ...fundForm, buyerId: e.target.value })}>
                <option value="">Dùng quỹ dư trả cho…</option>
                {buyersWhoPaid.map((l) => (
                  <option key={l.personId} value={l.personId}>
                    {l.name} (đã bỏ {formatMoney(l.paid)})
                  </option>
                ))}
              </select>
              <input className="amount" aria-label="Số tiền quỹ" inputMode="numeric" value={fundForm.amount} placeholder={String(s.fundBalance)} onChange={(e) => setFundForm({ ...fundForm, amount: digits(e.target.value) })} />
              <button className="btn btn-ghost btn-small" type="submit" disabled={fund.isPending || !fundForm.buyerId || !fundForm.amount}>
                Dùng quỹ
              </button>
              {fund.isError && <p className="error">{fund.error.message}</p>}
            </form>
          )}
          {s.fundBalance !== 0 && <p className="muted small">Quỹ phải về 0 trước khi chốt: dùng quỹ dư trả cho người đã mua cầu, hoặc ghi ở sổ quỹ.</p>}
          {settle.isError && <p className="error">{settle.error.message}</p>}
          <button
            className="btn btn-gold"
            disabled={!s.canSettle || settle.isPending}
            onClick={async () =>
              (await confirmDialog("Chốt chia tiền cầu? Sau khi chốt không thể sửa chi cầu, thành viên hay mức miễn của kỳ. Mỗi người sẽ nhận thông báo.")) &&
              settle.mutate(undefined)
            }
          >
            {settle.isPending ? "Đang chốt…" : "Chốt chia tiền cầu"}
          </button>
        </>
      )}

      <h3>Đóng kỳ</h3>
      {!data.closeSupported ? (
        <p className="muted small">Kỳ này dùng luật xếp hạng cũ; đóng kỳ ở bản cũ.</p>
      ) : (
        <>
          <p className="muted small">Đóng được khi đã chốt chia tiền cầu, trả hết tiền mượn cầu và quỹ về 0. Bảng xếp hạng của kỳ được lưu lại khi đóng.</p>
          {close.isError && <p className="error">{close.error.message}</p>}
          <button
            className="btn btn-dark"
            disabled={!data.canClose || close.isPending}
            onClick={async () => (await confirmDialog(`Đóng ${data.period?.name}? Kỳ đã đóng không mở lại được.`)) && close.mutate(undefined)}
          >
            {close.isPending ? "Đang đóng…" : `Đóng ${data.period?.name ?? "kỳ"}`}
          </button>
        </>
      )}
    </section>
  );
}

function ShuttlesView({ data }: { data: ShuttleOverview }) {
  if (!data.period) {
    return (
      <>
        {data.notice && <p className="ok">{data.notice}</p>}
        <section className="card rise">
          <h2>Chưa có kỳ đang mở</h2>
          <p className="muted">Tạo và mở kỳ mới ở màn hình Kỳ quỹ.</p>
        </section>
      </>
    );
  }
  return (
    <div className="stack">
      {data.notice && (
        <p className="ok" role="status">
          {data.notice}
        </p>
      )}
      <Settlement data={data} />
      <Expenses data={data} />
      <Loans data={data} />
    </div>
  );
}

export function Shuttles() {
  const { role } = useBootstrapData();
  const owner = role === "owner";
  const query = useShuttles(owner);
  if (!owner) {
    return (
      <section className="card rise">
        <h1>Tiền cầu</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được tiền cầu.</p>
      </section>
    );
  }
  return (
    <>
      <h1 className="page-title">Tiền cầu & chốt kỳ</h1>
      <QueryState query={query}>{(data) => <ShuttlesView data={data} />}</QueryState>
    </>
  );
}
