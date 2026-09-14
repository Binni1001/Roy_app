import { supabase } from "../config/supabase.js";
import { getUserRole } from "../utils/roles.js";
import { assignedGroupIds, canManageGroup, isGroupId } from "../utils/groupAuthorization.js";

export function groupError(message = "Bạn không được phân công quản lý nhóm này.", statusCode = 403) {
  return Object.assign(new Error(message), { statusCode });
}

export const groupAccess = {
  async visibleGroupIds(user) {
    const role = getUserRole(user);
    if (role === "owner") return null; // null means unrestricted only for owner.
    if (role === "admin") return assignedGroupIds(user);
    const { data: person, error } = await supabase.from("people").select("id, status")
      .eq("email", user?.email?.trim().toLowerCase() || "").maybeSingle();
    if (error) throw groupError("Không thể kiểm tra quyền nhóm.", 503);
    if (!person || person.status !== "active") return [];
    const result = await supabase.from("person_groups").select("group_id")
      .eq("person_id", person.id).eq("status", "active");
    if (result.error) throw groupError("Không thể kiểm tra quyền nhóm.", 503);
    return (result.data || []).map((row) => row.group_id);
  },

  async assertGroup(user, groupId, write = false) {
    const role = getUserRole(user);
    if (role === "owner") return;
    if (!isGroupId(groupId)) throw groupError("Nhóm không hợp lệ.", 400);
    if (role === "admin") {
      if (!canManageGroup(user, groupId)) throw groupError();
      return;
    }
    if (write || !(await this.visibleGroupIds(user)).includes(groupId)) throw groupError();
  },

  async resolveManagedGroup(user, person, requestedGroupId) {
    const role = getUserRole(user);
    if (!["owner", "admin"].includes(role)) throw groupError();
    let groupId = requestedGroupId || person?.active_group_id || person?.group_id;
    if (!groupId && role === "admin") {
      const assigned = assignedGroupIds(user);
      if (assigned.length === 1) groupId = assigned[0];
    }
    if (!groupId && role === "owner") {
      const { data, error } = await supabase.from("groups").select("id").limit(2);
      if (error) throw groupError("Không thể tải nhóm.", 503);
      if (data?.length === 1) groupId = data[0].id;
    }
    if (!groupId) throw groupError("Vui lòng chọn nhóm được quản lý trước khi thao tác.");
    await this.assertGroup(user, groupId, true);
    const { data, error } = await supabase.from("groups").select("id").eq("id", groupId).maybeSingle();
    if (error) throw groupError("Không thể tải nhóm.", 503);
    if (!data) throw groupError("Không tìm thấy nhóm.", 404);
    return groupId;
  }
};
