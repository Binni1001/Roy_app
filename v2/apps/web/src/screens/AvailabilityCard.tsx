import { useEffect, useMemo, useState } from "react";
import type { Availability, DayOverride, IsoWeekday } from "@roy/shared";
import { useAvailability, useSaveAvailability } from "../hooks/useMemberData";
import { formatDate, formatWeekday } from "../lib/format";

const WEEKDAY_LABELS: Record<IsoWeekday, string> = { 1: "T2", 2: "T3", 3: "T4", 4: "T5", 5: "T6", 6: "T7", 7: "CN" };

const weekdayOf = (date: string) => (new Date(`${date}T00:00:00Z`).getUTCDay() || 7) as IsoWeekday;
const todayVn = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());

interface Draft {
  busyWeekdays: IsoWeekday[];
  dateOverrides: Record<string, DayOverride>;
}

const toDraft = (data: Availability): Draft => ({
  busyWeekdays: [...data.busyWeekdays],
  dateOverrides: { ...data.dateOverrides },
});

/** Ngày đó bận hay không: ngoại lệ theo ngày thắng lịch bận thường lệ theo thứ. */
function isBusy(date: string, draft: Draft): boolean {
  const override = draft.dateOverrides[date];
  if (override) return override === "busy";
  return draft.busyWeekdays.includes(weekdayOf(date));
}

function Editor({ data }: { data: Availability }) {
  const save = useSaveAvailability();
  const [draft, setDraft] = useState(() => toDraft(data));
  const [saved, setSaved] = useState(false);

  // Máy chủ trả bản mới (sau khi lưu hoặc tải lại vì xung đột): đồng bộ lại.
  useEffect(() => setDraft(toDraft(data)), [data]);

  const changed = useMemo(() => JSON.stringify(draft) !== JSON.stringify(toDraft(data)), [draft, data]);
  const today = todayVn();
  const upcoming = data.playDates.filter((date) => date >= today);
  const busyCount = upcoming.filter((date) => isBusy(date, draft)).length;

  function touch(next: Draft) {
    setSaved(false);
    save.reset();
    setDraft(next);
  }

  function toggleWeekday(day: IsoWeekday) {
    const busyWeekdays = draft.busyWeekdays.includes(day)
      ? draft.busyWeekdays.filter((d) => d !== day)
      : [...draft.busyWeekdays, day].sort((a, b) => a - b);
    // Đổi lịch thường lệ thì bỏ các ngoại lệ đã trùng với lịch mới, để dữ liệu gọn.
    const dateOverrides = Object.fromEntries(
      Object.entries(draft.dateOverrides).filter(
        ([date, state]) => (state === "busy") !== busyWeekdays.includes(weekdayOf(date)),
      ),
    ) as Record<string, DayOverride>;
    touch({ busyWeekdays, dateOverrides });
  }

  function toggleDate(date: string) {
    const nowBusy = !isBusy(date, draft);
    const routineBusy = draft.busyWeekdays.includes(weekdayOf(date));
    const dateOverrides = { ...draft.dateOverrides };
    if (nowBusy === routineBusy) delete dateOverrides[date];
    else dateOverrides[date] = nowBusy ? "busy" : "available";
    touch({ ...draft, dateOverrides });
  }

  function submit() {
    save.mutate(
      { expectedRevision: data.revision, busyWeekdays: draft.busyWeekdays, dateOverrides: draft.dateOverrides },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <>
      <p className="muted small">Chọn thứ bạn thường bận, rồi chạm từng ngày để đổi riêng ngày đó. Ban quản trị dùng lịch này để xếp 4 buổi mỗi tuần.</p>

      <div className="weekday-toggles" role="group" aria-label="Thứ thường bận">
        {data.playingWeekdays.map((day) => (
          <button
            key={day}
            type="button"
            className={draft.busyWeekdays.includes(day) ? "on" : ""}
            aria-pressed={draft.busyWeekdays.includes(day)}
            disabled={!data.editable}
            onClick={() => toggleWeekday(day)}
          >
            {WEEKDAY_LABELS[day]}
          </button>
        ))}
      </div>

      {upcoming.length ? (
        <>
          <p className="muted small">
            {busyCount ? `Bận ${busyCount} trên ${upcoming.length} ngày còn lại của kỳ.` : `Rảnh cả ${upcoming.length} ngày còn lại của kỳ.`}
          </p>
          <div className="date-grid">
            {upcoming.map((date) => {
              const busy = isBusy(date, draft);
              return (
                <button
                  key={date}
                  type="button"
                  className={`date-chip${busy ? " busy" : ""}${draft.dateOverrides[date] ? " custom" : ""}`}
                  aria-pressed={busy}
                  aria-label={`${formatWeekday(date)} ${formatDate(date)}: ${busy ? "bận" : "rảnh"}`}
                  disabled={!data.editable}
                  onClick={() => toggleDate(date)}
                >
                  <span className="date-chip-day">{formatWeekday(date)}</span>
                  <span className="date-chip-num">{formatDate(date)}</span>
                  <span className="date-chip-state">{busy ? "Bận" : "Rảnh"}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <p className="muted">Kỳ này không còn ngày chơi cố định nào phía trước.</p>
      )}

      {save.isError && (
        <p className="error" role="alert">
          {save.error.message}
        </p>
      )}
      {saved && !changed && (
        <p className="ok" role="status">
          Đã lưu lịch bận.
        </p>
      )}
      {changed && data.editable && (
        <div className="actions">
          <button className="btn btn-gold" onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Đang lưu…" : "Lưu lịch bận"}
          </button>
          <button className="btn btn-ghost" onClick={() => touch(toDraft(data))} disabled={save.isPending}>
            Bỏ thay đổi
          </button>
        </div>
      )}
    </>
  );
}

/** Thẻ "Lịch bận của tôi" trong màn hình Lịch. Ẩn với người không khai được (khách, quản trị). */
export function AvailabilityCard() {
  const { data, isPending, isError, error, refetch } = useAvailability();
  if (isPending) return null;
  if (isError) {
    return (
      <section className="card rise d2" role="alert">
        <h2>Lịch bận của tôi</h2>
        <p className="muted">{error.message}</p>
        <button className="btn btn-ghost" onClick={() => void refetch()}>
          Thử lại
        </button>
      </section>
    );
  }
  if (!data.eligible || !data.period) return null;
  return (
    <section className="card rise d2">
      <h2>Lịch bận của tôi · {data.period.name}</h2>
      <Editor data={data} />
    </section>
  );
}
