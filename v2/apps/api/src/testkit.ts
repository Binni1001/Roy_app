// Bộ dựng dùng chung cho các file test của API: token giả, dữ liệu mẫu, app với store giả.
import { SignJWT } from "jose";
import type { Debt } from "@roy/shared";
import { createApp } from "./app.ts";
import { createTokenVerifier } from "./auth.ts";
import type { PersonRow } from "./routes/bootstrap.ts";
import type { ActionsStore } from "./routes/actions.ts";
import type { ArenaStore } from "./routes/arena.ts";
import type { ArenaHistoryStore } from "./routes/arenaHistory.ts";
import type { ExtrasStore, TournamentData } from "./routes/extras.ts";
import type { MatchStore, StoredMatch } from "./routes/matches.ts";
import type { MemberStore } from "./routes/member.ts";
import type { ProfileStore } from "./routes/profile.ts";
import type { OnboardingStore } from "./routes/onboarding.ts";
import type { AvatarStore } from "./routes/avatar.ts";
import type { AvailabilityStore } from "./routes/availability.ts";
import type { ApprovalStore } from "./routes/approvals.ts";
import type { PeopleStore } from "./routes/people.ts";
import type { PeriodsStore } from "./routes/periods.ts";
import type { AdminScheduleStore } from "./routes/adminSchedule.ts";

export const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_JWT_SECRET: "test-secret-test-secret-test-secret",
};
export const secret = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);

export function token(claims: Record<string, unknown>, key = secret) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("user-1")
    .setIssuer("https://example.supabase.co/auth/v1")
    .setAudience("authenticated")
    .setExpirationTime("5m")
    .sign(key);
}

export async function bearer(email = "a@b.c") {
  return { Authorization: `Bearer ${await token({ email })}` };
}

export const person: PersonRow = {
  id: "p1",
  full_name: "Minh",
  nickname: null,
  avatar_url: null,
  status: "active",
  active_group_id: "g2",
  person_groups: [
    { group_id: "g1", status: "active", member_role: "member", groups: { id: "g1", name: "Roy" } },
    { group_id: "g2", status: "pending", member_role: "member", groups: { id: "g2", name: "Khac" } },
  ],
};

export const debt = (id: string, status: Debt["status"], amount: number): Debt => ({
  id,
  status,
  amount,
  type: "monthly_fee",
  description: null,
  periodName: "Mua 6",
  createdAt: "2026-11-10",
  paidAt: null,
});

export const adminPeriod = (status: "draft" | "open" | "closed", settled = false) => ({
  id: "k1",
  name: "Mua 7",
  status,
  startDate: "2026-12-10",
  endDate: "2027-01-09",
  fixedMemberFee: 150000,
  guestFeePerSession: 30000,
  note: null,
  settled,
  memberCount: 0,
});

export const stored = (over: Partial<StoredMatch> = {}): StoredMatch => ({
  id: "m1",
  periodId: "k1",
  groupId: "g1",
  status: "pending",
  sets: 3,
  playDate: "2020-01-01",
  challengerIds: ["x"],
  opponentIds: ["p1"],
  ...over,
});

export type Store = MemberStore &
  ArenaStore &
  ArenaHistoryStore &
  ExtrasStore &
  ActionsStore &
  ProfileStore &
  MatchStore &
  OnboardingStore &
  AvatarStore &
  AvailabilityStore &
  ApprovalStore &
  PeopleStore &
  PeriodsStore &
  AdminScheduleStore;

export const tournament = (groupId: string, status = "completed"): TournamentData => ({
  summary: { id: "t1", name: "Giai doi", status, startDate: null, endDate: null, championName: null },
  groupId,
  qualifiersPerGroup: 2,
  teams: [],
  groups: [],
  matches: [],
});

