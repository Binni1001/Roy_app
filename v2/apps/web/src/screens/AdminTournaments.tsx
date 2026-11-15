import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import type { AdminTournament, KnockoutStart, TournamentMatch } from "@roy/shared";
import {
  useAdminTournament,
  useAdminTournaments,
  useConfigureTournament,
  useCreateTournament,
  useDeleteTournament,
  useSaveTournamentMatch,
  useTournamentStep,
} from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { ApiRequestError } from "../lib/api";
import { formatDate } from "../lib/format";
import { QueryState } from "./QueryState";

const STATUS: Record<string, string> = {
  draft: "Bản nháp",
  group_stage: "Vòng bảng",
  knockout: "Vòng trong",
  completed: "Đã xong",
  cancelled: "Đã hủy",
};
const STAGE: Record<string, string> = { quarterfinal: "Tứ kết", semifinal: "Bán kết", third_place: "Tranh hạng ba", final: "Chung kết", group: "Vòng bảng" };
const START_LABEL: Record<KnockoutStart, string> = { quarterfinal: "Tứ kết", semifinal: "Bán kết", final: "Chung kết" };
const defaultStart = (groups: number): KnockoutStart => (groups <= 1 ? "final" : groups <= 2 ? "semifinal" : "quarterfinal");

function OwnerOnly({ children }: { children: ReactNode }) {
  const { role } = useBootstrapData();
  if (role !== "owner") {
    return (
      <section className="card rise">
        <h1>Quản lý giải đấu</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được giải đấu.</p>
      </section>
    );
  }
  return <>{children}</>;
}

