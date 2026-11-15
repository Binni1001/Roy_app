import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AdminPeriod, ManagedPerson, PeriodInput, PeriodMemberStatus, PeriodRoster, PersonInput, ShuttleDiscount } from "@roy/shared";
import { apiGet, apiPost, apiPut } from "../lib/api";

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
