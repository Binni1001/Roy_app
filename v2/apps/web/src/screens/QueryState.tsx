import type { ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

/** Khung chờ và báo lỗi dùng chung cho mọi màn hình đọc dữ liệu. */
export function QueryState<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) {
    return (
      <div className="skeleton-list" role="status" aria-label="Đang tải">
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <section className="card" role="alert">
        <h2>Không tải được dữ liệu</h2>
        <p className="muted">{query.error.message}</p>
        <button className="btn btn-ghost" onClick={() => void query.refetch()}>
          Thử lại
        </button>
      </section>
    );
  }
  return <>{children(query.data)}</>;
}
