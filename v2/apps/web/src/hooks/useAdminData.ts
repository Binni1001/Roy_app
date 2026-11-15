import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ManagedPerson, PersonInput } from "@roy/shared";
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