function CreateForm() {
  const create = useCreateTournament();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", groupCount: 2, bestOf: 3, thirdPlace: false, startDate: "", endDate: "" });
  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      {
        name: form.name,
        description: null,
        startDate: form.startDate || null,
        endDate: form.endDate || null,
        groupCount: form.groupCount,
        bestOf: form.bestOf,
        knockoutStart: defaultStart(form.groupCount),
        thirdPlace: form.thirdPlace,
      },
      { onSuccess: (t) => void navigate({ to: "/quan-ly-giai/$id", params: { id: t.id } }) },
    );
  }
  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <label htmlFor="t-name">Tên giải</label>
      <input id="t-name" value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Roy Badminton Open" />
      <div className="three">
        <div>
          <label htmlFor="t-groups">Số bảng</label>
          <select id="t-groups" value={form.groupCount} onChange={(e) => setForm({ ...form, groupCount: Number(e.target.value) })}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} bảng → {START_LABEL[defaultStart(n)].toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="t-bestof">Số ván</label>
          <select id="t-bestof" value={form.bestOf} onChange={(e) => setForm({ ...form, bestOf: Number(e.target.value) })}>
            {[1, 3, 5].map((n) => (
              <option key={n} value={n}>
                {n} ván
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="t-third">Tranh hạng ba</label>
          <select id="t-third" value={form.thirdPlace ? "1" : "0"} onChange={(e) => setForm({ ...form, thirdPlace: e.target.value === "1" })}>
            <option value="0">Không</option>
            <option value="1">Có</option>
          </select>
        </div>
      </div>
      <div className="two">
        <div>
          <label htmlFor="t-start">Bắt đầu</label>
          <input id="t-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <label htmlFor="t-end">Kết thúc</label>
          <input id="t-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
      </div>
      {create.isError && <p className="error">{create.error.message}</p>}
      <div className="actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={create.isPending || form.name.trim().length < 2}>
          {create.isPending ? "Đang tạo…" : "Tạo giải nháp"}
        </button>
      </div>
    </form>
  );
}

export function AdminTournaments() {
  const { role } = useBootstrapData();
  const query = useAdminTournaments(role === "owner");
  const [creating, setCreating] = useState(false);
  return (
    <OwnerOnly>
      <h1 className="page-title">Quản lý giải đấu</h1>
      <div className="stack">
        {creating ? (
          <section className="card rise">
            <h2>Giải mới</h2>
            <CreateForm />
          </section>
        ) : (
          <button className="btn btn-gold" onClick={() => setCreating(true)}>
            Tạo giải mới
          </button>
        )}
        <QueryState query={query}>
          {(list) =>
            list.length ? (
              <section className="card rise">
                <ul className="rows">
                  {list.map((t) => (
                    <li className="row" key={t.id}>
                      <Link to="/quan-ly-giai/$id" params={{ id: t.id }} className="grow plain-link">
                        <div className="row-title">{t.name}</div>
                        <div className="row-sub">
                          {STATUS[t.status] ?? t.status} · {t.teamCount} đội · {t.groupCount} bảng · {t.bestOf} ván
                          {t.startDate ? ` · ${formatDate(t.startDate)}` : ""}
                          {t.championName ? ` · vô địch ${t.championName}` : ""}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="muted">Chưa có giải nào.</p>
            )
          }
        </QueryState>
      </div>
    </OwnerOnly>
  );
}

interface TeamRow {
  name: string;
  groupIndex: number;
  a: string;
  b: string;
}

function TeamBuilder({ t }: { t: AdminTournament }) {
  const configure = useConfigureTournament(t.id);
  const [groupCount, setGroupCount] = useState(t.groupCount);
  const [rows, setRows] = useState<TeamRow[]>(() =>
    Array.from({ length: Math.max(4, t.groupCount * 2) }, (_, i) => ({ name: "", groupIndex: (i % t.groupCount) + 1, a: "", b: "" })),
  );
  const used = new Set(rows.flatMap((r) => [r.a, r.b]).filter(Boolean));
  const set = (i: number, patch: Partial<TeamRow>) => setRows((cur) => cur.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const filled = rows.filter((r) => r.a && r.b);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (t.teamCount && !window.confirm("Dựng lại sẽ xóa đội, bảng và lịch hiện có của giải nháp. Tiếp tục?")) return;
    configure.mutate({
      groupCount,
      bestOf: t.bestOf,
      knockoutStart: defaultStart(groupCount),
      thirdPlace: t.thirdPlace,
      teams: filled.map((r, i) => ({
        name: r.name.trim() || `${t.players.find((p) => p.id === r.a)?.name ?? ""} / ${t.players.find((p) => p.id === r.b)?.name ?? ""}`.trim() || `Đội ${i + 1}`,
        seed: null,
        groupIndex: Math.min(r.groupIndex, groupCount),
        memberIds: [r.a, r.b],
      })),
    });
  }

  const pick = (value: string, onChange: (v: string) => void, label: string) => (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Chọn người</option>
      {t.players
        .filter((p) => p.id === value || !used.has(p.id))
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );

  return (
    <form className="form person-form" onSubmit={submit} noValidate>
      <h3>Ghép đội và chia bảng</h3>
      <label htmlFor="b-groups">Số bảng</label>
      <select id="b-groups" value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))}>
        {[1, 2, 3, 4].map((n) => (
          <option key={n} value={n}>
            {n} bảng → {START_LABEL[defaultStart(n)].toLowerCase()}
          </option>
        ))}
      </select>
      <div className="team-rows">
        {rows.map((r, i) => (
          <div className="team-row" key={i}>
            <input aria-label={`Tên đội ${i + 1}`} placeholder={`Đội ${i + 1} (tự đặt theo tên)`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            {pick(r.a, (v) => set(i, { a: v }), `Người thứ nhất đội ${i + 1}`)}
            {pick(r.b, (v) => set(i, { b: v }), `Người thứ hai đội ${i + 1}`)}
            <select aria-label={`Bảng của đội ${i + 1}`} value={Math.min(r.groupIndex, groupCount)} onChange={(e) => set(i, { groupIndex: Number(e.target.value) })}>
              {Array.from({ length: groupCount }, (_, g) => (
                <option key={g} value={g + 1}>
                  Bảng {String.fromCharCode(65 + g)}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setRows((cur) => [...cur, { name: "", groupIndex: (cur.length % groupCount) + 1, a: "", b: "" }])}>
          Thêm đội
        </button>
        <button className="btn btn-gold btn-small" type="submit" disabled={configure.isPending || filled.length < groupCount * 2}>
          {configure.isPending ? "Đang dựng…" : `Dựng vòng bảng (${filled.length} đội)`}
        </button>
      </div>
      {configure.isError && <p className="error">{configure.error.message}</p>}
    </form>
  );
}

function MatchScore({ match, t }: { match: TournamentMatch; t: AdminTournament }) {
  const save = useSaveTournamentMatch();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() =>
    Array.from({ length: t.bestOf }, (_, i) => ({ team1: match.setScores?.[i] ? String(match.setScores[i].team1) : "", team2: match.setScores?.[i] ? String(match.setScores[i].team2) : "" })),
  );
  const ready = Boolean(match.team1 && match.team2);
  const locked = t.status === "draft" || t.status === "cancelled";

  function submit(event: FormEvent, rebuildKnockout = false) {
    event.preventDefault();
    const setScores = rows.filter((r) => r.team1 !== "" && r.team2 !== "").map((r) => ({ team1: Number(r.team1), team2: Number(r.team2) }));
    save.mutate(
      { matchId: match.id, setScores, rebuildKnockout },
      {
        onSuccess: () => setOpen(false),
        onError: (error) => {
          if (error instanceof ApiRequestError && error.code === "CONFIRM_REBUILD" && window.confirm(`${error.message} Đồng ý?`)) submit(event, true);
        },
      },
    );
  }

  return (
    <li className="match">
      <div className="match-meta">
        <span>
          {match.matchNumber ? `#${match.matchNumber} · ` : ""}
          {STAGE[match.stage] ?? match.stage}
        </span>
        <span>{match.status === "completed" ? `${match.team1Sets ?? 0} - ${match.team2Sets ?? 0}` : match.status === "bye" ? "Đi thẳng" : "Chưa đấu"}</span>
      </div>
      <div className="match-sides">
        <span className={match.winnerTeamId && match.winnerTeamId === match.team1?.id ? "win" : ""}>{match.team1?.name ?? match.team1Source ?? "Chờ đội"}</span>
        <span className="vs">VS</span>
        <span className={`right ${match.winnerTeamId && match.winnerTeamId === match.team2?.id ? "win" : ""}`}>{match.team2?.name ?? match.team2Source ?? "Chờ đội"}</span>
      </div>
      {match.setScores && match.status === "completed" && <div className="row-sub">{match.setScores.map((s) => `${s.team1}-${s.team2}`).join(" · ")}</div>}
      {!locked && ready && !open && (
        <div className="match-actions">
          <button className="btn btn-ghost btn-small" onClick={() => setOpen(true)}>
            {match.status === "completed" ? "Sửa tỷ số" : "Nhập tỷ số"}
          </button>
        </div>
      )}
      {open && (
        <form className="score-form" onSubmit={(e) => submit(e)} noValidate>
          {rows.map((r, i) => (
            <div className="score-row" key={i}>
              <input inputMode="numeric" aria-label={`Ván ${i + 1} ${match.team1?.name}`} value={r.team1} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, team1: e.target.value.replace(/\D/g, "").slice(0, 2) } : x)))} />
              <span className="muted small">Ván {i + 1}</span>
              <input inputMode="numeric" aria-label={`Ván ${i + 1} ${match.team2?.name}`} value={r.team2} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, team2: e.target.value.replace(/\D/g, "").slice(0, 2) } : x)))} />
            </div>
          ))}
          {save.isError && !(save.error instanceof ApiRequestError && save.error.code === "CONFIRM_REBUILD") && <p className="error">{save.error.message}</p>}
          <div className="match-actions">
            <button className="btn btn-gold btn-small" type="submit" disabled={save.isPending}>
              {save.isPending ? "Đang lưu…" : "Lưu tỷ số"}
            </button>
            <button className="btn btn-ghost btn-small" type="button" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
        </form>
      )}
    </li>
  );
}

