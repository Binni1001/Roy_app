import type { OpenDay, Schedule as ScheduleData } from "@roy/shared";
import { useSchedule } from "../hooks/useMemberData";
import { formatDate, formatWeekday, isTodayOrLater } from "../lib/format";
import { QueryState } from "./QueryState";

export function openDayNote(day: OpenDay): string {
  if (day.mine) return "Bạn đã giữ chỗ";
  const left = day.capacity - day.registered;
  if (left <= 0) return `Đủ ${day.capacity} người`;
  if (day.status !== "open") return "Đã đóng đăng ký";
  return `Còn ${left} chỗ`;
}

function ScheduleView({ schedule }: { schedule: ScheduleData }) {
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
            {upcoming.map((day) => (
              <div className={`day${day.mine ? " joined" : ""}`} key={day.id}>
                <div className="day-sub">{formatWeekday(day.date)}</div>
                <div className="day-num">{formatDate(day.date)}</div>
                <div className="day-sub">{openDayNote(day)}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Chưa có buổi nào được mở trong {schedule.period.name}.</p>
        )}
        <p className="muted small">Giữ chỗ ngay trong app sẽ có ở bản cập nhật tới.</p>
      </section>

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
