import { useState, type FormEvent } from "react";
import type { AdminOpenDay, AdminSchedule as ScheduleData, AdminSession, GuestRow, SchedulePerson } from "@roy/shared";
import {
  useAddGuest,
  useAddSession,
  useAdminSchedule,
  useDayAction,
  useDeleteSession,
  useEditGuest,
  useEditSession,
  useRemoveGuest,
} from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { formatDate, formatMoney, formatWeekday } from "../lib/format";
import { QueryState } from "./QueryState";

const todayVn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
const digits = (value: string, max = 9) => value.replace(/\D/g, "").slice(0, max);

function OpenDays({ data }: { data: ScheduleData }) {
  const action = useDayAction();
  const [date, setDate] = useState("");
  const period = data.period!;
  const today = todayVn();
  const upcoming = data.openDays.filter((day) => day.date >= today);

  function openDay(event: FormEvent) {
    event.preventDefault();
    if (date) action.mutate({ date, action: "open" }, { onSuccess: () => setDate("") });
  }

  return (
    <section className="card rise">
      <h2>Ngày tự đăng ký</h2>
      <p className="muted small">Mở một ngày để thành viên giữ chỗ (tối đa 8 người, hạn 17:30 ngày đó). Đóng đăng ký vẫn giữ những người đã giữ chỗ.</p>
      <form className="inline-row" onSubmit={openDay}>
        <input type="date" aria-label="Ngày mở đăng ký" min={today > period.startDate ? today : period.startDate} max={period.endDate} value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn btn-gold btn-small" type="submit" disabled={!date || action.isPending}>
          Mở ngày
        </button>
      </form>
      {action.isError && (
        <p className="error" role="alert">
          {action.error.message}
        </p>
      )}
      {upcoming.length ? (
        <ul className="people">
          {upcoming.map((day: AdminOpenDay) => (
            <li className="person" key={day.date}>
              <div className="person-head">
                <div className="grow">
                  <div className="row-title">
                    {formatWeekday(day.date)}, {formatDate(day.date)} · {day.names.length}/{day.capacity}
                    {day.status === "closed" ? " · đã đóng đăng ký" : ""}
                  </div>
                  <div className="row-sub">{day.names.length ? day.names.join(", ") : "Chưa ai giữ chỗ"}</div>
                </div>
                <button
                  className="btn btn-ghost btn-small"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ date: day.date, action: day.status === "closed" ? "reopen" : "close" })}
                >
                  {day.status === "closed" ? "Mở lại" : "Đóng đăng ký"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Chưa mở ngày nào sắp tới.</p>
      )}
    </section>
  );
}

function SessionForm({
  initial,
  label,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: { date: string; shuttles: string; note: string };
  label: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: { date: string; shuttles: number; note: string | null }) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState(initial);
  const id = label.replace(/\s+/g, "-");
  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit({ date: form.date, shuttles: Number(form.shuttles || 0), note: form.note.trim() || null });
  }
  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <div className="two">
        <div>
          <label htmlFor={`${id}-date`}>Ngày chơi</label>
          <input id={`${id}-date`} type="date" max={todayVn()} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label htmlFor={`${id}-shuttles`}>Số quả cầu đã dùng</label>
          <input id={`${id}-shuttles`} inputMode="numeric" value={form.shuttles} onChange={(e) => setForm({ ...form, shuttles: digits(e.target.value, 3) })} />
        </div>
      </div>
      <label htmlFor={`${id}-note`}>Ghi chú</label>
      <input id={`${id}-note`} value={form.note} maxLength={500} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={busy || !form.date}>
          {busy ? "Đang lưu…" : label}
        </button>
        {onCancel && (
          <button className="btn btn-ghost btn-small" type="button" onClick={onCancel} disabled={busy}>
            Đóng
          </button>
        )}
      </div>
    </form>
  );
}

const FEE: Record<GuestRow["feeStatus"], string> = { none: "Miễn phí", unpaid: "Chưa trả", paid: "Đã trả" };

function Guest({ guest, locked }: { guest: GuestRow; locked: boolean }) {
  const edit = useEditGuest();
  const remove = useRemoveGuest();
  const [amount, setAmount] = useState(String(guest.amount));
  const paid = guest.feeStatus === "paid";
  const error = edit.error ?? remove.error;
  return (
    <li className="guest">
      <div className="person-head">
        <div className="grow">
          <div className="row-title">{guest.name}</div>
          <div className="row-sub">
            {formatMoney(guest.amount)} · <span className={`fee fee-${guest.feeStatus}`}>{FEE[guest.feeStatus]}</span>
            {guest.note ? ` · ${guest.note}` : ""}
          </div>
        </div>
        {!locked && !paid && (
          <>
            <input className="amount" aria-label={`Phí khách của ${guest.name}`} inputMode="numeric" value={amount} onChange={(e) => setAmount(digits(e.target.value))} />
            {Number(amount || 0) !== guest.amount && (
              <button className="btn btn-gold btn-small" disabled={edit.isPending} onClick={() => edit.mutate({ id: guest.id, amount: Number(amount || 0), note: guest.note })}>
                Lưu
              </button>
            )}
            <button
              className="btn btn-dark btn-small"
              disabled={remove.isPending}
              onClick={() => window.confirm(`Xóa ${guest.name} khỏi buổi? Phí khách chưa trả sẽ bị hủy.`) && remove.mutate(guest.id)}
            >
              Xóa
            </button>
          </>
        )}
      </div>
      {error && <p className="error">{error.message}</p>}
    </li>
  );
}

