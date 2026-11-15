import { useQuery } from "@tanstack/react-query";
import type {
  Arena,
  Notifications,
  Schedule,
  TournamentDetail,
  TournamentSummary,
  Wallet,
} from "@roy/shared";
import { apiGet } from "../lib/api";

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
