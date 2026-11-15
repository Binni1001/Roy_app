import type { Arena, ArenaPlayer, MatchSide, MatchType, SetScore } from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { ActionError } from "./actions.ts";
import { loadArena, type ArenaStore } from "./arena.ts";
import { NotFoundError } from "./extras.ts";
import type { Member } from "./member.ts";
import { ValidationError } from "./profile.ts";

export interface NewMatch {
  type: MatchType;
  challengerId: string;
  challengerPartnerId: string | null;
  opponentId: string;
  opponentPartnerId: string | null;
  sets: number;
  /** Ngày thi đấu, YYYY-MM-DD theo giờ Việt Nam. */
  playDate: string;
  note: string | null;
}

export interface StoredMatch {
  id: string;
  periodId: string;
  groupId: string | null;
  status: string;
  sets: number;
  playDate: string;
  challengerIds: string[];
  opponentIds: string[];
}

export interface MatchStore {
  /** Thành viên đang hoạt động của nhóm, có thể được mời vào kèo. */
  listGroupPlayers(groupId: string): Promise<ArenaPlayer[]>;
  getMatch(id: string): Promise<StoredMatch | null>;
  insertMatch(periodId: string, match: NewMatch): Promise<void>;
  /** Đổi trạng thái chỉ khi trận còn ở một trong các trạng thái cho phép; trả false nếu đã đổi. */
  setMatchStatus(id: string, status: "active" | "cancelled", from: string[]): Promise<boolean>;
  /** Gọi RPC finalize_pk_match: khóa kết quả và tính xếp hạng trong một giao dịch. */
  finalizeMatch(id: string, winnerSide: MatchSide, setScores: SetScore[], actorEmail: string): Promise<void>;
}

/** Ngày hôm nay theo giờ Việt Nam, dạng YYYY-MM-DD. */
export function todayInVietnam(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now);
}

const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0;

export function parseNewMatch(body: unknown, meId: string, allowed: Set<string>, today: string): NewMatch {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("Dữ liệu gửi lên không hợp lệ.");
  }
  const raw = body as Record<string, unknown>;
  const type = raw.type;
  if (type !== "singles" && type !== "doubles") throw new ValidationError("Chọn đánh đơn hoặc đánh đôi.");

  const sets = Number(raw.sets);
  if (![1, 3, 5].includes(sets)) throw new ValidationError("Số ván phải là 1, 3 hoặc 5.");

  const playDate = raw.playDate;
  if (typeof playDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(playDate) || Number.isNaN(Date.parse(playDate))) {
    throw new ValidationError("Chọn ngày thi đấu.");
  }
  if (playDate < today) throw new ValidationError("Ngày thi đấu không được nằm trong quá khứ.");

  if (!isId(raw.opponentId)) throw new ValidationError("Chọn đối thủ.");
  // Như bản cũ: thành viên tạo kèo được cho bất kỳ ai trong câu lạc bộ, không bắt buộc có mình.
  const challengerId = isId(raw.challengerId) ? raw.challengerId : meId;
  const doubles = type === "doubles";
  if (doubles && (!isId(raw.partnerId) || !isId(raw.opponentPartnerId))) {
    throw new ValidationError("Trận đôi cần đủ bốn người chơi.");
  }
  const match: NewMatch = {
    type,
    challengerId,
    challengerPartnerId: doubles ? (raw.partnerId as string) : null,
    opponentId: raw.opponentId,
    opponentPartnerId: doubles ? (raw.opponentPartnerId as string) : null,
    sets,
    playDate,
    note: typeof raw.note === "string" && raw.note.trim() ? raw.note.trim().slice(0, 200) : null,
  };

  const ids = [match.challengerId, match.challengerPartnerId, match.opponentId, match.opponentPartnerId].filter(isId);
  if (new Set(ids).size !== ids.length) {
    throw new ValidationError("Một người không thể xuất hiện hai lần trong cùng trận.");
  }
  // Chỉ mời được thành viên đang hoạt động của chính nhóm mình.
  if (ids.some((id) => !allowed.has(id))) {
    throw new ValidationError("Có người chơi không thuộc câu lạc bộ hoặc đã nghỉ.");
  }
  return match;
}

