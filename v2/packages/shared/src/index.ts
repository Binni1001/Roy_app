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

export type MatchType = "singles" | "doubles";
export type MatchSide = "challenger" | "opponent";
export type Tier = "champion" | "diamond" | "platinum" | "gold" | "silver" | "bronze";

export interface ArenaPlayer {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface SetScore {
  challenger: number;
  opponent: number;
}

export interface ArenaMatch {
  id: string;
  type: MatchType;
  /** pending | active | completed | cancelled */
  status: string;
  playedAt: string;
  sets: number;
  challengers: ArenaPlayer[];
  opponents: ArenaPlayer[];
  winnerSide: MatchSide | null;
  setScores: SetScore[] | null;
  voided: boolean;
}

export interface LeaderboardRow extends ArenaPlayer {
  rank: number;
  /** true khi có người khác cùng hạng. */
  tied: boolean;
  tier: Tier;
  points: number;
  wins: number;
  losses: number;
  matches: number;
  scoreDifference: number;
}

export interface Arena {
  period: PeriodSummary | null;
  /** false khi kỳ đang mở không dùng luật thắng +3, thua -2. */
  supported: boolean;
  singles: LeaderboardRow[];
  doubles: LeaderboardRow[];
  /** Kèo có tôi tham gia, mới nhất trước. */
  myMatches: ArenaMatch[];
  /** Mọi kèo chưa hủy trong kỳ, mới nhất trước, tối đa 60 kèo. */
  periodMatches: ArenaMatch[];
  meId: string;
}

export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

export interface Notifications {
  unread: number;
  items: NotificationItem[];
}

export interface TournamentSummary {
  id: string;
  name: string;
  /** group_stage | knockout | completed | cancelled */
  status: string;
  startDate: string | null;
  endDate: string | null;
  championName: string | null;
}

export interface TournamentTeam {
  id: string;
  name: string;
  seed: number | null;
  players: string[];
}

export interface StandingRow {
  team: TournamentTeam;
  rank: number;
  qualified: boolean;
  played: number;
  wins: number;
  losses: number;
  points: number;
  setDifference: number;
  pointDifference: number;
}

export interface TournamentSetScore {
  team1: number;
  team2: number;
}

export interface TournamentMatch {
  id: string;
  /** group | quarterfinal | semifinal | third_place | final */
  stage: string;
  groupId: string | null;
  bracketKey: string | null;
  matchNumber: number | null;
  /** pending | completed | bye */
  status: string;
  team1: TournamentTeam | null;
  team2: TournamentTeam | null;
  /** Mô tả nguồn đội khi chưa xác định, ví dụ nhất bảng A. */
  team1Source: string | null;
  team2Source: string | null;
  team1Sets: number | null;
  team2Sets: number | null;
  setScores: TournamentSetScore[] | null;
  winnerTeamId: string | null;
}

export interface TournamentGroup {
  id: string;
  name: string;
  standings: StandingRow[];
  matches: TournamentMatch[];
}

export interface TournamentDetail extends TournamentSummary {
  groups: TournamentGroup[];
  knockout: TournamentMatch[];
}

export interface ArenaHistoryRow extends ArenaPlayer {
  rank: number;
  /** Giá trị đã lưu khi đóng kỳ; ý nghĩa tùy luật của kỳ (điểm +3/−2, Elo, Wilson). */
  points: number;
  wins: number;
  losses: number;
  matches: number;
}

export interface ArenaHistoryPeriod {
  periodId: string;
  periodName: string;
  startDate: string;
  /** fixed_3_2_v1 | elo_v1 | legacy_wilson_v1 */
  scoringRule: string;
  singles: ArenaHistoryRow[];
  doubles: ArenaHistoryRow[];
}

/** Phần hồ sơ thành viên tự sửa được. */
export interface ProfileInput {
  fullName: string;
  nickname: string | null;
  phone: string | null;
  bio: string | null;
}

export interface Profile extends ProfileInput {
  email: string | null;
  avatarUrl: string | null;
}

/** Kết quả kiểm tra mã mời: chỉ trả tên nhóm, không lộ thông tin khác. */
export interface InviteCheck {
  groupName: string;
}

/** Gửi khi tham gia nhóm bằng mã mời. fullName chỉ cần khi tài khoản chưa có hồ sơ. */
export interface JoinGroupInput {
  code: string;
  fullName?: string;
}
