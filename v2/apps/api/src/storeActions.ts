import { db } from "./db.ts";
import type { Profile } from "@roy/shared";
import { ActionError, type ActionsStore } from "./routes/actions.ts";
import type { ProfileStore } from "./routes/profile.ts";

const PROFILE = "full_name, nickname, phone, bio, email, avatar_url";

interface ProfileRow {
  full_name: string;
  nickname: string | null;
  phone: string | null;
  bio: string | null;
  email: string | null;
  avatar_url: string | null;
}

function toProfile(row: ProfileRow): Profile {
  return {
    fullName: row.full_name,
    nickname: row.nickname,
    phone: row.phone,
    bio: row.bio,
    email: row.email,
    avatarUrl: row.avatar_url,
  };
}

/** Các thao tác ghi của thành viên. Việc kiểm tra nghiệp vụ nằm trong RPC của database. */
export const supabaseActions: ActionsStore & ProfileStore = {
  async markNotificationsRead(personId) {
    const { error } = await db()
      .from("notifications")
      .update({ read: true })
      .eq("person_id", personId)
      .eq("read", false);
    if (error) throw new Error(error.message);
  },

  async deleteNotifications(personId, id) {
    let query = db().from("notifications").delete().eq("person_id", personId);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    if (error) throw new Error(error.message);
  },

  async findOpenDay(dayId) {
    const { data, error } = await db()
      .from("open_play_days")
      .select("period_id, play_date, period:periods!inner(group_id)")
      .eq("id", dayId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    const row = data as unknown as {
      period_id: string;
      play_date: string;
      period: { group_id: string | null };
    };
    return { periodId: row.period_id, date: row.play_date, groupId: row.period.group_id };
  },

  async mutateOpenDay(periodId, date, actorId, action) {
    const { error } = await db().rpc("mutate_open_play_day", {
      p_period_id: periodId,
      p_play_date: date,
      p_actor_id: actorId,
      p_action: action,
      p_note: "",
    });
    if (!error) return;
    if (error.message === "OPEN_DAY_FULL") {
      throw new ActionError("Buổi này vừa đủ người. Chọn ngày khác hoặc tải lại.", 409, "OPEN_DAY_FULL");
    }
    if (error.code === "42501") {
      throw new ActionError("Bạn không có quyền thao tác trong câu lạc bộ này.", 403, "OPEN_DAY_FORBIDDEN");
    }
    if (error.code === "22023") {
      throw new ActionError(
        "Ngày không hợp lệ, kỳ chưa mở, hoặc đã qua giờ đăng ký và hủy (17:30).",
        409,
        "OPEN_DAY_UNAVAILABLE",
      );
    }
    console.error("[mutate_open_play_day]", error.message);
    throw new ActionError("Không lưu được đăng ký. Thử lại sau.", 503, "OPEN_DAY_ERROR");
  },

  async getProfile(personId) {
    const { data, error } = await db().from("people").select(PROFILE).eq("id", personId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toProfile(data as unknown as ProfileRow) : null;
  },

  async updateProfile(personId, input) {
    const { data, error } = await db()
      .from("people")
      .update({ full_name: input.fullName, nickname: input.nickname, phone: input.phone, bio: input.bio })
      .eq("id", personId)
      .select(PROFILE)
      .single();
    if (error) throw new Error(error.message);
    return toProfile(data as unknown as ProfileRow);
  },
};
