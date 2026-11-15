import { db } from "./db.ts";
import { ActionError } from "./routes/actions.ts";
import { todayInVietnam, type MatchStore } from "./routes/matches.ts";

/** Lỗi của RPC finalize_pk_match, đổi sang lời nhắn cho người dùng. */
const FINALIZE_ERRORS: [RegExp, string][] = [
  [/already completed and locked|completed PK match is locked/i, "Trận đã hoàn tất và bị khóa."],
  [/cancelled PK match cannot be completed/i, "Không thể ghi kết quả cho trận đã hủy."],
  [/Set scores are required|Set score format is invalid|Each set must have one winner/i, "Tỷ số các ván không hợp lệ."],
  [/Set score count exceeds/i, "Số ván đã nhập vượt quá cấu hình trận."],
  [/Winner side/i, "Bên thắng không khớp với tỷ số các ván."],
  [/Complete or cancel earlier PK matches first/i, "Hãy hoàn tất hoặc hủy các trận có số thứ tự nhỏ hơn trước."],
  [/Every player must be active/i, "Tất cả người chơi phải đang hoạt động."],
  [/Closed period|must belong to a period/i, "Kỳ đã đóng nên không ghi được kết quả."],
];

export const supabaseMatches: MatchStore = {
  async listGroupPlayers(groupId) {
    const { data, error } = await db()
      .from("person_groups")
      .select("person:people!inner(id, full_name, nickname, avatar_url, status)")
      .eq("group_id", groupId)
      .eq("status", "active")
      .eq("person.status", "active");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as {
      person: { id: string; full_name: string; nickname: string | null; avatar_url: string | null };
    }[];
    return rows
      .map(({ person }) => ({ id: person.id, name: person.nickname || person.full_name, avatarUrl: person.avatar_url }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  },

  async getMatch(id) {
    const { data, error } = await db()
      .from("pk_matches")
      .select(
        "id, period_id, status, sets, played_at, challenger_id, challenger_partner_id, opponent_id, opponent_partner_id, " +
          "period:periods(group_id)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as {
      id: string;
      period_id: string;
      status: string;
      sets: number;
      played_at: string;
      challenger_id: string;
      challenger_partner_id: string | null;
      opponent_id: string;
      opponent_partner_id: string | null;
      period: { group_id: string | null } | null;
    };
    return {
      id: row.id,
      periodId: row.period_id,
      groupId: row.period?.group_id ?? null,
      status: row.status,
      sets: row.sets,
      playDate: todayInVietnam(new Date(row.played_at)),
      challengerIds: [row.challenger_id, row.challenger_partner_id].filter((x): x is string => Boolean(x)),
      opponentIds: [row.opponent_id, row.opponent_partner_id].filter((x): x is string => Boolean(x)),
    };
  },

  async insertMatch(periodId, match) {
    const { error } = await db()
      .from("pk_matches")
      .insert({
        period_id: periodId,
        match_type: match.type,
        challenger_id: match.challengerId,
        challenger_partner_id: match.challengerPartnerId,
        opponent_id: match.opponentId,
        opponent_partner_id: match.opponentPartnerId,
        sets: match.sets,
        played_at: `${match.playDate}T00:00:00+07:00`,
        note: match.note,
        status: "pending",
        winner_side: null,
        set_scores: null,
      });
    if (error) {
      console.error("[insert pk_match]", error.message);
      throw new ActionError("Không tạo được kèo. Kiểm tra lại người chơi và thử lại.", 409, "MATCH_NOT_CREATED");
    }
  },

  async setMatchStatus(id, status, from) {
    const { data, error } = await db()
      .from("pk_matches")
      .update({ status })
      .eq("id", id)
      .in("status", from)
      .select("id");
    if (error) throw new Error(error.message);
    return (data ?? []).length > 0;
  },

  async finalizeMatch(id, winnerSide, setScores, actorEmail) {
    const { error } = await db().rpc("finalize_pk_match", {
      p_match_id: id,
      p_winner_side: winnerSide,
      p_set_scores: setScores,
      p_actor_email: actorEmail,
    });
    if (!error) return;
    const known = FINALIZE_ERRORS.find(([pattern]) => pattern.test(error.message));
    if (!known) console.error("[finalize_pk_match]", error.message);
    throw new ActionError(known ? known[1] : "Không ghi được kết quả. Thử lại sau.", known ? 409 : 503, "MATCH_NOT_FINALIZED");
  },
};
