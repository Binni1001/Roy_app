import type { ManagedPerson, MemberRole } from "@roy/shared";
import { db } from "./db.ts";
import type { PeopleStore } from "./routes/people.ts";

type Own = Omit<PeopleStore, "findPerson" | "findOpenPeriod" | "getMembershipStatus">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const now = () => new Date().toISOString();

/** Truy vấn cho màn hình Nhân sự. Không chứa logic nghiệp vụ. */
export const supabasePeople: Own = {
  async listGroupPeople(groupId) {
    const { data, error } = await db()
      .from("person_groups")
      .select(
        "status, member_role, joined_at, " +
          "person:people!inner(id, full_name, nickname, email, phone, avatar_url, attendance_type)",
      )
      .eq("group_id", groupId)
      .in("status", ["active", "inactive"]);
    ensure(error);
    const rows = (data ?? []) as unknown as {
      status: "active" | "inactive";
      member_role: MemberRole;
      joined_at: string | null;
      person: {
        id: string;
        full_name: string;
        nickname: string | null;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
        attendance_type: string;
      };
    }[];
    return rows
      .map(
        ({ status, member_role, joined_at, person }): ManagedPerson => ({
          id: person.id,
          fullName: person.full_name,
          nickname: person.nickname,
          email: person.email,
          phone: person.phone,
          avatarUrl: person.avatar_url,
          attendanceType: person.attendance_type === "fixed" ? "fixed" : "guest",
          status,
          role: member_role,
          joinedAt: joined_at,
        }),
      )
      .sort((a, b) => (a.status === b.status ? a.fullName.localeCompare(b.fullName, "vi") : a.status === "active" ? -1 : 1));
  },

  async findPersonIdByEmail(email) {
    // ilike không có ký tự đại diện ở đây vì email đã qua kiểm tra dạng; vẫn thoát % và _ cho chắc.
    const pattern = email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data, error } = await db().from("people").select("id").ilike("email", pattern).limit(1);
    ensure(error);
    return (data?.[0]?.id as string | undefined) ?? null;
  },

  async createMember(groupId, input) {
    const { data, error } = await db()
      .from("people")
      .insert({
        full_name: input.fullName,
        nickname: input.nickname,
        email: input.email,
        phone: input.phone,
        attendance_type: input.attendanceType,
        status: "active",
        group_id: groupId,
        active_group_id: groupId,
      })
      .select("id")
      .single();
    ensure(error);
    const personId = (data as { id: string }).id;
    const membership = await db()
      .from("person_groups")
      .insert({ person_id: personId, group_id: groupId, status: "active", member_role: "member" });
    if (membership.error) {
      await db().from("people").delete().eq("id", personId);
      throw new Error(membership.error.message);
    }
  },

  async updatePerson(personId, input) {
    const { error } = await db()
      .from("people")
      .update({
        full_name: input.fullName,
        nickname: input.nickname,
        email: input.email,
        phone: input.phone,
        attendance_type: input.attendanceType,
        updated_at: now(),
      })
      .eq("id", personId);
    ensure(error);
  },

  async setMemberStatus(personId, groupId, status) {
    const before = await db().from("people").select("status, active_group_id").eq("id", personId).single();
    ensure(before.error);
    const previous = before.data as { status: string; active_group_id: string | null };
    const membership = await db()
      .from("person_groups")
      .update({ status })
      .eq("person_id", personId)
      .eq("group_id", groupId)
      .select("status");
    ensure(membership.error);
    try {
      const others = await db()
        .from("person_groups")
        .select("group_id")
        .eq("person_id", personId)
        .eq("status", "active")
        .neq("group_id", groupId);
      ensure(others.error);
      const otherGroups = (others.data ?? []).map((row) => row.group_id as string);
      if (status === "active") {
        const update: Record<string, unknown> = { status: "active", updated_at: now() };
        if (!previous.active_group_id || !otherGroups.includes(previous.active_group_id)) update.active_group_id = groupId;
        ensure((await db().from("people").update(update).eq("id", personId)).error);
      } else {
        const update: Record<string, unknown> = { updated_at: now() };
        if (!otherGroups.length) update.status = "inactive";
        // Đang xem nhóm vừa rời thì chuyển sang nhóm khác còn chơi, hoặc bỏ trống.
        if (previous.active_group_id === groupId) update.active_group_id = otherGroups[0] ?? null;
        ensure((await db().from("people").update(update).eq("id", personId)).error);
      }
    } catch (error) {
      // Không có giao dịch qua PostgREST: trả về như trước.
      await db()
        .from("person_groups")
        .update({ status: status === "active" ? "inactive" : "active" })
        .eq("person_id", personId)
        .eq("group_id", groupId);
      await db().from("people").update({ status: previous.status, active_group_id: previous.active_group_id }).eq("id", personId);
      throw error;
    }
  },
};
