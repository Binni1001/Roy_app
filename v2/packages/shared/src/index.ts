// Kiểu dữ liệu dùng chung giữa API và web. Chỉ chứa kiểu, không chứa logic.

export type MemberRole = "owner" | "admin" | "member";
export type MembershipStatus = "pending" | "active" | "inactive";
export type PeriodStatus = "draft" | "open" | "closed";

export interface Membership {
  groupId: string;
  groupName: string;
  role: MemberRole;
  status: MembershipStatus;
}

export interface Me {
  id: string;
  fullName: string;
  nickname: string | null;
  avatarUrl: string | null;
  activeGroupId: string | null;
}

export interface PeriodSummary {
  id: string;
  name: string;
  status: PeriodStatus;
  startDate: string;
  endDate: string;
}

/** Mọi thứ app cần để vẽ màn hình đầu tiên, trả về trong một lần gọi. */
export interface Bootstrap {
  /** null khi tài khoản đã đăng nhập nhưng chưa có hồ sơ người chơi. */
  me: Me | null;
  memberships: Membership[];
  /** Kỳ đang mở của nhóm đang chọn, nếu có. */
  openPeriod: PeriodSummary | null;
}

export interface ApiError {
  code: string;
  message: string;
}
