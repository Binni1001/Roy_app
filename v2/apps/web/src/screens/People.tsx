import { useMemo, useState, type FormEvent } from "react";
import type { ManagedPerson, PersonInput } from "@roy/shared";
import { useAddPerson, useEditPerson, usePeople, usePersonStatus } from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { QueryState } from "./QueryState";

type Form = Record<keyof PersonInput, string>;

const EMPTY: Form = { fullName: "", nickname: "", email: "", phone: "", attendanceType: "guest" };

const toForm = (person: ManagedPerson): Form => ({
  fullName: person.fullName,
  nickname: person.nickname ?? "",
  email: person.email ?? "",
  phone: person.phone ?? "",
  attendanceType: person.attendanceType,
});

const toInput = (form: Form): PersonInput => ({
  fullName: form.fullName,
  nickname: form.nickname || null,
  email: form.email || null,
  phone: form.phone || null,
  attendanceType: form.attendanceType === "fixed" ? "fixed" : "guest",
});

function PersonForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onCancel,
}: {
  initial: Form;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (input: PersonInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (key: keyof Form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));
  const id = (key: string) => `${submitLabel}-${key}`.replace(/\s+/g, "-");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(toInput(form));
  }

  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <label htmlFor={id("name")}>Họ tên</label>
      <input id={id("name")} value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} autoComplete="off" />
      <label htmlFor={id("nick")}>Biệt danh</label>
      <input id={id("nick")} value={form.nickname} onChange={(e) => set("nickname")(e.target.value)} autoComplete="off" />
      <label htmlFor={id("email")}>Email đăng nhập</label>
      <input
        id={id("email")}
        type="email"
        value={form.email}
        onChange={(e) => set("email")(e.target.value)}
        placeholder="Trùng email người đó dùng để đăng nhập"
        autoComplete="off"
      />
      <label htmlFor={id("phone")}>Số điện thoại</label>
      <input id={id("phone")} type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
      <label htmlFor={id("type")}>Loại thành viên</label>
      <select id={id("type")} value={form.attendanceType} onChange={(e) => set("attendanceType")(e.target.value)}>
        <option value="fixed">Cố định</option>
        <option value="guest">Vãng lai</option>
      </select>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={busy}>
          {busy ? "Đang lưu…" : submitLabel}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={onCancel} disabled={busy}>
          Đóng
        </button>
      </div>
    </form>
  );
}

function PersonRow({ person, meId }: { person: ManagedPerson; meId: string | undefined }) {
  const [editing, setEditing] = useState(false);
  const edit = useEditPerson();
  const status = usePersonStatus();
  const resting = person.status === "inactive";

  function toggle() {
    if (resting) return status.mutate({ id: person.id, status: "active" });
    if (window.confirm(`Cho ${person.fullName} nghỉ? Người này sẽ không vào được app của nhóm cho tới khi được cho chơi lại.`)) {
      status.mutate({ id: person.id, status: "inactive" });
    }
  }

  return (
    <li className={`person${resting ? " resting" : ""}`}>
      <div className="person-head">
        <div className="grow">
          <div className="row-title">
            {person.fullName}
            {person.nickname ? <span className="muted"> · {person.nickname}</span> : null}
          </div>
          <div className="row-sub">
            {person.attendanceType === "fixed" ? "Cố định" : "Vãng lai"}
            {person.role !== "member" ? ` · ${person.role === "owner" ? "Owner" : "Quản trị"}` : ""}
            {resting ? " · Đã nghỉ" : ""}
            {person.email ? ` · ${person.email}` : " · chưa có email"}
          </div>
        </div>
        {!editing && (
          <div className="actions">
            <button className="btn btn-ghost btn-small" onClick={() => setEditing(true)}>
              Sửa
            </button>
            {person.id !== meId && (
              <button className="btn btn-dark btn-small" onClick={toggle} disabled={status.isPending}>
                {status.isPending ? "Đang lưu…" : resting ? "Cho chơi lại" : "Cho nghỉ"}
              </button>
            )}
          </div>
        )}
      </div>
      {status.isError && (
        <p className="error" role="alert">
          {status.error.message}
        </p>
      )}
      {editing && (
        <PersonForm
          initial={toForm(person)}
          submitLabel="Lưu"
          busy={edit.isPending}
          error={edit.error?.message ?? null}
          onSubmit={(input) => edit.mutate({ id: person.id, input }, { onSuccess: () => setEditing(false) })}
          onCancel={() => {
            edit.reset();
            setEditing(false);
          }}
        />
      )}
    </li>
  );
}

function PeopleView({ people, meId }: { people: ManagedPerson[]; meId: string | undefined }) {
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<"active" | "inactive">("active");
  const [adding, setAdding] = useState(false);
  const add = useAddPerson();

  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    return people.filter(
      (p) =>
        p.status === show &&
        (!needle || [p.fullName, p.nickname, p.email, p.phone].some((v) => v?.toLocaleLowerCase("vi").includes(needle))),
    );
  }, [people, search, show]);
  const counts = { active: people.filter((p) => p.status === "active").length, inactive: people.filter((p) => p.status === "inactive").length };

  return (
    <div className="stack">
      <section className="card rise">
        <div className="card-head">
          <div className="seg" role="group" aria-label="Lọc theo trạng thái">
            <button className={show === "active" ? "on" : ""} onClick={() => setShow("active")}>
              Đang chơi · {counts.active}
            </button>
            <button className={show === "inactive" ? "on" : ""} onClick={() => setShow("inactive")}>
              Đã nghỉ · {counts.inactive}
            </button>
          </div>
          {!adding && (
            <button className="btn btn-gold btn-small" onClick={() => setAdding(true)}>
              Thêm người
            </button>
          )}
        </div>

        {adding && (
          <PersonForm
            initial={EMPTY}
            submitLabel="Thêm vào nhóm"
            busy={add.isPending}
            error={add.error?.message ?? null}
            onSubmit={(input) => add.mutate(input, { onSuccess: () => setAdding(false) })}
            onCancel={() => {
              add.reset();
              setAdding(false);
            }}
          />
        )}

        <input
          className="search"
          type="search"
          placeholder="Tìm theo tên, email, số điện thoại"
          aria-label="Tìm người"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {visible.length ? (
          <ul className="people">
            {visible.map((person) => (
              <PersonRow key={person.id} person={person} meId={meId} />
            ))}
          </ul>
        ) : (
          <p className="muted">{search ? "Không tìm thấy ai." : show === "active" ? "Nhóm chưa có ai." : "Chưa có ai nghỉ."}</p>
        )}
        <p className="muted small">Người tự đăng ký bằng mã mời nằm ở mục Duyệt thành viên cho tới khi được duyệt.</p>
      </section>
    </div>
  );
}

export function People() {
  const { role, me } = useBootstrapData();
  const owner = role === "owner";
  const query = usePeople(owner);
  if (!owner) {
    return (
      <section className="card rise">
        <h1>Nhân sự</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được nhân sự.</p>
      </section>
    );
  }
  return (
    <>
      <h1 className="page-title">Nhân sự</h1>
      <QueryState query={query}>{(people) => <PeopleView people={people} meId={me?.id} />}</QueryState>
    </>
  );
}
