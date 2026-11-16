import { useState, type FormEvent } from "react";
import type { FundType, MoneyOverview, PersonDebts } from "@roy/shared";
import { useAddDebt, useCancelDebt, useCollect, useFundEntry, useMoney, useRemind } from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { debtLabel, formatDate, formatMoney } from "../lib/format";
import { QueryState } from "./QueryState";
import { confirmDialog } from "../lib/dialog";

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 9);
const FUND_LABEL: Record<FundType, string> = { income: "Thu", expense: "Chi", refund: "Hoàn tiền", adjustment: "Điều chỉnh" };

function PersonCard({ person }: { person: PersonDebts }) {
  const collect = useCollect();
  const cancel = useCancelDebt();
  const remind = useRemind();
  const [picked, setPicked] = useState<string[]>(() => person.debts.map((d) => d.id));
  const [amount, setAmount] = useState("");
  const chosen = person.debts.filter((d) => picked.includes(d.id)).reduce((a, d) => a + d.amount, 0);
  const error = collect.error ?? cancel.error ?? remind.error;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const paid = Number(amount || chosen);
    if (!(await confirmDialog(`Ghi nhận ${person.name} đã nộp ${formatMoney(paid)} cho ${picked.length} khoản? Tiền được ghi vào quỹ kỳ đang mở.`))) return;
    collect.mutate({ personId: person.personId, debtIds: picked, amount: paid, note: null }, { onSuccess: () => setAmount("") });
  }

  return (
    <li className="person">
      <div className="person-head">
        <div className="grow">
          <div className="row-title">{person.name}</div>
          <div className="row-sub">
            {person.debts.length} khoản · {formatMoney(person.total)}
          </div>
        </div>
        <button className="btn btn-ghost btn-small" disabled={remind.isPending} onClick={() => remind.mutate(person.personId)}>
          {remind.isPending ? "Đang gửi…" : "Nhắc nợ"}
        </button>
      </div>
      <ul className="debt-list">
        {person.debts.map((d) => (
          <li key={d.id}>
            <label className="debt-pick">
              <input
                type="checkbox"
                checked={picked.includes(d.id)}
                onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, d.id] : cur.filter((x) => x !== d.id)))}
              />
              <span className="grow">
                {debtLabel(d.type)} · {d.periodName}
                {d.description ? <span className="muted small"> · {d.description}</span> : null}
              </span>
              <span className="row-amount">{formatMoney(d.amount)}</span>
            </label>
            <button
              className="icon-text"
              disabled={cancel.isPending}
              onClick={async () => (await confirmDialog(`Hủy khoản ${formatMoney(d.amount)} của ${person.name}? Không hoàn tác được.`)) && cancel.mutate(d.id)}
            >
              Hủy
            </button>
          </li>
        ))}
      </ul>
      <form className="inline-row" onSubmit={submit}>
        <input className="amount" aria-label={`Số tiền ${person.name} nộp`} inputMode="numeric" placeholder={String(chosen)} value={amount} onChange={(e) => setAmount(digits(e.target.value))} />
        <button className="btn btn-gold btn-small" type="submit" disabled={collect.isPending || (!picked.length && !amount)}>
          {collect.isPending ? "Đang ghi…" : `Thu ${formatMoney(Number(amount || chosen))}`}
        </button>
      </form>
      {error && <p className="error">{error.message}</p>}
    </li>
  );
}

function AddCharge({ data }: { data: MoneyOverview }) {
  const add = useAddDebt();
  const [form, setForm] = useState({ personId: "", amount: "", description: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    add.mutate({ personId: form.personId, amount: Number(form.amount || 0), description: form.description }, { onSuccess: () => setForm({ personId: "", amount: "", description: "" }) });
  }
  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <h3>Thêm khoản thu tay</h3>
      <div className="two">
        <div>
          <label htmlFor="charge-person">Người nợ</label>
          <select id="charge-person" value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })}>
            <option value="">Chọn người</option>
            {data.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="charge-amount">Số tiền (đ)</label>
          <input id="charge-amount" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: digits(e.target.value) })} />
        </div>
      </div>
      <label htmlFor="charge-desc">Nội dung</label>
      <input id="charge-desc" value={form.description} maxLength={500} placeholder="Ví dụ: Nước uống buổi 12/11" onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <p className="muted small">Nếu người đó đang có số dư dương, số dư sẽ tự trừ vào khoản này.</p>
      {add.isError && <p className="error">{add.error.message}</p>}
      <div className="actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={add.isPending || !form.personId || !form.amount || !form.description.trim()}>
          {add.isPending ? "Đang thêm…" : "Thêm khoản thu"}
        </button>
      </div>
    </form>
  );
}

