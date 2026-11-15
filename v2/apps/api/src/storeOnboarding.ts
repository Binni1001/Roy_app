import { db } from "./db.ts";
import type { AvatarStore } from "./routes/avatar.ts";
import type { OnboardingStore } from "./routes/onboarding.ts";

type Writes = Omit<OnboardingStore, "findPerson" | "findOpenPeriod">;

function ensure(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const EXTENSIONS = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" } as const;

/** Truy vấn cho việc vào nhóm, đổi nhóm và ảnh đại diện. Không chứa logic nghiệp vụ. */
export const supabaseOnboarding: Writes & AvatarStore = {
  async findGroupByCode(code) {
    // Mã đã được kiểm tra chỉ gồm chữ, số và gạch ngang, nên không có ký tự đại diện của ilike.
    const { data, error } = await db().from("groups").select("id, name").ilike("invite_code", code).maybeSingle();
    ensure(error);
    return data ? { id: data.id as string, name: data.name as string } : null;
  },

  async createPendingPerson({ email, fullName, groupId }) {
    const { data, error } = await db()
      .from("people")
      .insert({
        full_name: fullName,
        email,
        status: "pending",
        attendance_type: "guest",
        group_id: groupId,
        active_group_id: null,
      })
      .select("id")
      .single();
    ensure(error);
    const personId = (data as { id: string }).id;
    const membership = await db()
      .from("person_groups")
      .insert({ person_id: personId, group_id: groupId, status: "pending", member_role: "member" });
    if (membership.error) {
      // Không để lại hồ sơ không thuộc nhóm nào.
      await db().from("people").delete().eq("id", personId);
      throw new Error(membership.error.message);
    }
  },

  async requestMembership(personId, groupId) {
    const { error } = await db()
      .from("person_groups")
      .insert({ person_id: personId, group_id: groupId, status: "pending", member_role: "member" });
    ensure(error);
  },

  async setActiveGroup(personId, groupId) {
    const { error } = await db()
      .from("people")
      .update({ active_group_id: groupId, updated_at: new Date().toISOString() })
      .eq("id", personId);
    ensure(error);
  },

  async uploadAvatar(personId, bytes, type) {
    // Cùng quy ước tên file với bản cũ: <person_id>.<đuôi>, ghi đè ảnh trước đó.
    const path = `${personId}.${EXTENSIONS[type]}`;
    const bucket = db().storage.from("avatars");
    const { error } = await bucket.upload(path, bytes, { upsert: true, contentType: type, cacheControl: "3600" });
    ensure(error);
    return `${bucket.getPublicUrl(path).data.publicUrl}?t=${Date.now()}`;
  },

  async setAvatarUrl(personId, url) {
    const { error } = await db()
      .from("people")
      .update({ avatar_url: url, updated_at: new Date().toISOString() })
      .eq("id", personId);
    ensure(error);
  },
};
