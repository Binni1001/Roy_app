// Check the actor on every HTTP request, including requests with an existing JWT.
export function createAccountStatusGuard(findPerson) {
  return async function accountStatusGuard(req, res, next) {
    try {
      const person = await findPerson(req.authUser?.email);
      if (person?.status === "inactive") {
        return res.status(403).json({
          code: "ACCOUNT_INACTIVE",
          message: "Tài khoản đã nghỉ. Vui lòng liên hệ quản trị viên đang hoạt động để kích hoạt lại."
        });
      }
      req.authPerson = person;
      next();
    } catch {
      res.status(503).json({ message: "Không thể kiểm tra trạng thái tài khoản. Vui lòng thử lại." });
    }
  };
}
