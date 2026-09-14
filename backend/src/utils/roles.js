const roles = new Set(["user", "admin", "owner"]);

// Only app_metadata is server-managed. user_metadata must never grant rights.
export function getUserRole(user) {
  const role = user?.app_metadata?.role;
  return roles.has(role) ? role : "user";
}
