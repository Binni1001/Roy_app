import type { OpenDay, Schedule as ScheduleData } from "@roy/shared";
import { useOpenDayAction, useSchedule } from "../hooks/useMemberData";
import { formatDate, formatWeekday, isTodayOrLater } from "../lib/format";
import { AvailabilityCard } from "./AvailabilityCard";
import { QueryState } from "./QueryState";

export function openDayNote(day: OpenDay): string {
  if (day.mine) return "Bạn đã giữ chỗ";
  const left = day.capacity - day.registered;
  if (left <= 0) return `Đủ ${day.capacity} người`;
  if (day.status !== "open") return "Đã đóng đăng ký";
  return `Còn ${left} chỗ`;
}

/** Thao tác thành viên có thể làm với một buổi; null khi không còn gì để làm. */
export function openDayAction(day: OpenDay): "join" | "leave" | null {
  if (day.mine) return "leave";
  if (day.status === "open" && day.registered < day.capacity) return "join";
  return null;
}

function ScheduleView({ schedule }: { schedule: ScheduleData }) {
  const change = useOpenDayAction();

  if (!schedule.period) {
    return (
      <section className="card rise">
        <h2>Chưa có kỳ đang mở</h2>
        <p className="muted">Lịch sẽ hiện khi quản trị viên mở kỳ mới.</p>
      </section>
    );
  }
  const upcoming = schedule.openDays.filter((day) => isTodayOrLater(day.date));

  return (
    <div className="stack">
      <section className="card rise">
        <h2>Buổi tự đăng ký sắp tới</h2>
        {upcoming.length ? (
          <div className="days">
            {upcoming.map((day) => {
              const action = openDayAction(day);
              const busy = change.isPending && change.variables?.dayId === day.id;
              return (
                <div className={`day${day.mine ? " joined" : ""}`} key={day.id}>
                  <div className="day-sub">{formatWeekday(day.date)}</div>
                  <div className="day-num">{formatDate(day.date)}</div>
                  <div className="day-sub">{openDayNote(day)}</div>
                  {action && (
                    <button
                      className={`btn btn-small ${action === "join" ? "btn-gold" : "btn-dark"}`}
                      onClick={() => change.mutate({ dayId: day.id, action })}
                      disabled={change.isPending}
                    >
                      {busy ? "Đang lưu…" : action === "join" ? "Giữ chỗ" : "Hủy chỗ"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">Chưa có buổi nào được mở trong {schedule.period.name}.</p>
        )}
        {change.isError && (
          <p className="error" role="alert">
            {change.error.message}
          </p>
        )}
        <p className="muted small">Giữ chỗ và hủy chỗ trước 17:30 ngày chơi. Giờ chơi 17:30 đến 19:30.</p>
      </section>

      <AvailabilityCard />

      <section className="card rise d1">
        <h2>Buổi đã chơi · {schedule.playedSessions.length}</h2>
        {schedule.playedSessions.length ? (
          <ul className="rows">
            {schedule.playedSessions.map((session) => (
              <li className="row" key={session.id}>
                <div>
                  <div className="row-title">
                    {formatWeekday(session.date)}, {formatDate(session.date)}
                  </div>
                  {session.note && <div className="row-sub">{session.note}</div>}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Kỳ này chưa ghi buổi nào.</p>
        )}
      </section>
    </div>
  );
}

export function Schedule() {
  const query = useSchedule();
  return (
    <>
      <h1 className="page-title">Lịch đánh</h1>
      <QueryState query={query}>{(schedule) => <ScheduleView schedule={schedule} />}</QueryState>
    </>
  );
}
