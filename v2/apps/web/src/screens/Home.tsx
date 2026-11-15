import { Link } from "@tanstack/react-router";
import type { Bootstrap } from "@roy/shared";
import { useArena, useSchedule, useWallet } from "../hooks/useMemberData";
import { formatDate, formatMoney, formatWeekday, isTodayOrLater } from "../lib/format";
import { PendingCard } from "./Approvals";
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

function ArenaCard() {
  const { data, isPending, isError } = useArena();
  const board = data && (data.doubles.length >= data.singles.length ? data.doubles : data.singles);
  const me = board?.find((row) => row.id === data?.meId);
  const waiting = data?.myMatches.filter((match) => match.status === "pending" || match.status === "active").length ?? 0;
  return (
    <Link to="/dau-truong" className="card card-link rise d3">
      <h2>Đấu trường</h2>
      {isPending && <div className="skeleton short" />}
      {isError && <p className="muted">Không tải được đấu trường. Chạm để thử lại.</p>}
      {data && (
        <>
          <p className="big gold">{me ? `Hạng ${me.rank}` : "Chưa xếp hạng"}</p>
          <p className="muted">
            {waiting ? `${waiting} kèo đang chờ` : me ? `${me.wins} thắng · ${me.losses} thua` : "Đánh một trận để lên bảng"}
          </p>
        </>
      )}
    </Link>
  );
}

export function Home({ bootstrap }: { bootstrap: Bootstrap }) {
  const { me, openPeriod, memberships } = bootstrap;

  // Root chỉ vẽ trang chủ khi đã có hồ sơ và nhóm đang hoạt động.
  if (!me) return null;
  const name = me.nickname || me.fullName;
  const group = memberships.find((m) => m.groupId === me.activeGroupId);

  return (
    <div className="home">
      <section className="hero rise">
        <p className="eyebrow">
          {group ? `${group.groupName} · ` : ""}
          {openPeriod ? `${openPeriod.name} đang mở` : "Chưa có kỳ đang mở"}
        </p>
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
        <ArenaCard />
        <PendingCard />
      </div>
    </div>
  );
}
