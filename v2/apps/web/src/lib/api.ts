import type { ApiError } from "@roy/shared";
import { supabase } from "./supabase";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:5050";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  return request<T>("GET", path, signal);
}

export function apiPost<T>(path: string): Promise<T> {
  return request<T>("POST", path);
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>("PUT", path, undefined, body);
}

async function request<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  signal?: AbortSignal,
  body?: unknown,
): Promise<T> {
  // getSession đọc phiên từ bộ nhớ trình duyệt và tự làm mới token khi sắp hết hạn.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiRequestError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", 0, "NETWORK");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as Partial<ApiError> | null;
    throw new ApiRequestError(
      body?.message ?? "Máy chủ gặp lỗi. Thử lại sau.",
      response.status,
      body?.code ?? "UNKNOWN",
    );
  }
  return (await response.json()) as T;
}
