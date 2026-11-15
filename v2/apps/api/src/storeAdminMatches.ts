import type { AdminMatch, ArenaPlayer, MatchSide, MatchType, SetScore } from "@roy/shared";
import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import type { AdminMatchStore } from "./routes/adminMatches.ts";

type Own = Pick<AdminMatchStore, "listAdminMatches" | "correctMatch" | "voidMatch">;

interface PlayerRow {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
}

const PLAYER = "(id, full_name, nickname, avatar_url)";
const players = (...rows: (PlayerRow | null)[]): ArenaPlayer[] =>
  rows.filter((r): r is PlayerRow => Boolean(r)).map((r) => ({ id: r.id, name: r.nickname || r.full_name, avatarUrl: r.avatar_url }));

const ERRORS: [RegExp, string][] = [
  [/PK match changed; reload/i, "Trận vừa thay đổi ở nơi khác. Tải lại rồi sửa lại."],
  [/Closed period results cannot be corrected|Closed period/i, "Kỳ đã đóng, giữ nguyên lịch sử."],
  [/voided PK match cannot be corrected/i, "Trận đã bị hủy kết quả, không sửa được."],
  [/Only a completed PK match/i, "Chỉ làm được với trận đã hoàn tất."],
  [/void reason of at least 5 characters/i, "Ghi lý do hủy kết quả, ít nhất 5 ký tự."],
  [/Set score count exceeds/i, "Số ván đã nhập vượt quá cấu hình trận."],
  [/Set scores are required|Set score format is invalid|Each set must have one winner/i, "Tỷ số các ván không hợp lệ."],
  [/Winner side/i, "Bên thắng không khớp với tỷ số."],
];

function matchError(error: { code?: string; message: string }): Error {
  const known = ERRORS.find(([pattern]) => pattern.test(error.message));
  if (known) return new ActionError(known[1], 409, "MATCH_RULE");
  if (["PGRST202", "42883"].includes(error.code ?? "")) {
    return new ActionError("Database chưa có hàm sửa kết quả (migration 20261011_pk_result_correction.sql).", 503, "MIGRATION_NEEDED");
  }
  console.error("[admin matches]", error.message);
  return new ActionError(`Database từ chối: ${error.message}`, 409, "MATCH_REFUSED");
}

/** Truy vấn cho màn hình Quản lý kèo. Sửa và hủy kết quả gọi hàm database có sẵn của bản cũ. */
export const supabaseAdminMatches: Own = {
  async listAdminMatches(periodId) {
    const { data, error } = await db()
      .from("pk_matches")
      .select(
        "id, match_number, match_type, status, played_at, sets, winner_side, set_scores, voided_at, void_reason, note, updated_at, " +
          "challenger:people!challenger_id" + PLAYER + ", challenger_partner:people!challenger_partner_id" + PLAYER + ", " +
          "opponent:people!opponent_id" + PLAYER + ", opponent_partner:people!opponent_partner_id" + PLAYER,
      )
      .eq("period_id", periodId)
      .order("played_at", { ascending: false });
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as {
      id: string;
      match_number: number | null;
      match_type: MatchType;
      status: string;
      played_at: string;
      sets: number;
      winner_side: MatchSide | null;
      set_scores: SetScore[] | null;
      voided_at: string | null;
      void_reason: string | null;
      note: string | null;
      updated_at: string;
      challenger: PlayerRow | null;
      challenger_partner: PlayerRow | null;
      opponent: PlayerRow | null;
      opponent_partner: PlayerRow | null;
    }[]).map(
      (row): AdminMatch => ({
        id: row.id,
        matchNumber: row.match_number,
        type: row.match_type,
        status: row.status,
        playedAt: row.played_at,
        sets: row.sets,
        challengers: players(row.challenger, row.challenger_partner),
        opponents: players(row.opponent, row.opponent_partner),
        winnerSide: row.winner_side,
        setScores: row.set_scores,
        voided: Boolean(row.voided_at),
        voidReason: row.void_reason,
        note: row.note,
        updatedAt: row.updated_at,
      }),
    );
  },

  async correctMatch(id, winnerSide, setScores, expectedUpdatedAt, actorEmail) {
    const { error } = await db().rpc("correct_pk_match_result", {
      p_match_id: id,
      p_winner_side: winnerSide,
      p_set_scores: setScores,
      p_expected_updated_at: expectedUpdatedAt,
      p_actor_email: actorEmail,
    });
    if (error) throw matchError(error);
  },

  async voidMatch(id, reason, actorEmail) {
    const { error } = await db().rpc("void_pk_match", { p_match_id: id, p_reason: reason, p_actor_email: actorEmail });
    if (error) throw matchError(error);
  },
};