export function parseResult(body: unknown, maxSets: number): { winnerSide: MatchSide; setScores: SetScore[] } {
  const raw = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const scores = raw.setScores;
  if (!Array.isArray(scores) || scores.length === 0 || scores.length > maxSets) {
    throw new ValidationError(`Nhập tỷ số từ 1 đến ${maxSets} ván.`);
  }
  const setScores: SetScore[] = scores.map((item) => {
    const s = (item ?? {}) as Record<string, unknown>;
    const challenger = Number(s.challenger);
    const opponent = Number(s.opponent);
    const valid = (n: number) => Number.isSafeInteger(n) && n >= 0 && n <= 99;
    if (!valid(challenger) || !valid(opponent) || challenger === opponent) {
      throw new ValidationError("Mỗi ván phải có một bên thắng, điểm là số nguyên không âm.");
    }
    return { challenger, opponent };
  });
  const challengerWins = setScores.filter((s) => s.challenger > s.opponent).length;
  const opponentWins = setScores.length - challengerWins;
  if (challengerWins === opponentWins) throw new ValidationError("Tỷ số các ván chưa phân định bên thắng.");
  const winnerSide: MatchSide = challengerWins > opponentWins ? "challenger" : "opponent";
  if (raw.winnerSide !== undefined && raw.winnerSide !== winnerSide) {
    throw new ValidationError("Bên thắng không khớp với tỷ số các ván.");
  }
  return { winnerSide, setScores };
}

type Stores = MatchStore & ArenaStore;

export async function createMatch(member: Member, body: unknown, store: Stores): Promise<Arena> {
  const period = await store.findOpenPeriod(member.groupId);
  if (!period) throw new ActionError("Chưa có kỳ đang mở để tạo kèo.", 409, "NO_OPEN_PERIOD");
  const players = await store.listGroupPlayers(member.groupId);
  const allowed = new Set(players.map((player) => player.id));
  await store.insertMatch(period.id, parseNewMatch(body, member.personId, allowed, todayInVietnam()));
  return loadArena(member, store);
}

async function ownMatch(member: Member, id: string, store: MatchStore): Promise<StoredMatch & { side: MatchSide }> {
  const match = await store.getMatch(id);
  const side: MatchSide | null = match?.challengerIds.includes(member.personId)
    ? "challenger"
    : match?.opponentIds.includes(member.personId)
      ? "opponent"
      : null;
  // Trận của nhóm khác, hoặc trận mình không tham gia, được báo là không tồn tại.
  if (!match || match.groupId !== member.groupId || !side) throw new NotFoundError();
  return { ...match, side };
}

export async function changeMatch(
  user: AuthUser,
  member: Member,
  id: string,
  action: "accept" | "cancel" | "result",
  body: unknown,
  store: Stores,
): Promise<Arena> {
  const match = await ownMatch(member, id, store);
  const stale = () => new ActionError("Trận vừa thay đổi. Tải lại rồi thử lại.", 409, "MATCH_CHANGED");

  // Như bản cũ: bất kỳ ai trong trận cũng nhận, hủy hoặc ghi tỷ số được.
  if (action === "accept") {
    if (!(await store.setMatchStatus(id, "active", ["pending"]))) throw stale();
  } else if (action === "cancel") {
    if (!(await store.setMatchStatus(id, "cancelled", ["pending", "active"]))) throw stale();
  } else {
    if (match.status !== "pending" && match.status !== "active") throw stale();
    if (match.playDate > todayInVietnam()) {
      throw new ActionError("Chưa đến ngày thi đấu nên chưa ghi tỷ số được.", 409, "TOO_EARLY");
    }
    const { winnerSide, setScores } = parseResult(body, match.sets);
    await store.finalizeMatch(id, winnerSide, setScores, user.email);
  }
  return loadArena(member, store);
}
