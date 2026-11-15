import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Arena,
  ArenaHistoryPeriod,
  ArenaPlayer,
  Notifications,
  Profile,
  ProfileInput,
  Schedule,
  TournamentDetail,
  TournamentSummary,
  Wallet,
} from "@roy/shared";
import { apiGet, apiPost, apiPut } from "../lib/api";

// Cùng một khóa cache cho mọi màn hình: trang chủ và màn hình chi tiết dùng chung một lần tải.

export function useWallet() {
  return useQuery({
    queryKey: ["me", "wallet"],
    queryFn: ({ signal }) => apiGet<Wallet>("/me/wallet", signal),
  });
}

export function useSchedule() {
  return useQuery({
    queryKey: ["me", "schedule"],
    queryFn: ({ signal }) => apiGet<Schedule>("/me/schedule", signal),
  });
}

export function useArena() {
  return useQuery({
    queryKey: ["me", "arena"],
    queryFn: ({ signal }) => apiGet<Arena>("/me/arena", signal),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: ["me", "notifications"],
    queryFn: ({ signal }) => apiGet<Notifications>("/me/notifications", signal),
  });
}

export function useTournaments() {
  return useQuery({
    queryKey: ["me", "tournaments"],
    queryFn: ({ signal }) => apiGet<TournamentSummary[]>("/me/tournaments", signal),
    staleTime: 5 * 60_000,
  });
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: ["me", "tournaments", id],
    queryFn: ({ signal }) =>
      apiGet<TournamentDetail>("/me/tournaments/" + encodeURIComponent(id), signal),
    staleTime: 5 * 60_000,
  });
}

/** Ghi xong thì đặt luôn kết quả máy chủ trả về vào cache, không phải tải lại. */
export function useMarkNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<Notifications>("/me/notifications/read"),
    onSuccess: (data) => client.setQueryData(["me", "notifications"], data),
  });
}

export function useOpenDayAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, action }: { dayId: string; action: "join" | "leave" }) =>
      apiPost<Schedule>("/me/open-days/" + encodeURIComponent(dayId) + "/" + action),
    onSuccess: (data) => client.setQueryData(["me", "schedule"], data),
    // Lỗi thường do dữ liệu đã đổi (đủ người, quá giờ): tải lại để màn hình khớp thực tế.
    onError: () => void client.invalidateQueries({ queryKey: ["me", "schedule"] }),
  });
}

export function useArenaHistory() {
  return useQuery({
    queryKey: ["me", "arena", "history"],
    queryFn: ({ signal }) => apiGet<ArenaHistoryPeriod[]>("/me/arena/history", signal),
    // Bảng của kỳ đã đóng không đổi nữa.
    staleTime: 60 * 60_000,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["me", "profile"],
    queryFn: ({ signal }) => apiGet<Profile>("/me/profile", signal),
  });
}

export function useSaveProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<keyof ProfileInput, string>) => apiPut<Profile>("/me/profile", input),
    onSuccess: (data) => {
      client.setQueryData(["me", "profile"], data);
      // Tên và biệt danh còn hiện ở trang chủ và bảng xếp hạng.
      void client.invalidateQueries({ queryKey: ["bootstrap"] });
      void client.invalidateQueries({ queryKey: ["me", "arena"] });
    },
  });
}

/** Danh sách người có thể mời vào kèo; chỉ tải khi mở form tạo kèo. */
export function useArenaPlayers(enabled: boolean) {
  return useQuery({
    queryKey: ["me", "arena", "players"],
    enabled,
    queryFn: ({ signal }) => apiGet<ArenaPlayer[]>("/me/arena/players", signal),
    staleTime: 10 * 60_000,
  });
}

export interface NewMatchInput {
  type: "singles" | "doubles";
  opponentId: string;
  partnerId: string;
  opponentPartnerId: string;
  sets: number;
  playDate: string;
}

export function useCreateMatch() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: NewMatchInput) => apiPost<Arena>("/me/matches", input),
    onSuccess: (data) => client.setQueryData(["me", "arena"], data),
  });
}

export function useMatchAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: "accept" | "cancel" | "result"; body?: unknown }) =>
      apiPost<Arena>("/me/matches/" + encodeURIComponent(id) + "/" + action, body),
    onSuccess: (data) => client.setQueryData(["me", "arena"], data),
    // Lỗi thường do trận đã đổi ở nơi khác: tải lại để màn hình khớp thực tế.
    onError: () => void client.invalidateQueries({ queryKey: ["me", "arena"] }),
  });
}
