import { Link, useParams } from "@tanstack/react-router";
import type { TournamentDetail as Detail, TournamentMatch, TournamentSummary } from "@roy/shared";
import { useTournament, useTournaments } from "../hooks/useMemberData";
import { formatDate } from "../lib/format";
import { QueryState } from "./QueryState";

const STATUS: Record<string, string> = {
  group_stage: "Đang vòng bảng",
  knockout: "Đang vòng loại trực tiếp",
  completed: "Đã kết thúc",
  cancelled: "Đã hủy",
};

const STAGE: Record<string, string> = {
  quarterfinal: "Tứ kết",
  semifinal: "Bán kết",
  third_place: "Tranh hạng ba",
  final: "Chung kết",
};

function dates(t: TournamentSummary): string {
  if (!t.startDate) return "";
  return t.endDate && t.endDate !== t.startDate
    ? ` · ${formatDate(t.startDate)} đến ${formatDate(t.endDate)}`
    : ` · ${formatDate(t.startDate)}`;
}

export function Tournaments() {
  const query = useTournaments();
  return (
    <>
      <h1 className="page-title">Giải đấu</h1>
      <QueryState query={query}>
        {(list) =>
          list.length ? (
            <div className="stack">
              {list.map((t) => (
                <Link key={t.id} to="/giai-dau/$id" params={{ id: t.id }} className="card card-link rise">
                  <h2>{t.name}</h2>
                  <p className="muted">
                    {STATUS[t.status] ?? t.status}
                    {dates(t)}
                  </p>
                  {t.championName && <p className="gold">Vô địch: {t.championName}</p>}
                </Link>
              ))}
            </div>
          ) : (
            <section className="card rise">
              <h2>Chưa có giải đấu nào</h2>
              <p className="muted">Giải sẽ hiện ở đây khi quản trị viên công bố.</p>
            </section>
          )
        }
      </QueryState>
    </>
  );
}

function MatchRow({ match }: { match: TournamentMatch }) {
  const left = match.team1?.name ?? match.team1Source ?? "Chờ xác định";
  const right = match.team2?.name ?? match.team2Source ?? "Chờ xác định";
  const done = match.status === "completed";
  const result = done
    ? `${match.team1Sets ?? 0} – ${match.team2Sets ?? 0}`
    : match.status === "bye"
      ? "Miễn đấu"
      : "Chưa đấu";
  return (
    <li className="match">
      <div className="match-sides">
        <span className={done && match.winnerTeamId === match.team1?.id ? "gold" : ""}>{left}</span>
        <span className="vs">{result}</span>
        <span className={`right${done && match.winnerTeamId === match.team2?.id ? " gold" : ""}`}>{right}</span>
      </div>
      {done && match.setScores && match.setScores.length > 0 && (
        <div className="row-sub">{match.setScores.map((s) => `${s.team1}-${s.team2}`).join(" · ")}</div>
      )}
    </li>
  );
}

function DetailView({ detail }: { detail: Detail }) {
  const stages = [...new Set(detail.knockout.map((match) => match.stage))];
  return (
    <div className="stack">
      <section className="card rise">
        <h2>{detail.name}</h2>
        <p className="muted">
          {STATUS[detail.status] ?? detail.status}
          {dates(detail)}
        </p>
        {detail.championName && <p className="big gold">Vô địch: {detail.championName}</p>}
      </section>

      {detail.groups.map((group) => (
        <section className="card rise d1" key={group.id}>
          <h2>{group.name}</h2>
          <div className="table-wrap">
            <table className="standings">
              <thead>
                <tr>
                  <th scope="col">Hạng</th>
                  <th scope="col">Đội</th>
                  <th scope="col">Trận</th>
                  <th scope="col">Thắng</th>
                  <th scope="col">Hiệu số ván</th>
                  <th scope="col">Hiệu số điểm</th>
                  <th scope="col">Điểm</th>
                </tr>
              </thead>
              <tbody>
                {group.standings.map((row) => (
                  <tr key={row.team.id} className={row.qualified ? "qualified" : ""}>
                    <td>{row.rank}</td>
                    <td>
                      <div className="row-title">{row.team.name}</div>
                      <div className="row-sub">{row.team.players.join(", ")}</div>
                    </td>
                    <td>{row.played}</td>
                    <td>{row.wins}</td>
                    <td>{row.setDifference}</td>
                    <td>{row.pointDifference}</td>
                    <td className="strong">{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted small">Đội tô vàng đi tiếp vào vòng loại trực tiếp.</p>
          <ul className="matches">
            {group.matches.map((match) => (
              <MatchRow key={match.id} match={match} />
            ))}
          </ul>
        </section>
      ))}

      {stages.map((stage) => (
        <section className="card rise d2" key={stage}>
          <h2>{STAGE[stage] ?? stage}</h2>
          <ul className="matches">
            {detail.knockout
              .filter((match) => match.stage === stage)
              .map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TournamentDetail() {
  const { id } = useParams({ from: "/giai-dau/$id" });
  const query = useTournament(id);
  return (
    <>
      <Link to="/giai-dau" className="back">
        ← Tất cả giải đấu
      </Link>
      <QueryState query={query}>{(detail) => <DetailView detail={detail} />}</QueryState>
    </>
  );
}
