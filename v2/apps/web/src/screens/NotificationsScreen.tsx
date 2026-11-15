import { X } from "lucide-react";
import { useDeleteNotifications, useMarkNotificationsRead, useNotifications } from "../hooks/useMemberData";
import { formatDate } from "../lib/format";
import { QueryState } from "./QueryState";

export function NotificationsScreen() {
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
  const remove = useDeleteNotifications();
  const failure = markRead.error ?? remove.error;

  function removeAll() {
    if (window.confirm("Xóa tất cả thông báo? Không khôi phục lại được.")) remove.mutate(undefined);
  }

  return (
    <>
      <h1 className="page-title">Thông báo</h1>
      <QueryState query={query}>
        {({ items, unread }) =>
          items.length ? (
            <section className="card rise">
              <div className="card-head">
                <p className="muted small">
                  {unread ? `${unread} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}
                </p>
                <div className="actions">
                  {unread > 0 && (
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={() => markRead.mutate()}
                      disabled={markRead.isPending}
                    >
                      {markRead.isPending ? "Đang lưu…" : "Đánh dấu đã đọc"}
                    </button>
                  )}
                  <button className="btn btn-dark btn-small" onClick={removeAll} disabled={remove.isPending}>
                    Xóa tất cả
                  </button>
                </div>
              </div>
              {failure && (
                <p className="error" role="alert">
                  {failure.message}
                </p>
              )}
              <ul className="rows">
                {items.map((item) => (
                  <li className={`row notice-row${item.read ? "" : " unread"}`} key={item.id}>
                    <div className="grow">
                      <div className="row-title">{item.title}</div>
                      {item.body && <div className="row-sub">{item.body}</div>}
                    </div>
                    <div className="row-sub row-end">{formatDate(item.createdAt)}</div>
                    <button
                      className="icon-btn"
                      aria-label={`Xóa thông báo ${item.title}`}
                      onClick={() => remove.mutate(item.id)}
                      disabled={remove.isPending}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="card rise">
              <h2>Chưa có thông báo</h2>
              <p className="muted">Nhắc nợ và kết quả chia tiền cầu sẽ hiện ở đây.</p>
            </section>
          )
        }
      </QueryState>
    </>
  );
}
