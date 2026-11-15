import { useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Arena as ArenaData, ArenaMatch, ArenaPlayer, LeaderboardRow, MatchType } from "@roy/shared";
import { useArena, useArenaHistory } from "../hooks/useMemberData";
import { formatDate } from "../lib/format";
import { MatchButtons, NewMatchForm } from "./MatchActions";
import { QueryState } from "./QueryState";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2)).toUpperCase();
}

function Avatar({ player, size = 44 }: { player: ArenaPlayer; size?: number }) {
  const style = { width: size, height: size };
  return player.avatarUrl ? (
    <img className="avatar" src={player.avatarUrl} alt="" style={style} loading="lazy" />
  ) : (
    <span className="avatar" style={style} aria-hidden="true">
      {initials(player.name)}
    </span>
  );
}

const signed = (value: number) => (value > 0 ? `+${value}` : String(value));

function Podium({ rows }: { rows: LeaderboardRow[] }) {
  // Thứ tự hiển thị: hạng nhì bên trái, hạng nhất ở giữa, hạng ba bên phải.
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  return (
    <div className="podium" aria-label="Ba người dẫn đầu">
      {order.map((row) => (
        <div className={`pod pod-${rows.indexOf(row) + 1}`} key={row.id}>
          <Avatar player={row} size={rows.indexOf(row) === 0 ? 60 : 48} />
          <div className="pod-name">{row.name}</div>
          <div className="pod-points">{signed(row.points)} điểm</div>
          <div className="pod-bar">{row.rank}</div>
        </div>
      ))}
    </div>
  );
}

function Board({ rows, meId }: { rows: LeaderboardRow[]; meId: string }) {
  if (!rows.length) {
    return <p className="muted">Chưa có trận nào hoàn tất ở nội dung này trong kỳ.</p>;
  }
  const me = rows.find((row) => row.id === meId);
  return (
    <>
      <Podium rows={rows} />
      {me && (
        <p className="my-rank">
          Bạn đang hạng {me.rank}
          {me.tied ? " (đồng hạng)" : ""} · {signed(me.points)} điểm
        </p>
      )}
      <ol className="rows board">
        {rows.map((row) => (
          <li className={`row${row.id === meId ? " me" : ""}`} key={row.id}>
            <span className="rank">{row.rank}</span>
            <Avatar player={row} size={40} />
            <div className="grow">
              <div className="row-title">{row.name}</div>
              <div className="row-sub">
                {row.wins} thắng · {row.losses} thua · hiệu số {signed(row.scoreDifference)}
              </div>
            </div>
            <div className="row-amount">{signed(row.points)}</div>
          </li>
        ))}
      </ol>
    </>
  );
}

const names = (players: ArenaPlayer[]) => players.map((player) => player.name).join(", ");

function matchStatus(match: ArenaMatch): string {
  if (match.voided) return "Đã hủy kết quả";
  if (match.status === "pending") return "Chờ nhận kèo";
  if (match.status === "active") return "Chờ ghi tỷ số";
  return "Đã xong";
}

function MatchCard({ match, meId }: { match: ArenaMatch; meId: string }) {
  const mineIsChallenger = match.challengers.some((player) => player.id === meId);
  const done = match.status === "completed" && !match.voided && match.winnerSide;
  const won = done && (match.winnerSide === "challenger") === mineIsChallenger;
  return (
    <li className="match">
      <div className="match-meta">
        <span>
          {match.type === "doubles" ? "Đôi" : "Đơn"} · {match.sets} ván · {formatDate(match.playedAt)}
        </span>
        <span className={done ? (won ? "win" : "loss") : ""}>
          {done ? (won ? "Thắng" : "Thua") : matchStatus(match)}
        </span>
      </div>
      <div className="match-sides">
        <span>{names(match.challengers)}</span>
        <span className="vs">VS</span>
        <span className="right">{names(match.opponents)}</span>
      </div>
      {done && match.setScores && (
        <div className="row-sub">
          {match.setScores.map((s) => `${s.challenger}-${s.opponent}`).join(" · ")}
        </div>
      )}
      <MatchButtons match={match} meId={meId} />
    </li>
  );
}