function AddGuest({ session, people, guestFee, registered }: { session: AdminSession; people: SchedulePerson[]; guestFee: number; registered: string[] }) {
  const add = useAddGuest();
  const [personId, setPersonId] = useState("");
  const [amount, setAmount] = useState(String(guestFee));
  const taken = new Set(session.guests.map((g) => g.personId));
  const available = people.filter((p) => !taken.has(p.id));
  // Người đã giữ chỗ ngày đó lên đầu, rồi người vãng lai, cuối cùng là thành viên cố định.
  const rank = (p: SchedulePerson) => (registered.includes(p.id) ? 0 : p.fixed ? 2 : 1);
  const sorted = [...available].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "vi"));

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!personId) return;
    add.mutate({ sessionId: session.id, personId, amount: Number(amount || 0), note: null }, { onSuccess: () => setPersonId("") });
  }

  if (!sorted.length) return null;
  return (
    <form className="inline-row" onSubmit={submit}>
      <select aria-label="Thêm khách vãng lai" value={personId} onChange={(e) => setPersonId(e.target.value)}>
        <option value="">Thêm khách…</option>
        {sorted.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
            {registered.includes(p.id) ? " (đã giữ chỗ)" : p.fixed ? " (cố định)" : ""}
          </option>
        ))}
      </select>
      <input className="amount" aria-label="Phí khách" inputMode="numeric" value={amount} onChange={(e) => setAmount(digits(e.target.value))} />
      <button className="btn btn-gold btn-small" type="submit" disabled={!personId || add.isPending}>
        {add.isPending ? "Đang ghi…" : "Ghi khách"}
      </button>
      {add.isError && <p className="error">{add.error.message}</p>}
    </form>
  );
}

function Session({ session, data }: { session: AdminSession; data: ScheduleData }) {
  const [editing, setEditing] = useState(false);
  const edit = useEditSession();
  const remove = useDeleteSession();
  const locked = data.settled;
  const registered = data.openDays.find((day) => day.date === session.date)?.personIds ?? [];
  const fees = session.guests.reduce((sum, g) => sum + g.amount, 0);

  return (
    <section className="card rise session-card">
      <div className="card-head">
        <div>
          <h3 className="session-title">
            {formatWeekday(session.date)}, {formatDate(session.date)}
          </h3>
          <p className="row-sub">
            {session.shuttles} quả cầu · {session.guests.length} khách{fees ? ` · ${formatMoney(fees)} phí khách` : ""}
            {session.note ? ` · ${session.note}` : ""}
          </p>
        </div>
        {!editing && (
          <div className="actions">
            <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
              Sửa
            </button>
            {!session.guests.length && (
              <button
                className="btn btn-dark btn-small"
                disabled={remove.isPending}
                onClick={() => window.confirm("Xóa buổi này?") && remove.mutate(session.id)}
              >
                Xóa buổi
              </button>
            )}
          </div>
        )}
      </div>
      {remove.isError && <p className="error">{remove.error.message}</p>}
      {editing && (
        <SessionForm
          initial={{ date: session.date, shuttles: String(session.shuttles), note: session.note ?? "" }}
          label="Lưu buổi"
          busy={edit.isPending}
          error={edit.error?.message ?? null}
          onSubmit={(input) => edit.mutate({ id: session.id, input }, { onSuccess: () => setEditing(false) })}
          onCancel={() => {
            edit.reset();
            setEditing(false);
          }}
        />
      )}
      {session.guests.length > 0 && (
        <ul className="people">
          {session.guests.map((guest) => (
            <Guest key={guest.id} guest={guest} locked={locked} />
          ))}
        </ul>
      )}
      {!locked && <AddGuest session={session} people={data.people} guestFee={data.guestFee} registered={registered} />}
    </section>
  );
}

function ScheduleView({ data }: { data: ScheduleData }) {
  const add = useAddSession();
  const [formKey, setFormKey] = useState(0);
  if (!data.period) {
    return (
      <section className="card rise">
        <h2>Chưa có kỳ đang mở</h2>
        <p className="muted">Mở kỳ ở màn hình Kỳ quỹ trước.</p>
      </section>
    );
  }
  return (
    <div className="stack">
      {data.notice && (
        <p className="ok" role="status">
          {data.notice}
        </p>
      )}
      {data.settled && <p className="notice">Kỳ đã chốt chia tiền cầu: không thêm, đổi hay xóa phí khách được nữa.</p>}
      <OpenDays data={data} />
      <section className="card rise d1">
        <h2>Ghi buổi đã chơi</h2>
        <p className="muted small">
          Phí khách mặc định {formatMoney(data.guestFee)} mỗi buổi; sửa được từng người. Khách đã trả phí thì không đổi hay xóa được nữa.
        </p>
        <SessionForm
          key={formKey}
          initial={{ date: todayVn(), shuttles: "", note: "" }}
          label="Ghi buổi"
          busy={add.isPending}
          error={add.error?.message ?? null}
          onSubmit={(input) => add.mutate(input, { onSuccess: () => setFormKey((k) => k + 1) })}
        />
      </section>
      <h2 className="section-title">Buổi đã chơi · {data.sessions.length}</h2>
      {data.sessions.map((session) => (
        <Session key={session.id} session={session} data={data} />
      ))}
    </div>
  );
}

export function AdminSchedule() {
  const { role } = useBootstrapData();
  const owner = role === "owner";
  const query = useAdminSchedule(owner);
  if (!owner) {
    return (
      <section className="card rise">
        <h1>Lịch & điểm danh</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được lịch và điểm danh.</p>
      </section>
    );
  }
  return (
    <>
      <h1 className="page-title">Lịch & điểm danh</h1>
      <QueryState query={query}>{(data) => <ScheduleView data={data} />}</QueryState>
    </>
  );
}
