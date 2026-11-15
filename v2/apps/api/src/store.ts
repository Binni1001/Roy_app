import type { PostgrestError } from "@supabase/supabase-js";
import { db } from "./db.ts";
import type { PersonRow } from "./routes/bootstrap.ts";
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
export const supabaseStore: MemberStore = {
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
        .select("id, play_date, status, capacity, open_play_registrations(person_id)")
        .eq("period_id", periodId)
        .order("play_date", { ascending: true }),
    ) as unknown as {
      id: string;
      play_date: string;
      status: string;
      capacity: number;
      open_play_registrations: { person_id: string }[];
    }[];
    return rows.map((row) => ({
      id: row.id,
      date: row.play_date,
      status: row.status,
      capacity: row.capacity,
      registered: row.open_play_registrations.length,
      mine: row.open_play_registrations.some((r) => r.person_id === personId),
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
};
