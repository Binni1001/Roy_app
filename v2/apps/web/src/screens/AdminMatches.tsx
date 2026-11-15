import { useState, type FormEvent } from "react";
import type { AdminMatch } from "@roy/shared";
import { useAdminMatchAction, useAdminMatches, type AdminMatchesData } from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { formatDate } from "../lib/format";
import { QueryState } from "./QueryState";

const names = (m: AdminMatch, side: "challengers" | "opponents") => m[side].map((p) => p.name).join(", ");

function status(m: AdminMatch): string {
  if (m.voided) return "Đã hủy kết quả";
  if (m.status === "pending") return "Chờ nhận kèo";
  if (m.status === "active") return "Chờ ghi tỷ số";
  if (m.status === "cancelled") return "Đã hủy kèo";
  return m.winnerSide === "challenger" ? `${names(m, "challengers")} thắng` : `${names(m, "opponents")} thắng`;
}

function ScoreForm({ match, mode, onDone }: { match: AdminMatch; mode: "result" | "correct"; onDone: () => void }) {
  const act = useAdminMatchAction();
  const [rows, setRows] = useState(() =>
    Array.from({ length: match.sets }, (_, i) => ({
      challenger: mode === "correct" && match.setScores?.[i] ? String(match.setScores[i].challenger) : "",
      opponent: mode === "correct" && match.setScores?.[i] ? String(match.setScores[i].opponent) : "",
    })),
  );
  const set = (i: number, side: "challenger" | "opponent", value: string) =>
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, [side]: value.replace(/\D/g, "").slice(0, 2) } : r)));

  function submit(event: FormEvent) {
    event.preventDefault();
    const setScores = rows.filter((r) => r.challenger !== "" && r.opponent !== "").map((r) => ({ challenger: Number(r.challenger), opponent: Number(r.opponent) }));
    act.mutate(
      { id: match.id, action: mode, body: mode === "correct" ? { setScores, expectedUpdatedAt: match.updatedAt } : { setScores } },
      { onSuccess: onDone },
    );
  }

  return (
    <form className="score-form" onSubmit={submit} noValidate>
      <div className="score-head">
        <span>{names(match, "challengers")}</span>
        <span>{names(match, "opponents")}</span>
      </div>
      {rows.map((r, i) => (
        <div className="score-row" key={i}>
          <input inputMode="numeric" aria-label={`Ván ${i + 1} bên thách đấu`} value={r.challenger} onChange={(e) => set(i, "challenger", e.target.value)} />
          <span className="muted small">Ván {i + 1}</span>
          <input inputMode="numeric" aria-label={`Ván ${i + 1} bên được thách`} value={r.opponent} onChange={(e) => set(i, "opponent", e.target.value)} />
        </div>
      ))}
      {act.isError && <p className="error">{act.error.message}</p>}
      <div className="match-actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={act.isPending}>
          {act.isPending ? "Đang lưu…" : mode === "correct" ? "Lưu tỷ số mới" : "Lưu kết quả"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={onDone}>
          Đóng
        </button>
      </div>
    </form>
  );
}

function MatchRow({ match }: { match: AdminMatch }) {
  const act = useAdminMatchAction();
  const [mode, setMode] = useState<"idle" | "result" | "correct">("idle");
  const open = match.status === "pending" || match.status === "active";
  const done = match.status === "completed" && !match.voided;

  function voidResult() {
    const reason = window.prompt("Lý do hủy kết quả (ít nhất 5 ký tự). Bảng xếp hạng sẽ tính lại không có trận này.");
    if (reason) act.mutate({ id: match.id, action: "void", body: { reason } });
  }

  return (
    <li className="match">
      <div className="match-meta">
        <span>
          {match.matchNumber ? `#${match.matchNumber} · ` : ""}
          {match.type === "doubles" ? "Đôi" : "Đơn"} · {match.sets} ván · {formatDate(match.playedAt)}
        </span>
        <span className={match.voided || match.status === "cancelled" ? "muted" : done ? "win" : ""}>{status(match)}</span>
      </div>
      <div className="match-sides">
        <span>{names(match, "challengers")}</span>
        <span className="vs">VS</span>
        <span className="right">{names(match, "opponents")}</span>
      </div>
      {match.setScores && match.status === "completed" && (
        <div className="row-sub">{match.setScores.map((s) => `${s.challenger}-${s.opponent}`).join(" · ")}</div>
      )}
      {match.voidReason && <div className="row-sub">Lý do hủy: {match.voidReason}</div>}
      {mode !== "idle" ? (
        <ScoreForm match={match} mode={mode} onDone={() => setMode("idle")} />
      ) : (
        (open || done) && (
          <div className="match-actions">
            {open && (
              <>
                <button className="btn btn-ghost btn-small" onClick={() => setMode("result")}>
                  Ghi tỷ số
                </button>
                <button className="btn btn-dark btn-small" disabled={act.isPending} onClick={() => window.confirm("Hủy kèo này?") && act.mutate({ id: match.id, action: "cancel" })}>
                  Hủy kèo
                </button>
              </>
            )}
            {done && (
              <>
                <button className="btn btn-ghost btn-small" onClick={() => setMode("correct")}>
                  Sửa tỷ số
                </button>
                <button className="btn btn-dark btn-small" disabled={act.isPending} onClick={voidResult}>
                  Hủy kết quả
                </button>
              </>
            )}
          </div>
        )
      )}
      {act.isError && <p className="error">{act.error.message}</p>}
    </li>
  );
}

function MatchesView({ data }: { data: AdminMatchesData }) {
  const [filter, setFilter] = useState<"open" | "done" | "all">("open");
  if (!data.period) {
    return (
      <section className="card rise">
        <h2>Chưa có kỳ đang mở</h2>
        <p className="muted">Kèo của kỳ đã đóng được giữ nguyên làm lịch sử.</p>
      </section>
    );
  }
  const shown = data.matches.filter((m) =>
    filter === "all" ? true : filter === "open" ? m.status === "pending" || m.status === "active" : m.status === "completed",
  );
  return (
    <div className="stack">
      {data.notice && (
        <p className="ok" role="status">
          {data.notice}
        </p>
      )}
      <section className="card rise">
        <div className="card-head">
          <h2>Kèo {data.period.name}</h2>
          <div className="seg" role="group" aria-label="Lọc kèo">
            <button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>
              Đang mở
            </button>
            <button className={filter === "done" ? "on" : ""} onClick={() => setFilter("done")}>
              Đã xong
            </button>
            <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
              Tất cả
            </button>
          </div>
        </div>
        <p className="muted small">Owner ghi, sửa tỷ số hoặc hủy kết quả cho mọi kèo của kỳ đang mở. Hủy kết quả cần ghi lý do; bảng xếp hạng tự tính lại.</p>
        {shown.length ? (
          <ul className="matches">
            {shown.map((match) => (
              <MatchRow key={match.id + match.updatedAt} match={match} />
            ))}
          </ul>
        ) : (
          <p className="muted">Không có kèo nào.</p>
        )}
      </section>
    </div>
  );
}

export function AdminMatches() {
  const { role } = useBootstrapData();
  const owner = role === "owner";
  const query = useAdminMatches(owner);
  if (!owner) {
    return (
      <section className="card rise">
        <h1>Quản lý kèo</h1>
        <p className="muted">Chỉ owner của câu lạc bộ quản lý được kèo.</p>
      </section>
    );
  }
  return (
    <>
      <h1 className="page-title">Quản lý kèo</h1>
      <QueryState query={query}>{(data) => <MatchesView data={data} />}</QueryState>
    </>
  );
}
