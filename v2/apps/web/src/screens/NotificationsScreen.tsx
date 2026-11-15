import { useMarkNotificationsRead, useNotifications } from "../hooks/useMemberData";
import { formatDate } from "../lib/format";
import { QueryState } from "./QueryState";

export function NotificationsScreen() {
  const query = useNotifications();
  const markRead = useMarkNotificationsRead();
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
                {unread > 0 && (
                  <button
                    className="btn btn-ghost btn-small"
                    onClick={() => markRead.mutate()}
                    disabled={markRead.isPending}
                  >
                    {markRead.isPending ? "Đang lưu…" : "Đánh dấu đã đọc"}
                  </button>
                )}
              </div>
              {markRead.isError && (
                <p className="error" role="alert">
                  {markRead.error.message}
                </p>
              )}
              <ul className="rows">
                {items.map((item) => (
                  <li className={`row notice-row${item.read ? "" : " unread"}`} key={item.id}>
                    <div>
                      <div className="row-title">{item.title}</div>
                      {item.body && <div className="row-sub">{item.body}</div>}
                    </div>
                    <div className="row-sub row-end">{formatDate(item.createdAt)}</div>
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