export function setup(store: Partial<Store> = {}) {
  const periodCalls: string[] = [];
  const full: Store = {
    getProfile: async () => ({ fullName: "Minh", nickname: null, phone: null, bio: null, email: "a@b.c", avatarUrl: null }),
    updateProfile: async (_id, input) => ({ ...input, email: "a@b.c", avatarUrl: null }),
    listGroupPlayers: async () => [{ id: "p1", name: "Minh", avatarUrl: null }, { id: "x", name: "X", avatarUrl: null }],
    getMatch: async () => stored(),
    insertMatch: async () => {},
    setMatchStatus: async () => true,
    finalizeMatch: async () => {},
    markNotificationsRead: async () => {},
    deleteNotifications: async () => {},
    findGroupByCode: async (code) => (code === "ROYCLUB" ? { id: "g3", name: "Roy moi" } : null),
    createPendingPerson: async () => {},
    requestMembership: async () => {},
    setActiveGroup: async () => {},
    uploadAvatar: async (id, _bytes, type) => `https://cdn/avatars/${id}.${type.split("/")[1]}`,
    setAvatarUrl: async () => {},
    isFixedMember: async () => true,
    getPreferences: async () => ({ busyWeekdays: [3], dateOverrides: { "2026-11-14": "available" }, revision: 2 }),
    listOpenDayDates: async () => ["2026-11-11"],
    savePreferences: async () => {},
    listPendingMembers: async () => [],
    getMembershipStatus: async () => "pending",
    decideMembership: async () => true,
    listGroupPeople: async () => [],
    findPersonIdByEmail: async () => null,
    createMember: async () => {},
    updatePerson: async () => {},
    setMemberStatus: async () => {},
    listPeriods: async () => [],
    getPeriod: async (id) => (id === "k1" || id === "kd" ? { ...adminPeriod(id === "kd" ? "draft" : "open"), id, groupId: "g1" } : id === "kx" ? { ...adminPeriod("open"), id, groupId: "other" } : null),
    createPeriod: async () => {},
    updatePeriod: async () => {},
    setPeriodStatus: async () => {},
    getRoster: async (period) => ({ period, members: [], candidates: [] }),
    addPeriodMembers: async (_id, ids) => ({ added: ids.length, skipped: 0, feesCreated: 1 }),
    getPeriodMemberPeriodId: async (id) => (id === "m-other" ? "kx" : id === "m1" ? "k1" : null),
    updatePeriodMember: async () => "fee_cancelled",
    loadAdminSchedule: async () => ({ guestFee: 30000, settled: false, openDays: [], sessions: [], people: [] }),
    mutateDay: async () => {},
    getSessionPeriodId: async (id) => (id === "s1" ? "k1" : id === "s-old" ? "k0" : null),
    createSession: async () => {},
    updateSession: async () => {},
    deleteSession: async () => true,
    getGuestSessionId: async (id) => (id === "a1" ? "s1" : id === "a-old" ? "s-old" : null),
    getGuestFee: async () => 30000,
    addGuest: async (_s, _p, amount) => amount > 0,
    updateGuest: async () => true,
    removeGuest: async () => true,
    findOpenDay: async () => ({ periodId: "k1", date: "2026-11-20", groupId: "g1" }),
    mutateOpenDay: async () => {},
    listLeaderboardSnapshots: async () => [],
    listNotifications: async () => [],
    countUnreadNotifications: async () => 4,
    listTournaments: async () => [],
    getTournament: async () => tournament("g1"),
    getScoringRule: async () => "fixed_3_2_v1",
    listPeriodMatches: async () => [],
    findPerson: async () => person,
    findOpenPeriod: async (groupId) => {
      periodCalls.push(groupId);
      return { id: "k1", name: "Mua 6", status: "open", startDate: "2026-11-10", endDate: "2026-12-09" };
    },
    listDebts: async () => [
      debt("d1", "unpaid", 150000),
      debt("d2", "paid", 90000),
      debt("d3", "unpaid", 35000),
      debt("d4", "cancelled", 500),
    ],
    getBalance: async () => 20000,
    listTransactions: async () => [],
    listOpenLoans: async () => [],
    listOpenDays: async () => [],
    listPlayedSessions: async () => [],
    ...store,
  };
  const app = createApp({
    verify: createTokenVerifier(env),
    store: full,
    corsOrigins: ["http://localhost:5174"],
  });
  const get = (headers: Record<string, string> = {}, path = "/bootstrap") =>
    app.request(path, { headers });
  const post = (headers: Record<string, string>, path: string, body?: unknown) =>
    app.request(path, {
      method: "POST",
      headers: body === undefined ? headers : { ...headers, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const put = (headers: Record<string, string>, path: string, body: unknown) =>
    app.request(path, {
      method: "PUT",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  const del = (headers: Record<string, string>, path: string) => app.request(path, { method: "DELETE", headers });
  const upload = (headers: Record<string, string>, path: string, bytes: Uint8Array, type = "image/webp") =>
    app.request(path, { method: "POST", headers: { ...headers, "Content-Type": type }, body: new Blob([bytes as BlobPart]) });
  return { get, post, put, del, upload, periodCalls };
}

