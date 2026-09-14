import { supabase } from "../../config/supabase.js";
import { requireEmail, validateFullName, assertValid } from "../../utils/validators.js";
import { getUserRole } from "../../utils/roles.js";
import { assignedGroupIds, isGroupId } from "../../utils/groupAuthorization.js";

const adminRoles = new Set(["owner", "admin"]);

// Avoid loading every auth page before filtering by role.
async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage
    });

    if (error) {
      throw error;
    }

    users.push(...(data?.users || []));

    if (!data?.users?.length || data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: getUserRole(user),
    managed_group_ids: assignedGroupIds(user),
    full_name: user.user_metadata?.full_name || user.user_metadata?.name || "",
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at
  };
}

async function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const users = await listAllUsers();

  return users.find((user) => user.email?.toLowerCase() === normalizedEmail) || null;
}

async function updateRole(user, role, fullName = "") {
  const appMetadata = {
    ...(user.app_metadata || {}),
    role,
    ...(role === "user" || (role === "admin" && getUserRole(user) !== "admin") ? { managed_group_ids: [] } : {})
  };
  const userMetadata = {
    ...(user.user_metadata || {}),
    ...(fullName ? { full_name: fullName } : {})
  };

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    app_metadata: appMetadata,
    user_metadata: userMetadata
  });

  if (error) {
    throw error;
  }

  return data.user;
}

export const adminUsersService = {
  async listGroups() {
    const { data, error } = await supabase.from("groups").select("id, name").order("name");
    if (error) throw error;
    return data || [];
  },

  async assignGroups(userId, groupIds) {
    if (!Array.isArray(groupIds) || groupIds.length > 100 || !groupIds.every(isGroupId)) {
      throw Object.assign(new Error("Danh sách nhóm không hợp lệ (tối đa 100 nhóm)."), { statusCode: 400 });
    }
    const ids = [...new Set(groupIds.map((id) => id.toLowerCase()))];
    const { data, error } = await supabase.auth.admin.getUserById(userId);
    if (error) throw error;
    if (!data?.user) throw Object.assign(new Error("Không tìm thấy tài khoản."), { statusCode: 404 });
    if (getUserRole(data.user) !== "admin") {
      throw Object.assign(new Error("Chỉ phân công nhóm cho tài khoản admin; owner quản lý toàn hệ thống."), { statusCode: 400 });
    }
    if (ids.length) {
      const result = await supabase.from("groups").select("id").in("id", ids);
      if (result.error) throw result.error;
      if (result.data?.length !== ids.length) throw Object.assign(new Error("Có nhóm không tồn tại."), { statusCode: 400 });
    }
    const result = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { managed_group_ids: ids }
    });
    if (result.error) throw result.error;
    return publicUser(result.data.user);
  },

  async listAdmins() {
    const users = await listAllUsers();

    return users
      .filter((user) => adminRoles.has(getUserRole(user)))
      .map(publicUser);
  },

  async inviteAdmin({ email, full_name: fullName = "" }) {
    // Validate the email format.
    assertValid(requireEmail(email));

    // Validate the optional name.
    if (fullName) {
      assertValid(validateFullName(fullName));
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await findUserByEmail(normalizedEmail);

    if (existingUser) {
      const currentRole = getUserRole(existingUser);

      // Never downgrade the owner account.
      if (currentRole === "owner") {
        const err = new Error("Khong the thay doi role cua owner");
        err.statusCode = 403;
        throw err;
      }

      const updatedUser = await updateRole(existingUser, "admin", fullName);
      return {
        invited: false,
        user: publicUser(updatedUser)
      };
    }

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: {
        full_name: fullName
      }
    });

    if (error) {
      throw error;
    }

    const invitedUser = data?.user;

    if (!invitedUser) {
      const inviteError = new Error("Admin invitation did not return a user");
      inviteError.statusCode = 500;
      throw inviteError;
    }

    const updatedUser = await updateRole(invitedUser, "admin", fullName);

    return {
      invited: true,
      user: publicUser(updatedUser)
    };
  },

  async revokeAdmin(userId) {
    if (!userId) {
      const err = new Error("User ID khong duoc de trong");
      err.statusCode = 400;
      throw err;
    }

    const { data: userData, error: fetchError } = await supabase.auth.admin.getUserById(userId);
    if (fetchError) throw fetchError;

    const user = userData?.user;
    if (!user) {
      const err = new Error("Khong tim thay user");
      err.statusCode = 404;
      throw err;
    }

    const currentRole = getUserRole(user);
    if (currentRole === "owner") {
      const err = new Error("Khong the thu hoi quyen cua owner");
      err.statusCode = 403;
      throw err;
    }

    const updatedUser = await updateRole(user, "user");
    return {
      revoked: true,
      user: publicUser(updatedUser)
    };
  }
};
