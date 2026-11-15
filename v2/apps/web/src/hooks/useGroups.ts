import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Bootstrap, InviteCheck, JoinGroupInput } from "@roy/shared";
import { apiPost, apiPut } from "../lib/api";

/** Kiểm tra mã mời trước, để người dùng thấy tên nhóm rồi mới gửi yêu cầu. */
export function useCheckInvite() {
  return useMutation({
    mutationFn: (code: string) => apiPost<InviteCheck>("/onboarding/check-invite", { code }),
  });
}

/** Gửi yêu cầu vào nhóm; máy chủ trả lại bootstrap mới để màn hình đổi ngay. */
export function useJoinGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: JoinGroupInput) => apiPost<Bootstrap>("/onboarding/join", input),
    onSuccess: (data) => client.setQueriesData({ queryKey: ["bootstrap"] }, data),
  });
}

/** Đổi nhóm đang xem. Mọi dữ liệu của nhóm cũ bị bỏ khỏi cache để không hiện nhầm. */
export function useSwitchGroup() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => apiPut<Bootstrap>("/me/active-group", { groupId }),
    onSuccess: (data) => {
      client.removeQueries({ queryKey: ["me"] });
      client.setQueriesData({ queryKey: ["bootstrap"] }, data);
    },
  });
}
