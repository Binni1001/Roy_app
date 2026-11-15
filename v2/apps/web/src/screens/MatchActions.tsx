import { useState, type FormEvent } from "react";
import type { ArenaMatch, ArenaPlayer, MatchType } from "@roy/shared";
import { useArenaPlayers, useCreateMatch, useMatchAction } from "../hooks/useMemberData";

const todayLocal = () => new Intl.DateTimeFormat("en-CA").format(new Date());
const names = (players: ArenaPlayer[]) => players.map((player) => player.name).join(", ");

function PlayerSelect({
  id,
  label,
  value,
  onChange,
  players,
  taken,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  players: ArenaPlayer[];
  taken: string[];
}) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chọn người chơi</option>
        {players
          .filter((player) => player.id === value || !taken.includes(player.id))
          .map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
      </select>
    </>
  );
}

/** Tạo kèo mới. Mặc định mình là bên thách đấu; tạo hộ người khác cũng được, như bản cũ. */
export function NewMatchForm({ meId }: { meId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MatchType>("doubles");
  // Như bản cũ: mặc định mình là bên thách đấu, nhưng tạo kèo hộ người khác cũng được.
  const [challengerId, setChallengerId] = useState(meId);
  const [opponentId, setOpponentId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [opponentPartnerId, setOpponentPartnerId] = useState("");
  const [sets, setSets] = useState("3");
  const [playDate, setPlayDate] = useState(todayLocal);
  const players = useArenaPlayers(open);
  const create = useCreateMatch();

  if (!open) {
    return (
      <button className="btn btn-gold" onClick={() => setOpen(true)}>
        Tạo kèo
      </button>
    );
  }

  const everyone = players.data ?? [];
  const doubles = type === "doubles";

  function submit(event: FormEvent) {
    event.preventDefault();
    create.mutate(
      { type, challengerId, opponentId, partnerId, opponentPartnerId, sets: Number(sets), playDate },
      {
        onSuccess: () => {
          setOpen(false);
          setChallengerId(meId);
          setOpponentId("");
          setPartnerId("");
          setOpponentPartnerId("");
        },
      },
    );
  }

  return (
    <form className="form inline-form" onSubmit={submit} noValidate>
      <label htmlFor="match-type">Nội dung</label>
      <select id="match-type" value={type} onChange={(e) => setType(e.target.value as MatchType)}>
        <option value="doubles">Đánh đôi</option>
        <option value="singles">Đánh đơn</option>
      </select>

      <PlayerSelect
        id="challenger"
        label="Bên thách đấu"
        value={challengerId}
        onChange={setChallengerId}
        players={everyone}
        taken={[partnerId, opponentId, opponentPartnerId]}
      />
      {doubles && (
        <PlayerSelect
          id="partner"
          label="Đồng đội bên thách đấu"
          value={partnerId}
          onChange={setPartnerId}
          players={everyone}
          taken={[challengerId, opponentId, opponentPartnerId]}
        />
      )}
      <PlayerSelect
        id="opponent"
        label="Bên được thách đấu"
        value={opponentId}
        onChange={setOpponentId}
        players={everyone}
        taken={[challengerId, partnerId, opponentPartnerId]}
      />
      {doubles && (
        <PlayerSelect
          id="opponent-partner"
          label="Đồng đội bên được thách đấu"
          value={opponentPartnerId}
          onChange={setOpponentPartnerId}
          players={everyone}
          taken={[challengerId, partnerId, opponentId]}
        />
      )}

      <label htmlFor="match-sets">Số ván</label>
      <select id="match-sets" value={sets} onChange={(e) => setSets(e.target.value)}>
        <option value="1">1 ván</option>
        <option value="3">3 ván</option>
        <option value="5">5 ván</option>
      </select>

      <label htmlFor="match-date">Ngày thi đấu</label>
      <input id="match-date" type="date" min={todayLocal()} value={playDate} onChange={(e) => setPlayDate(e.target.value)} />

      {players.isError && (
        <p className="error" role="alert">
          Không tải được danh sách người chơi. {players.error.message}
        </p>
      )}
      {create.isError && (
        <p className="error" role="alert">
          {create.error.message}
        </p>
      )}

      <div className="match-actions">
        <button className="btn btn-gold btn-small" type="submit" disabled={create.isPending}>
          {create.isPending ? "Đang tạo…" : "Gửi lời thách đấu"}
        </button>
        <button className="btn btn-ghost btn-small" type="button" onClick={() => setOpen(false)}>
          Đóng
        </button>
      </div>
    </form>
  );
}

/** Nút nhận kèo, hủy kèo và ghi tỷ số cho một trận còn mở mà mình tham gia. */
export function MatchButtons({ match }: { match: ArenaMatch; meId?: string }) {
  const [mode, setMode] = useState<"idle" | "confirm-cancel" | "score">("idle");
  const [scores, setScores] = useState(() => Array.from({ length: match.sets }, () => ({ challenger: "", opponent: "" })));
  const act = useMatchAction();

  if (match.voided || (match.status !== "pending" && match.status !== "active")) return null;
  const run = (action: "accept" | "cancel") => act.mutate({ id: match.id, action }, { onSuccess: () => setMode("idle") });

  function submitScore(event: FormEvent) {
    event.preventDefault();
    const setScores = scores
      .filter((s) => s.challenger !== "" && s.opponent !== "")
      .map((s) => ({ challenger: Number(s.challenger), opponent: Number(s.opponent) }));
    act.mutate({ id: match.id, action: "result", body: { setScores } }, { onSuccess: () => setMode("idle") });
  }

  const setScore = (index: number, side: "challenger" | "opponent", value: string) =>
    setScores((current) => current.map((s, i) => (i === index ? { ...s, [side]: value.replace(/\D/g, "").slice(0, 2) } : s)));

  return (
    <div className="match-tools">
      {mode === "score" ? (
        <form className="score-form" onSubmit={submitScore} noValidate>
          <div className="score-head">
            <span>{names(match.challengers)}</span>
            <span>{names(match.opponents)}</span>
          </div>
          {scores.map((score, index) => (
            <div className="score-row" key={index}>
              <input
                inputMode="numeric"
                aria-label={`Ván ${index + 1}, điểm của ${names(match.challengers)}`}
                value={score.challenger}
                onChange={(e) => setScore(index, "challenger", e.target.value)}
              />
              <span className="row-sub">Ván {index + 1}</span>
              <input
                inputMode="numeric"
                aria-label={`Ván ${index + 1}, điểm của ${names(match.opponents)}`}
                value={score.opponent}
                onChange={(e) => setScore(index, "opponent", e.target.value)}
              />
            </div>
          ))}
          <p className="muted small">Bỏ trống ván không đánh. Kết quả sẽ bị khóa sau khi lưu.</p>
          <div className="match-actions">
            <button className="btn btn-gold btn-small" type="submit" disabled={act.isPending}>
              {act.isPending ? "Đang lưu…" : "Lưu kết quả"}
            </button>
            <button className="btn btn-ghost btn-small" type="button" onClick={() => setMode("idle")}>
              Đóng
            </button>
          </div>
        </form>
      ) : mode === "confirm-cancel" ? (
        <div className="match-actions">
          <button className="btn btn-danger btn-small" onClick={() => run("cancel")} disabled={act.isPending}>
            {act.isPending ? "Đang hủy…" : "Xác nhận hủy kèo"}
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setMode("idle")}>
            Giữ lại
          </button>
        </div>
      ) : (
        <div className="match-actions">
          {match.status === "pending" && (
            <button className="btn btn-gold btn-small" onClick={() => run("accept")} disabled={act.isPending}>
              Nhận kèo
            </button>
          )}
          <button className="btn btn-ghost btn-small" onClick={() => setMode("score")}>
            Ghi tỷ số
          </button>
          <button className="btn btn-ghost btn-small" onClick={() => setMode("confirm-cancel")}>
            Hủy kèo
          </button>
        </div>
      )}
      {act.isError && (
        <p className="error" role="alert">
          {act.error.message}
        </p>
      )}
    </div>
  );
}
