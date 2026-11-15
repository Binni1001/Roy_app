import type {
  BalanceTransaction,
  Debt,
  OpenDay,
  PeriodSummary,
  PlayedSession,
  Schedule,
  ShuttleLoan,
  Wallet,
} from "@roy/shared";
import type { AuthUser } from "../auth.ts";
import { AccountInactiveError, pickActiveGroup, type BootstrapStore } from "./bootstrap.ts";

export interface MemberStore extends BootstrapStore {
  /** Công nợ của một người trong một nhóm, mới nhất trước. */
  listDebts(personId: string, groupId: string): Promise<Debt[]>;
  getBalance(personId: string): Promise<number>;
  listTransactions(personId: string, limit: number): Promise<BalanceTransaction[]>;
  listOpenLoans(personId: string, groupId: string): Promise<ShuttleLoan[]>;
  listOpenDays(periodId: string, personId: string): Promise<OpenDay[]>;
  listPlayedSessions(periodId: string): Promise<PlayedSession[]>;
}

export class NoProfileError extends Error {}
export class NoGroupError extends Error {}

export interface Member {
  personId: string;
  groupId: string;
}

/** Một lượt tra cho mỗi yêu cầu: người gọi là ai và đang xem nhóm nào. */
export async function resolveMember(user: AuthUser, store: BootstrapStore): Promise<Member> {
  const person = await store.findPerson(user.email);
  if (!person) throw new NoProfileError();
  if (person.status === "inactive") throw new AccountInactiveError();
  const groupId = pickActiveGroup(
    person.active_group_id,
    person.person_groups.map((row) => ({
      groupId: row.group_id,
      groupName: row.groups?.name ?? "",
      role: row.member_role,
      status: row.status,
    })),
  );
  if (!groupId) throw new NoGroupError();
  return { personId: person.id, groupId };
}

export async function loadWallet(member: Member, store: MemberStore): Promise<Wallet> {
  const [debts, balance, transactions, openLoans] = await Promise.all([
    store.listDebts(member.personId, member.groupId),
    store.getBalance(member.personId),
    store.listTransactions(member.personId, 30),
    store.listOpenLoans(member.personId, member.groupId),
  ]);
  const unpaidDebts = debts.filter((debt) => debt.status === "unpaid");
  return {
    balance,
    unpaidTotal: unpaidDebts.reduce((sum, debt) => sum + debt.amount, 0),
    unpaidDebts,
    settledDebts: debts.filter((debt) => debt.status === "paid"),
    transactions,
    openLoans,
  };
}

export async function loadSchedule(member: Member, store: MemberStore): Promise<Schedule> {
  const period: PeriodSummary | null = await store.findOpenPeriod(member.groupId);
  if (!period) return { period: null, openDays: [], playedSessions: [] };
  const [openDays, playedSessions] = await Promise.all([
    store.listOpenDays(period.id, member.personId),
    store.listPlayedSessions(period.id),
  ]);
  return { period, openDays, playedSessions };
}
