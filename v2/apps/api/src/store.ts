import type { PostgrestError } from "@supabase/supabase-js";
import { db } from "./db.ts";
import type { PersonRow } from "./routes/bootstrap.ts";
import type { ArenaMatch, ArenaPlayer, MatchSide, MatchType, SetScore } from "@roy/shared";
import type { ArenaStore } from "./routes/arena.ts";
import type { MemberStore } from "./routes/member.ts";

function check<T>(result: { data: T; error: PostgrestError | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

function list<T>(result: { data: T[] | null; error: PostgrestError | null }): T[] {
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

/** Mọi truy vấn Supabase của API nằm ở đây. Không chứa logic nghiệp vụ. */
interface PlayerRow {
  id: string;
  full_name: string;
  nickname: string | null;
  avatar_url: string | null;
}

const PLAYER = "(id, full_name, nickname, avatar_url)";

function players(...rows: (PlayerRow | null)[]): ArenaPlayer[] {
  return rows
    .filter((row): row is PlayerRow => Boolean(row))
    .map((row) => ({ id: row.id, name: row.nickname || row.full_name, avatarUrl: row.avatar_url }));
}

export const supabaseStore: MemberStore & ArenaStore = {
  async findPerson(email) {
    const data = check(
      await db()
        .from("people")
        .select(
          "id, full_name, nickname, avatar_url, status, active_group_id, " +
            "person_groups(group_id, status, member_role, groups(id, name))",
        )
        .eq("email", email)
        .maybeSingle(),
    );
    return data as unknown as PersonRow | null;
  },

  async findOpenPeriod(groupId) {
    const data = check(
      await db()
        .from("periods")
        .select("id, name, status, start_date, end_date")
        .eq("group_id", groupId)
        .eq("status", "open")
        .order("start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      status: data.status,
      startDate: data.start_date,
      endDate: data.end_date,
    };
  },

  async listDebts(personId, groupId) {
    const rows = list(
      await db()
        .from("debts")
        .select("id, debt_type, status, amount, description, created_at, paid_at, period:periods!inner(name, group_id)")
        .eq("person_id", personId)
        .eq("period.group_id", groupId)
        .order("created_at", { ascending: false }),
    ) as unknown as {
      id: string;
      debt_type: never;
      status: never;
      amount: number;
      description: string | null;
      created_at: string;
      paid_at: string | null;
      period: { name: string };
    }[];
    return rows.map((row) => ({
      id: row.id,
      type: row.debt_type,
      status: row.status,
      amount: Number(row.amount),
      description: row.description,
      periodName: row.period.name,
      createdAt: row.created_at,
      paidAt: row.paid_at,
    }));
  },

  async getBalance(personId) {
    const data = check(
      await db().from("person_balances").select("balance").eq("person_id", personId).maybeSingle(),
    );
    return Number(data?.balance ?? 0);
  },

  async listTransactions(personId, limit) {
    const rows = list(
      await db()
        .from("balance_transactions")
        .select("id, transaction_type, direction, amount, description, created_at")
        .eq("person_id", personId)
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return rows.map((row) => ({
      id: row.id,
      type: row.transaction_type,
      direction: row.direction === "minus" ? ("minus" as const) : ("plus" as const),
      amount: Number(row.amount),
      description: row.description,
      createdAt: row.created_at,
    }));
  },

  async listOpenLoans(personId, groupId) {
    const rows = list(
      await db()
        .from("shuttle_loans")
        .select("id, quantity, amount, borrowed_at, period:periods!inner(name, group_id)")
        .eq("person_id", personId)
        .eq("period.group_id", groupId)
        .is("paid_at", null)
        .neq("status", "cancelled")
        .order("borrowed_at", { ascending: false }),
    ) as unknown as {
      id: string;
      quantity: number;
      amount: number;
      borrowed_at: string;
      period: { name: string };
    }[];
    return rows.map((row) => ({
      id: row.id,
      quantity: row.quantity,
      amount: Number(row.amount),
      borrowedAt: row.borrowed_at,
      periodName: row.period.name,
    }));
  },

  async listOpenDays(periodId, personId) {
    const rows = list(
      await db()
        .from("open_play_days")
        .select(
          "id, play_date, status, capacity, " +
            "open_play_registrations(person_id, created_at, person:people(full_name, nickname))",
        )
        .eq("period_id", periodId)
        .order("play_date", { ascending: true }),
    ) as unknown as {
      id: string;
      play_date: string;
      status: string;
      capacity: number;
      open_play_registrations: {
        person_id: string;
        created_at: string;
        person: { full_name: string; nickname: string | null } | null;
      }[];
    }[];
    return rows.map((row) => ({
      id: row.id,
      date: row.play_date,
      status: row.status,
      capacity: row.capacity,
      registered: row.open_play_registrations.length,
      mine: row.open_play_registrations.some((r) => r.person_id === personId),
      names: [...row.open_play_registrations]
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((r) => r.person?.nickname || r.person?.full_name || "Thành viên"),
    }));
  },

  async listPlayedSessions(periodId) {
    const rows = list(
      await db()
        .from("badminton_sessions")
        .select("id, play_date, note")
        .eq("period_id", periodId)
        .order("play_date", { ascending: false }),
    );
    return rows.map((row) => ({ id: row.id, date: row.play_date, note: row.note }));
  },

  async getScoringRule(periodId) {
    const data = check(await db().from("periods").select("pk_scoring_rule").eq("id", periodId).maybeSingle());
    return data?.pk_scoring_rule ?? null;
  },

  async listPeriodMatches(periodId) {
    const rows = list(
      await db()
        .from("pk_matches")
        .select(
          "id, match_type, status, played_at, sets, winner_side, set_scores, voided_at, " +
            "challenger:people!challenger_id" + PLAYER + ", challenger_partner:people!challenger_partner_id" + PLAYER + ", " +
            "opponent:people!opponent_id" + PLAYER + ", opponent_partner:people!opponent_partner_id" + PLAYER,
        )
        .eq("period_id", periodId)
        .order("played_at", { ascending: false }),
    ) as unknown as {
      id: string;
      match_type: MatchType;
      status: string;
      played_at: string;
      sets: number;
      winner_side: MatchSide | null;
      set_scores: SetScore[] | null;
      voided_at: string | null;
      challenger: PlayerRow | null;
      challenger_partner: PlayerRow | null;
      opponent: PlayerRow | null;
      opponent_partner: PlayerRow | null;
    }[];
    return rows.map(
      (row): ArenaMatch => ({
        id: row.id,
        type: row.match_type,
        status: row.status,
        playedAt: row.played_at,
        sets: row.sets,
        challengers: players(row.challenger, row.challenger_partner),
        opponents: players(row.opponent, row.opponent_partner),
        winnerSide: row.winner_side,
        setScores: row.set_scores,
        voided: Boolean(row.voided_at),
      }),
    );
  },
};
