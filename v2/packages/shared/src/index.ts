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

export type DebtType = "monthly_fee" | "guest_fee" | "shuttle_extra" | "other";
export type DebtStatus = "unpaid" | "paid" | "cancelled";

export interface Debt {
  id: string;
  type: DebtType;
  status: DebtStatus;
  amount: number;
  description: string | null;
  periodName: string;
  createdAt: string;
  paidAt: string | null;
}

export interface BalanceTransaction {
  id: string;
  type: string;
  /** plus = cộng vào số dư, minus = trừ khỏi số dư. */
  direction: "plus" | "minus";
  amount: number;
  description: string | null;
  createdAt: string;
}

export interface ShuttleLoan {
  id: string;
  quantity: number;
  amount: number;
  borrowedAt: string;
  periodName: string;
}

/** Mọi thứ về tiền của một thành viên trong nhóm đang chọn. */
export interface Wallet {
  balance: number;
  unpaidTotal: number;
  unpaidDebts: Debt[];
  settledDebts: Debt[];
  transactions: BalanceTransaction[];
  /** Tiền mượn cầu chưa nộp quỹ; không nằm trong unpaidTotal. */
  openLoans: ShuttleLoan[];
}

export interface OpenDay {
  id: string;
  date: string;
  status: string;
  capacity: number;
  registered: number;
  mine: boolean;
}

export interface PlayedSession {
  id: string;
  date: string;
  note: string | null;
}

export interface Schedule {
  period: PeriodSummary | null;
  openDays: OpenDay[];
  playedSessions: PlayedSession[];
}
