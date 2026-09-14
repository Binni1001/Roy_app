// Until each module has query + entity isolation tests, do not expose it to
// scoped admins. Owners retain access; this is not a claim of full isolation.
const READY_MODULES = new Set(["people", "periods", "groups", "admin-users"]);

export function adminScopeRollout(req, res, next) {
  if (req.authRole !== "admin") return next();
  const module = req.path.toLowerCase().split("/").filter(Boolean)[0];
  if (READY_MODULES.has(module)) return next();
  return res.status(403).json({ code: "GROUP_SCOPE_NOT_READY",
    message: "Chức năng này chưa mở cho admin theo nhóm. Owner vẫn có thể thao tác trong khi hoàn thiện kiểm tra phân quyền." });
}
