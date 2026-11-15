import { useQuery } from "@tanstack/react-query";
import type { Bootstrap } from "@roy/shared";
import { apiGet, ApiRequestError } from "../lib/api";

/** Một lần gọi duy nhất cho mọi thứ màn hình đầu tiên cần. Các màn hình khác đọc lại từ cache. */
export function useBootstrap(userId: string | undefined) {
  return useQuery({
    queryKey: ["bootstrap", userId],
    enabled: Boolean(userId),
    queryFn: ({ signal }) => apiGet<Bootstrap>("/bootstrap", signal),
    staleTime: 60_000,
    retry: (count, error) =>
      count < 2 && !(error instanceof ApiRequestError && error.status >= 400 && error.status < 500),
  });
}
