import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import type { AdminPeriod, PeriodInput, PeriodMemberRow, PeriodMemberStatus, ShuttleDiscount } from "@roy/shared";
import {
  useAddPeriodMembers,
  useChangePeriodMember,
  useCreatePeriod,
  useEditPeriod,
  useOpenPeriod,
  usePeriods,
  useRoster,
} from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { formatDate, formatMoney } from "../lib/format";
import { QueryState } from "./QueryState";
import { confirmDialog } from "../lib/dialog";

const STATUS_LABEL: Record<AdminPeriod["status"], string> = { draft: "Bản nháp", open: "Đang mở", closed: "Đã đóng" };
const MEMBER_LABEL: Record<PeriodMemberStatus, string> = { fixed: "Cố định", guest: "Vãng lai", inactive: "Nghỉ" };

type Form = { name: string; startDate: string; endDate: string; fixedMemberFee: string; guestFeePerSession: string; note: string };

const toForm = (period?: AdminPeriod): Form => ({
  name: period?.name ?? "",
  startDate: period?.startDate ?? "",
  endDate: period?.endDate ?? "",
  fixedMemberFee: period ? String(period.fixedMemberFee) : "",
  guestFeePerSession: period ? String(period.guestFeePerSession) : "",
  note: period?.note ?? "",
});

const toInput = (form: Form): PeriodInput => ({
  name: form.name,
  startDate: form.startDate,
  endDate: form.endDate,
  fixedMemberFee: Number(form.fixedMemberFee || 0),
  guestFeePerSession: Number(form.guestFeePerSession || 0),
  note: form.note || null,
});

