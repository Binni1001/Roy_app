import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminPeriod, AdminSchedule, ExpenseInput, LoanInput, MoneyOverview, PeriodReport, ShuttleOverview, ManagedPerson, PeriodInput, PeriodMemberStatus, PeriodRoster, PersonInput, ShuttleDiscount } from "@roy/shared";
import { apiDelete, apiGet, apiPost, apiPut } from "../lib/api";

const PEOPLE = ["me", "admin", "people"] as const;

/** Người trong nhóm owner đang xem. Chỉ owner gọi (enabled). */
export function usePeople(enabled: boolean) {
  return useQuery({
    queryKey: PEOPLE,
    enabled,
    queryFn: ({ signal }) => apiGet<ManagedPerson[]>("/admin/people", signal),
  });
}

/** Mọi thao tác ghi trả về danh sách mới, đặt thẳng vào cache. */
function usePeopleMutation<T>(send: (input: T) => Promise<ManagedPerson[]>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      client.setQueryData(PEOPLE, data);
      // Tên và ảnh còn hiện ở đấu trường và danh sách mời kèo.
      void client.invalidateQueries({ queryKey: ["me", "arena"] });
    },
  });
}

export function useAddPerson() {
  return usePeopleMutation((input: PersonInput) => apiPost<ManagedPerson[]>("/admin/people", input));
}

export function useEditPerson() {
  return usePeopleMutation(({ id, input }: { id: string; input: PersonInput }) =>
    apiPut<ManagedPerson[]>("/admin/people/" + encodeURIComponent(id), input),
  );
}

export function usePersonStatus() {
  return usePeopleMutation(({ id, status }: { id: string; status: "active" | "inactive" }) =>
    apiPut<ManagedPerson[]>("/admin/people/" + encodeURIComponent(id) + "/status", { status }),
  );
}

const PERIODS = ["me", "admin", "periods"] as const;
const roster = (id: string) => ["me", "admin", "periods", id, "roster"] as const;

export function usePeriods(enabled: boolean) {
  return useQuery({
    queryKey: PERIODS,
    enabled,
    queryFn: ({ signal }) => apiGet<AdminPeriod[]>("/admin/periods", signal),
  });
}

/** Ghi kỳ xong: đặt danh sách mới vào cache; kỳ đang mở còn ảnh hưởng mọi màn hình thành viên. */
function usePeriodMutation<T>(send: (input: T) => Promise<AdminPeriod[]>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      client.setQueryData(PERIODS, data);
      void client.invalidateQueries({ queryKey: ["bootstrap"] });
    },
  });
}

export function useCreatePeriod() {
  return usePeriodMutation((input: PeriodInput) => apiPost<AdminPeriod[]>("/admin/periods", input));
}

export function useEditPeriod() {
  return usePeriodMutation(({ id, input }: { id: string; input: PeriodInput }) =>
    apiPut<AdminPeriod[]>("/admin/periods/" + encodeURIComponent(id), input),
  );
}

export function useOpenPeriod() {
  return usePeriodMutation((id: string) => apiPost<AdminPeriod[]>("/admin/periods/" + encodeURIComponent(id) + "/open"));
}

export function useRoster(id: string | null) {
  return useQuery({
    queryKey: roster(id ?? ""),
    enabled: Boolean(id),
    queryFn: ({ signal }) => apiGet<PeriodRoster>("/admin/periods/" + encodeURIComponent(id ?? "") + "/roster", signal),
  });
}

function useRosterMutation<T>(periodId: string, send: (input: T) => Promise<PeriodRoster>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      client.setQueryData(roster(periodId), data);
      // Số người trong kỳ và công nợ của thành viên đã đổi.
      void client.invalidateQueries({ queryKey: PERIODS, exact: true });
      void client.invalidateQueries({ queryKey: ["me", "wallet"] });
    },
    onError: () => void client.invalidateQueries({ queryKey: roster(periodId) }),
  });
}

export function useAddPeriodMembers(periodId: string) {
  return useRosterMutation(periodId, (personIds: string[]) =>
    apiPost<PeriodRoster>("/admin/periods/" + encodeURIComponent(periodId) + "/members", { personIds }),
  );
}

export function useChangePeriodMember(periodId: string) {
  return useRosterMutation(
    periodId,
    ({ id, status, discountPercent }: { id: string; status: PeriodMemberStatus; discountPercent: ShuttleDiscount }) =>
      apiPut<PeriodRoster>("/admin/period-members/" + encodeURIComponent(id), { status, discountPercent }),
  );
}

const SCHEDULE = ["me", "admin", "schedule"] as const;

export function useAdminSchedule(enabled: boolean) {
  return useQuery({
    queryKey: SCHEDULE,
    enabled,
    queryFn: ({ signal }) => apiGet<AdminSchedule>("/admin/schedule", signal),
  });
}

/** Mọi thao tác lịch và điểm danh trả lại cả màn hình; phí khách còn hiện ở Ví và Lịch của thành viên. */
function useScheduleMutation<T>(send: (input: T) => Promise<AdminSchedule>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      client.setQueryData(SCHEDULE, data);
      void client.invalidateQueries({ queryKey: ["me", "wallet"] });
      void client.invalidateQueries({ queryKey: ["me", "schedule"] });
    },
    onError: () => void client.invalidateQueries({ queryKey: SCHEDULE }),
  });
}

export function useDayAction() {
  return useScheduleMutation(({ date, action }: { date: string; action: "open" | "close" | "reopen" }) =>
    apiPost<AdminSchedule>("/admin/schedule/days", { date, action }),
  );
}