function TournamentView({ t }: { t: AdminTournament }) {
  const step = useTournamentStep(t.id);
  const remove = useDeleteTournament();
  const navigate = useNavigate();
  const groupDone = t.groups.length > 0 && t.groups.every((g) => g.matches.every((m) => m.status === "completed"));

  return (
    <div className="stack">
      <section className="card rise">
        <div className="card-head">
          <div>
            <h2>{t.name}</h2>
            <p className="row-sub">
              {t.teamCount} đội · {t.groupCount} bảng · {t.bestOf} ván · bắt đầu loại trực tiếp từ {START_LABEL[t.knockoutStart].toLowerCase()}
              {t.thirdPlace ? " · có tranh hạng ba" : ""}
              {t.championName ? ` · vô địch ${t.championName}` : ""}
            </p>
          </div>
          <span className={`chip chip-${t.status === "draft" ? "draft" : t.status === "completed" || t.status === "cancelled" ? "closed" : "open"}`}>{STATUS[t.status] ?? t.status}</span>
        </div>
        {step.isError && <p className="error">{step.error.message}</p>}
        {remove.isError && <p className="error">{remove.error.message}</p>}
        <div className="actions">
          {t.status === "draft" && t.teamCount > 0 && (
            <button className="btn btn-gold btn-small" disabled={step.isPending} onClick={() => window.confirm("Công bố giải? Thành viên sẽ thấy lịch vòng bảng.") && step.mutate("publish")}>
              Công bố giải
            </button>
          )}
          {t.status === "group_stage" && groupDone && !t.hasKnockout && (
            <button className="btn btn-gold btn-small" disabled={step.isPending} onClick={() => step.mutate("knockout")}>
              Tạo vòng trong
            </button>
          )}
          {t.status !== "cancelled" && t.status !== "completed" && t.status !== "draft" && (
            <button className="btn btn-dark btn-small" disabled={step.isPending} onClick={() => window.confirm("Hủy giải này?") && step.mutate("cancel")}>
              Hủy giải
            </button>
          )}
          {(t.status === "draft" || t.status === "cancelled") && (
            <button
              className="btn btn-dark btn-small"
              disabled={remove.isPending}
              onClick={() => window.confirm("Xóa hẳn giải này? Không hoàn tác được.") && remove.mutate(t.id, { onSuccess: () => void navigate({ to: "/quan-ly-giai" }) })}
            >
              Xóa giải
            </button>
          )}
        </div>
      </section>

      {t.status === "draft" && (
        <section className="card rise d1">
          <TeamBuilder t={t} />
        </section>
      )}

      {t.groups.map((g) => (
        <section className="card rise d1" key={g.id}>
          <h3>{g.name}</h3>
          <div className="table-wrap">
            <table className="standings">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Đội</th>
                  <th>Trận</th>
                  <th>Thắng</th>
                  <th>Điểm</th>
                  <th>HS ván</th>
                  <th>HS điểm</th>
                </tr>
              </thead>
              <tbody>
                {g.standings.map((row) => (
                  <tr key={row.team.id} className={row.qualified ? "qualified" : ""}>
                    <td>{row.rank}</td>
                    <td className="row-title">{row.team.name}</td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td className="strong">{row.points}</td>
                    <td>{row.setDifference}</td>
                    <td>{row.pointDifference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="matches">
            {g.matches.map((m) => (
              <MatchScore key={m.id + (m.setScores ? JSON.stringify(m.setScores) : "")} match={m} t={t} />
            ))}
          </ul>
        </section>
      ))}

      {t.knockout.length > 0 && (
        <section className="card rise d2">
          <h3>Vòng loại trực tiếp</h3>
          <ul className="matches">
            {t.knockout.map((m) => (
              <MatchScore key={m.id + (m.setScores ? JSON.stringify(m.setScores) : "") + (m.team1?.id ?? "") + (m.team2?.id ?? "")} match={m} t={t} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function AdminTournamentDetail() {
  const { id } = useParams({ strict: false }) as { id: string };
  const query = useAdminTournament(id);
  return (
    <OwnerOnly>
      <Link to="/quan-ly-giai" className="back">
        ← Quản lý giải đấu
      </Link>
      <QueryState query={query}>{(t) => <TournamentView t={t} />}</QueryState>
    </OwnerOnly>
  );
}
