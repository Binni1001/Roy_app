import { db } from "./db.ts";
import type { BootstrapStore, PersonRow } from "./routes/bootstrap.ts";

/** Truy vấn Supabase cho /bootstrap: một lượt lấy người và nhóm, một lượt lấy kỳ đang mở. */
export const supabaseStore: BootstrapStore = {
  async findPerson(email) {
    const { data, error } = await db()
      .from("people")
      .select(
        "id, full_name, nickname, avatar_url, status, active_group_id, " +
          "person_groups(group_id, status, member_role, groups(id, name))",
      )
      .eq("email", email)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as unknown as PersonRow | null;
  },

  async findOpenPeriod(groupId) {
    const { data, error } = await db()
      .from("periods")
      .select("id, name, status, start_date, end_date")
      .eq("group_id", groupId)
      .eq("status", "open")
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      name: data.name,
      status: data.status,
      startDate: data.start_date,
      endDate: data.end_date,
    };
  },
};
