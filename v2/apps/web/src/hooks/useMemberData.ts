import { useQuery } from "@tanstack/react-query";
import type { Arena, Schedule, Wallet } from "@roy/shared";
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