export interface SessionForm {
  date: string;
  shuttles: number;
  note: string | null;
}

export function useAddSession() {
  return useScheduleMutation((input: SessionForm) => apiPost<AdminSchedule>("/admin/sessions", input));
}

export function useEditSession() {
  return useScheduleMutation(({ id, input }: { id: string; input: SessionForm }) =>
    apiPut<AdminSchedule>("/admin/sessions/" + encodeURIComponent(id), input),
  );
}

export function useDeleteSession() {
  return useScheduleMutation((id: string) => apiDelete<AdminSchedule>("/admin/sessions/" + encodeURIComponent(id)));
}

export function useAddGuest() {
  return useScheduleMutation(
    ({ sessionId, personId, amount, note }: { sessionId: string; personId: string; amount: number; note: string | null }) =>
      apiPost<AdminSchedule>("/admin/sessions/" + encodeURIComponent(sessionId) + "/guests", { personId, amount, note }),
  );
}

export function useEditGuest() {
  return useScheduleMutation(({ id, amount, note }: { id: string; amount: number; note: string | null }) =>
    apiPut<AdminSchedule>("/admin/guests/" + encodeURIComponent(id), { amount, note }),
  );
}

export function useRemoveGuest() {
  return useScheduleMutation((id: string) => apiDelete<AdminSchedule>("/admin/guests/" + encodeURIComponent(id)));
}

const SHUTTLES = ["me", "admin", "shuttles"] as const;

export function useShuttles(enabled: boolean) {
  return useQuery({
    queryKey: SHUTTLES,
    enabled,
    queryFn: ({ signal }) => apiGet<ShuttleOverview>("/admin/shuttles", signal),
  });
}

/** Thao tác tiền cầu đổi công nợ, số dư, quỹ và có thể cả kỳ đang mở: làm mới các màn hình liên quan. */
function useShuttleMutation<T>(send: (input: T) => Promise<ShuttleOverview>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      client.setQueryData(SHUTTLES, data);
      void client.invalidateQueries({ queryKey: ["me", "wallet"] });
      void client.invalidateQueries({ queryKey: PERIODS, exact: true });
      if (!data.period) void client.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: () => void client.invalidateQueries({ queryKey: SHUTTLES }),
  });
}

export function useAddExpense() {
  return useShuttleMutation((input: ExpenseInput) => apiPost<ShuttleOverview>("/admin/shuttles/expenses", input));
}

export function useDeleteExpense() {
  return useShuttleMutation((id: string) => apiDelete<ShuttleOverview>("/admin/shuttles/expenses/" + encodeURIComponent(id)));
}

export function useAddLoan() {
  return useShuttleMutation((input: LoanInput) => apiPost<ShuttleOverview>("/admin/shuttles/loans", input));
}

export function useLoanAction() {
  return useShuttleMutation(({ id, action }: { id: string; action: "repay" | "cancel" }) =>
    apiPost<ShuttleOverview>("/admin/shuttles/loans/" + encodeURIComponent(id) + "/" + action),
  );
}

export function useApplyFund() {
  return useShuttleMutation((input: { buyerId: string; amount: number }) => apiPost<ShuttleOverview>("/admin/shuttles/fund", input));
}

export function useSettle() {
  return useShuttleMutation(() => apiPost<ShuttleOverview>("/admin/shuttles/settle"));
}

export function useClosePeriod() {
  return useShuttleMutation(() => apiPost<ShuttleOverview>("/admin/shuttles/close"));
}

const MONEY = ["me", "admin", "money"] as const;

export function useMoney(enabled: boolean) {
  return useQuery({
    queryKey: MONEY,
    enabled,
    queryFn: ({ signal }) => apiGet<MoneyOverview>("/admin/money", signal),
  });
}

/** Thu, chi, hủy nợ đổi ví thành viên, quỹ và màn hình tiền cầu: làm mới cả ba. */
function useMoneyMutation<T>(send: (input: T) => Promise<MoneyOverview>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: (data) => {
      client.setQueryData(MONEY, data);
      void client.invalidateQueries({ queryKey: ["me", "wallet"] });
      void client.invalidateQueries({ queryKey: SHUTTLES });
    },
    onError: () => void client.invalidateQueries({ queryKey: MONEY }),
  });
}

export function useCollect() {
  return useMoneyMutation((input: { personId: string; debtIds: string[]; amount: number; note: string | null }) =>
    apiPost<MoneyOverview>("/admin/money/collect", input),
  );
}

export function useAddDebt() {
  return useMoneyMutation((input: { personId: string; amount: number; description: string }) => apiPost<MoneyOverview>("/admin/money/debts", input));
}

export function useCancelDebt() {
  return useMoneyMutation((id: string) => apiPost<MoneyOverview>("/admin/money/debts/" + encodeURIComponent(id) + "/cancel"));
}

export function useRemind() {
  return useMoneyMutation((personId: string) => apiPost<MoneyOverview>("/admin/money/remind/" + encodeURIComponent(personId)));
}

export function useFundEntry() {
  return useMoneyMutation((input: { type: "income" | "expense" | "refund"; personId: string | null; amount: number; description: string | null }) =>
    apiPost<MoneyOverview>("/admin/money/fund", input),
  );
}

export function useReport(periodId: string) {
  return useQuery({
    queryKey: ["me", "admin", "report", periodId],
    queryFn: ({ signal }) => apiGet<PeriodReport>("/admin/periods/" + encodeURIComponent(periodId) + "/report", signal),
  });
}