function FundForm({ data }: { data: MoneyOverview }) {
  const entry = useFundEntry();
  const [form, setForm] = useState({ type: "income" as "income" | "expense" | "refund", personId: "", amount: "", description: "" });
  const positive = data.people.filter((p) => p.balance > 0);
  const choices = form.type === "refund" ? positive : data.people;

  async function submit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount || 0);
    const verb = form.type === "income" ? "Ghi thu" : form.type === "expense" ? "Ghi chi" : "Hoàn";
    if (!(await confirmDialog(`${verb} ${formatMoney(amount)}?`))) return;
    entry.mutate(
      { type: form.type, personId: form.personId || null, amount, description: form.description.trim() || null },
      { onSuccess: () => setForm({ ...form, personId: "", amount: "", description: "" }) },
    );
  }

  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <div className="seg" role="group" aria-label="Loại ghi quỹ">
        {(["income", "expense", "refund"] as const).map((type) => (
          <button key={type} type="button" className={form.type === type ? "on" : ""} onClick={() => setForm({ ...form, type, personId: "" })}>
            {type === "income" ? "Nộp quỹ" : type === "expense" ? "Chi quỹ" : "Hoàn số dư"}
          </button>
        ))}
      </div>
      <div className="two">
        <div>
          <label htmlFor="fund-person">{form.type === "expense" ? "Người nhận (không bắt buộc)" : "Người"}</label>
          <select id="fund-person" value={form.personId} onChange={(e) => setForm({ ...form, personId: e.target.value })}>
            <option value="">{form.type === "refund" && !positive.length ? "Không ai có số dư dương" : "Chọn người"}</option>
            {choices.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {form.type === "refund" ? ` (số dư ${formatMoney(p.balance)})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fund-amount">Số tiền (đ)</label>
          <input id="fund-amount" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: digits(e.target.value) })} />
        </div>
      </div>
      <label htmlFor="fund-desc">Nội dung{form.type === "expense" ? "" : " (không bắt buộc)"}</label>
      <input id="fund-desc" value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      {entry.isError && <p className="error">{entry.error.message}</p>}
      <div className="actions">
        <button
          className="btn btn-gold btn-small"
          type="submit"
          disabled={entry.isPending || !form.amount || (form.type !== "expense" && !form.personId) || (form.type === "expense" && !form.description.trim())}
        >
          {entry.isPending ? "Đang ghi…" : "Ghi vào sổ quỹ"}
        </button>
      </div>
    </form>
  );
}

function MoneyView({ data }: { data: MoneyOverview }) {
  if (!data.period) {
    return (
      <section className="card rise">
        <h2>Chưa có kỳ đang mở</h2>
        <p className="muted">Thu tiền và ghi quỹ cần một kỳ đang mở.</p>
      </section>
    );
  }
  const f = data.fund;
  return (
    <div className="stack">
      {data.notice && (
        <p className="ok" role="status">
          {data.notice}
        </p>
      )}
      <section className="card rise">
        <div className="card-head">
          <h2>Công nợ chưa thu</h2>
          <span className="big gold">{formatMoney(data.unpaidTotal)}</span>
        </div>
        <p className="muted small">Gồm cả khoản còn treo từ kỳ trước của nhóm. Thu tiền sẽ đánh dấu các khoản đã chọn là đã trả và ghi vào quỹ {data.period.name}.</p>
        {data.unpaid.length ? (
          <ul className="people">
            {data.unpaid.map((person) => (
              <PersonCard key={person.personId + ":" + person.debts.map((d) => d.id).join(",")} person={person} />
            ))}
          </ul>
        ) : (
          <p className="muted">Không còn ai nợ.</p>
        )}
        <AddCharge data={data} />
      </section>

      <section className="card rise d1">
        <div className="card-head">
          <h2>Sổ quỹ {data.period.name}</h2>
          <span className={`big ${f.balance === 0 ? "" : "gold"}`}>{formatMoney(f.balance)}</span>
        </div>
        <p className="row-sub">
          Thu {formatMoney(f.income)} · chi {formatMoney(f.expense)} · hoàn {formatMoney(f.refund)}
          {f.adjustment ? ` · điều chỉnh ${formatMoney(f.adjustment)}` : ""}
        </p>
        <FundForm data={data} />
        {f.entries.length > 0 && (
          <ul className="rows">
            {f.entries.map((e) => (
              <li className="row" key={e.id}>
                <div className="grow">
                  <div className="row-title">
                    {FUND_LABEL[e.type]}
                    {e.personName ? ` · ${e.personName}` : ""}
                  </div>
                  <div className="row-sub">
                    {formatDate(e.createdAt)}
                    {e.description ? ` · ${e.description}` : ""}
                  </div>
                </div>
                <div className={`row-amount ${e.type === "income" || e.type === "adjustment" ? "plus" : "minus"}`}>
                  {e.type === "income" || e.type === "adjustment" ? "+" : "−"}
                  {formatMoney(e.amount)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function Money() {
  const { role } = useBootstrapData();
  const owner = role === "owner";
  const query = useMoney(owner);
  if (!owner) {
    return (
      <section className="card rise">
        <h1>Công nợ & sổ quỹ</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được công nợ và quỹ.</p>
      </section>
    );
  }
  return (
    <>
      <h1 className="page-title">Công nợ & sổ quỹ</h1>
      <QueryState query={query}>{(data) => <MoneyView data={data} />}</QueryState>
    </>
  );
}