function ArenaView({ arena }: { arena: ArenaData }) {
  const [type, setType] = useState<MatchType>(
    arena.singles.length >= arena.doubles.length && arena.singles.length ? "singles" : "doubles",
  );

  if (!arena.period) {
    return (
      <section className="card rise">
        <h2>Chưa có kỳ đang mở</h2>
        <p className="muted">Bảng xếp hạng sẽ hiện khi quản trị viên mở kỳ mới.</p>
      </section>
    );
  }

  return (
    <div className="stack arena">
      <section className="card rise">
        <div className="card-head">
          <h2>Bảng xếp hạng {arena.period.name}</h2>
          <div className="seg" role="group" aria-label="Nội dung thi đấu">
            <button className={type === "singles" ? "on" : ""} onClick={() => setType("singles")}>
              Đơn
            </button>
            <button className={type === "doubles" ? "on" : ""} onClick={() => setType("doubles")}>
              Đôi
            </button>
          </div>
        </div>
        {arena.supported ? (
          <>
            <p className="muted small">Thắng +3, thua −2. Hòa điểm thì xét hiệu số, rồi đối đầu.</p>
            <Board rows={type === "singles" ? arena.singles : arena.doubles} meId={arena.meId} />
          </>
        ) : (
          <p className="muted">Kỳ này dùng luật xếp hạng cũ. Bảng của kỳ sẽ được chuyển sang ở bản cập nhật tới.</p>
        )}
      </section>

      <section className="card rise d1">
        <h2>Kèo của bạn · {arena.myMatches.length}</h2>
        {arena.myMatches.length ? (
          <ul className="matches">
            {arena.myMatches.map((match) => (
              <MatchCard key={match.id} match={match} meId={arena.meId} />
            ))}
          </ul>
        ) : (
          <p className="muted">Bạn chưa có kèo nào trong kỳ này.</p>
        )}
        <NewMatchForm meId={arena.meId} />
        <Link to="/giai-dau" className="btn btn-ghost link-btn">
          Xem giải đấu của câu lạc bộ
        </Link>
      </section>

      <History />
    </div>
  );
}

const RULES: Record<string, string> = {
  fixed_3_2_v1: "Thắng +3, thua −2",
  elo_v1: "Điểm Elo",
  legacy_wilson_v1: "Điểm Wilson",
};

/** Bảng đã lưu khi đóng kỳ. Hiện nguyên trạng, không tính lại theo luật mới. */
function History() {
  const { data } = useArenaHistory();
  if (!data?.length) return null;
  return (
    <section className="card rise d2">
      <h2>Các kỳ trước</h2>
      {data.map((period) => (
        <details className="past" key={period.periodId}>
          <summary>
            <span className="row-title">{period.periodName}</span>
            <span className="row-sub">{RULES[period.scoringRule] ?? period.scoringRule}</span>
          </summary>
          {(["doubles", "singles"] as const)
            .filter((kind) => period[kind].length > 0)
            .map((kind) => (
              <div key={kind}>
                <h3>{kind === "doubles" ? "Đôi" : "Đơn"}</h3>
                <ol className="rows board">
                  {period[kind].map((row) => (
                    <li className="row" key={row.id}>
                      <span className="rank">{row.rank}</span>
                      <Avatar player={row} size={36} />
                      <div className="grow">
                        <div className="row-title">{row.name}</div>
                        <div className="row-sub">
                          {row.wins} thắng · {row.losses} thua
                        </div>
                      </div>
                      <div className="row-amount">{row.points}</div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
        </details>
      ))}
    </section>
  );
}

export function Arena() {
  const query = useArena();
  return (
    <>
      <h1 className="page-title">Đấu trường</h1>
      <QueryState query={query}>{(arena) => <ArenaView arena={arena} />}</QueryState>
    </>
  );
}