function PeriodForm({
  period,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  period?: AdminPeriod;
  busy: boolean;
  error: string | null;
  onSubmit: (input: PeriodInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(() => toForm(period));
  const set = (key: keyof Form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const prefix = period ? `edit-${period.id}` : "new-period";
  const money = (value: string) => value.replace(/\D/g, "").slice(0, 9);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(toInput(form));
  }

  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <label htmlFor={`${prefix}-name`}>Tên kỳ</label>
      <input id={`${prefix}-name`} value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Mùa 7" />
      <div className="two">
        <div>
          <label htmlFor={`${prefix}-start`}>Bắt đầu</label>
          <input id={`${prefix}-start`} type="date" value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${prefix}-end`}>Kết thúc</label>
          <input id={`${prefix}-end`} type="date" value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} />
        </div>
      </div>
      <div className="two">
        <div>
          <label htmlFor={`${prefix}-fixed`}>Phí cố định (đ)</label>
          <input id={`${prefix}-fixed`} inputMode="numeric" value={form.fixedMemberFee} onChange={(e) => set("fixedMemberFee")(money(e.target.value))} />
        </div>
        <div>
          <label htmlFor={`${prefix}-guest`}>Phí khách mỗi buổi (đ)</label>
          <input id={`${prefix}-guest`} inputMode="numeric" value={form.guestFeePerSession} onChange={(e) => set("guestFeePerSession")(money(e.target.value))} />
        </div>
      </div>
      {period && period.memberCount > 0 && (
        <p className="muted small">Đổi phí cố định không sửa các khoản phí đã tạo cho người đang trong kỳ.</p>
      )}
      <label htmlFor={`${prefix}-note`}>Ghi chú</label>
      <textarea id={`${prefix}-note`} rows={2} maxLength={500} value={form.note} onChange={(e) => set("note")(e.target.value)} />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : period ? "Lưu kỳ" : "Tạo bản nháp"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={onCancel} disabled={busy}>
          Đóng
        </button>
      </div>
    </form>
  );
}

function MemberRow({ member, periodId, locked }: { member: PeriodMemberRow; periodId: string; locked: boolean }) {
  const change = useChangePeriodMember(periodId);
  const save = async (status: PeriodMemberStatus, discountPercent: ShuttleDiscount) => {
    if (status !== member.status && member.status === "fixed" && !(await confirmDialog(`Đổi ${member.name} khỏi cố định? Phí cố định chưa trả sẽ bị hủy.`))) return;
    change.mutate({ id: member.id, status, discountPercent });
  };
  return (
    <li className="person">
      <div className="person-head">
        <div className="grow">
          <div className="row-title">{member.name}</div>
          {change.isError && <div className="error">{change.error.message}</div>}
        </div>
        <select
          aria-label={`Trạng thái của ${member.name}`}
          value={member.status}
          disabled={locked || change.isPending}
          onChange={(e) => save(e.target.value as PeriodMemberStatus, member.discountPercent)}
        >
          {(Object.keys(MEMBER_LABEL) as PeriodMemberStatus[]).map((status) => (
            <option key={status} value={status}>
              {MEMBER_LABEL[status]}
            </option>
          ))}
        </select>
        <select
          aria-label={`Miễn tiền cầu cho ${member.name}`}
          value={member.discountPercent}
          disabled={locked || change.isPending}
          onChange={(e) => save(member.status, Number(e.target.value) as ShuttleDiscount)}
        >
          <option value={0}>Không miễn cầu</option>
          <option value={50}>Miễn 50% cầu</option>
          <option value={100}>Miễn 100% cầu</option>
        </select>
      </div>
    </li>
  );
}

function Roster({ period }: { period: AdminPeriod }) {
  const query = useRoster(period.id);
  const add = useAddPeriodMembers(period.id);
  const [picked, setPicked] = useState<string[]>([]);
  const locked = period.status === "closed" || period.settled;

  return (
    <QueryState query={query}>
      {(roster) => (
        <div className="stack">
          {(roster.notice || add.isError) && (
            <p className={add.isError ? "error" : "ok"} role="status">
              {add.isError ? add.error.message : roster.notice}
            </p>
          )}
          {locked && (
            <p className="notice">
              {period.status === "closed" ? "Kỳ đã đóng, chỉ xem." : "Kỳ đã chốt chia tiền cầu: không đổi trạng thái hay mức miễn được nữa."}
            </p>
          )}
          <h3>Trong kỳ · {roster.members.length} người</h3>
          {roster.members.length ? (
            <ul className="people">
              {roster.members.map((member) => (
                <MemberRow key={member.id} member={member} periodId={period.id} locked={locked} />
              ))}
            </ul>
          ) : (
            <p className="muted">Kỳ chưa có ai.</p>
          )}

          {!locked && roster.candidates.length > 0 && (
            <>
              <h3>Thêm vào kỳ</h3>
              <p className="muted small">
                Người cố định được tạo phí cố định {formatMoney(period.fixedMemberFee)} ngay khi thêm. Loại cố định hay vãng lai lấy theo hồ sơ ở Nhân sự.
              </p>
              <div className="pick-list">
                {roster.candidates.map((person) => (
                  <label key={person.id} className={`pick${picked.includes(person.id) ? " on" : ""}`}>
                    <input
                      type="checkbox"
                      checked={picked.includes(person.id)}
                      onChange={(e) =>
                        setPicked((current) => (e.target.checked ? [...current, person.id] : current.filter((id) => id !== person.id)))
                      }
                    />
                    <span>{person.name}</span>
                    <span className="muted small">{person.attendanceType === "fixed" ? "Cố định" : "Vãng lai"}</span>
                  </label>
                ))}
              </div>
              <div className="actions">
                <button
                  className="btn btn-gold btn-small"
                  disabled={!picked.length || add.isPending}
                  onClick={() => add.mutate(picked, { onSuccess: () => setPicked([]) })}
                >
                  {add.isPending ? "Đang thêm…" : `Thêm ${picked.length || ""} người`}
                </button>
                <button className="btn btn-ghost btn-small" onClick={() => setPicked(roster.candidates.map((c) => c.id))}>
                  Chọn tất cả
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </QueryState>
  );
}

function PeriodCard({ period, selected, onSelect }: { period: AdminPeriod; selected: boolean; onSelect: () => void }) {
  const [editing, setEditing] = useState(false);
  const edit = useEditPeriod();
  const open = useOpenPeriod();

  async function openNow() {
    if ((await confirmDialog(`Mở ${period.name}? Thành viên sẽ thấy kỳ này ngay. Chỉ được có một kỳ mở cùng lúc.`))) open.mutate(period.id);
  }

  return (
    <section className={`card rise period-card${selected ? " selected" : ""}`}>
      <div className="card-head">
        <div>
          <h2>{period.name}</h2>
          <p className="row-sub">
            {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.memberCount} người · phí cố định{" "}
            {formatMoney(period.fixedMemberFee)} · khách {formatMoney(period.guestFeePerSession)}/buổi
          </p>
        </div>
        <span className={`chip chip-${period.status}`}>{STATUS_LABEL[period.status]}</span>
      </div>
      {open.isError && (
        <p className="error" role="alert">
          {open.error.message}
        </p>
      )}
      {editing ? (
        <PeriodForm
          period={period}
          busy={edit.isPending}
          error={edit.error?.message ?? null}
          onSubmit={(input) => edit.mutate({ id: period.id, input }, { onSuccess: () => setEditing(false) })}
          onCancel={() => {
            edit.reset();
            setEditing(false);
          }}
        />
      ) : (
        <div className="actions">
          <button className="btn btn-ghost btn-small" onClick={onSelect}>
            {selected ? "Ẩn thành viên" : "Thành viên trong kỳ"}
          </button>
          <Link to="/bao-cao/$id" params={{ id: period.id }} className="btn btn-ghost btn-small link-btn">
            Báo cáo
          </Link>
          {period.status !== "closed" && (
            <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
              Sửa
            </button>
          )}
          {period.status === "draft" && (
            <button className="btn btn-gold btn-small" onClick={openNow} disabled={open.isPending}>
              {open.isPending ? "Đang mở…" : "Mở kỳ"}
            </button>
          )}
        </div>
      )}
      {selected && <Roster period={period} />}
    </section>
  );
}

function PeriodsView({ periods }: { periods: AdminPeriod[] }) {
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<string | null>(() => periods.find((p) => p.status === "open")?.id ?? null);
  const create = useCreatePeriod();

  return (
    <div className="stack">
      {creating ? (
        <section className="card rise">
          <h2>Kỳ mới</h2>
          <PeriodForm
            busy={create.isPending}
            error={create.error?.message ?? null}
            onSubmit={(input) =>
              create.mutate(input, {
                onSuccess: (list) => {
                  setCreating(false);
                  // Mở luôn danh sách thành viên của kỳ nháp vừa tạo, để thêm người ngay.
                  const name = input.name.trim().replace(/\s+/g, " ");
                  const created = list.find((p) => p.status === "draft" && p.name === name);
                  if (created) setSelected(created.id);
                },
              })
            }
            onCancel={() => {
              create.reset();
              setCreating(false);
            }}
          />
        </section>
      ) : (
        <button className="btn btn-gold" onClick={() => setCreating(true)}>
          Tạo kỳ mới
        </button>
      )}
      <p className="muted small">
        Kỳ mới là bản nháp: thêm người và chỉnh phí trước, rồi bấm Mở kỳ. Chốt chia tiền cầu và đóng kỳ vẫn làm ở bản cũ cho tới khi v2 có phần đó.
      </p>
      {periods.map((period) => (
        <PeriodCard
          key={period.id}
          period={period}
          selected={selected === period.id}
          onSelect={() => setSelected((current) => (current === period.id ? null : period.id))}
        />
      ))}
    </div>
  );
}

export function Periods() {
  const { role } = useBootstrapData();
  const owner = role === "owner";
  const query = usePeriods(owner);
  if (!owner) {
    return (
      <section className="card rise">
        <h1>Kỳ quỹ</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được kỳ quỹ.</p>
      </section>
    );
  }
  return (
    <>
      <h1 className="page-title">Kỳ quỹ</h1>
      <QueryState query={query}>{(periods) => <PeriodsView periods={periods} />}</QueryState>
    </>
  );
}
