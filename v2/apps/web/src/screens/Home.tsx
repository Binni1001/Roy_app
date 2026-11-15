import { Link } from "@tanstack/react-router";
import type { Bootstrap } from "@roy/shared";
import { useSchedule, useWallet } from "../hooks/useMemberData";
import { formatDate, formatMoney, formatWeekday, isTodayOrLater } from "../lib/format";
import { openDayNote } from "./Schedule";

function WalletCard() {
  const { data, isPending, isError } = useWallet();
  return (
    <Link to="/vi" className="card card-link rise d1">
      <h2>Ví</h2>
      {isPending && <div className="skeleton short" />}
      {isError && <p className="muted">Không tải được ví. Chạm để thử lại.</p>}
      {data && (
        <>
          <p className="big gold">{formatMoney(data.unpaidTotal)}</p>
          <p className="muted">
            {data.unpaidDebts.length
              ? `Cần đóng · ${data.unpaidDebts.length} khoản`
              : "Không còn khoản nào cần đóng"}
          </p>
        </>
      )}
    </Link>
  );
}

function ScheduleCard() {
  const { data, isPending, isError } = useSchedule();
  const next = data?.openDays.find((day) => isTodayOrLater(day.date));
  return (
    <Link to="/lich" className="card card-link rise d2">
      <h2>Lịch</h2>
      {isPending && <div className="skeleton short" />}
      {isError && <p className="muted">Không tải được lịch. Chạm để thử lại.</p>}
      {data &&
        (next ? (
          <>
            <p className="big">
              {formatWeekday(next.date)}, {formatDate(next.date)}
            </p>
            <p className="muted">{openDayNote(next)}</p>
          </>
        ) : (
          <>
            <p className="big">{data.playedSessions.length} buổi</p>
            <p className="muted">đã chơi trong kỳ này · chưa có buổi mở sắp tới</p>
          </>
        ))}
    </Link>
  );
}

export function Home({ bootstrap }: { bootstrap: Bootstrap }) {
  const { me, openPeriod, memberships } = bootstrap;

  if (!me) {
    return (
      <section className="card rise">
        <h1>Tạo hồ sơ người chơi</h1>
        <p className="muted">
          Tài khoản của bạn chưa gắn với hồ sơ nào trong câu lạc bộ. Nhờ quản trị viên thêm bạn bằng
          đúng email đang đăng nhập.
        </p>
      </section>
    );
  }

  const name = me.nickname || me.fullName;
  const pending = memberships.filter((m) => m.status === "pending");

  if (!me.activeGroupId) {
    return (
      <section className="card rise">
        <h1>Chào {name}</h1>
        <p className="muted">
          {pending.length
            ? `Yêu cầu vào ${pending[0].groupName} đang chờ quản trị viên duyệt.`
            : "Bạn chưa ở trong nhóm nào. Nhập mã mời của câu lạc bộ để tham gia."}
        </p>
      </section>
    );
  }

  return (
    <div className="home">
      <section className="hero rise">
        <p className="eyebrow">{openPeriod ? `${openPeriod.name} đang mở` : "Chưa có kỳ đang mở"}</p>
        <h1>Chào {name}</h1>
        {openPeriod && (
          <p className="muted">
            Kỳ này chạy từ {formatDate(openPeriod.startDate)} đến {formatDate(openPeriod.endDate)}.
          </p>
        )}
      </section>

      <div className="grid">
        <WalletCard />
        <ScheduleCard />
        <Link to="/dau-truong" className="card card-link rise d3">
          <h2>Đấu trường</h2>
          <p className="muted">Bảng xếp hạng và kèo của bạn sẽ hiện ở đây.</p>
        </Link>
      </div>
    </div>
  );
}
