import type { Bootstrap } from "@roy/shared";

const dateFormat = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });

function formatRange(start: string, end: string) {
  return `${dateFormat.format(new Date(start))} – ${dateFormat.format(new Date(end))}`;
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

  return (
    <div className="home">
      <section className="hero rise">
        <p className="eyebrow">{openPeriod ? `${openPeriod.name} đang mở` : "Chưa có kỳ đang mở"}</p>
        <h1>Chào {name}</h1>
        {openPeriod && (
          <p className="muted">Kỳ này chạy từ {formatRange(openPeriod.startDate, openPeriod.endDate)}.</p>
        )}
      </section>

      {!me.activeGroupId && (
        <section className="card rise">
          <h2>Bạn chưa ở trong nhóm nào</h2>
          <p className="muted">
            {pending.length
              ? `Yêu cầu vào ${pending[0].groupName} đang chờ quản trị viên duyệt.`
              : "Nhập mã mời của câu lạc bộ để tham gia."}
          </p>
        </section>
      )}

      <div className="grid">
        <section className="card rise d1">
          <h2>Ví</h2>
          <p className="muted">Khoản cần đóng và mã QR trả gộp sẽ hiện ở đây.</p>
        </section>
        <section className="card rise d2">
          <h2>Lịch tuần này</h2>
          <p className="muted">Giữ chỗ và xem ai ra sân sẽ hiện ở đây.</p>
        </section>
        <section className="card rise d3">
          <h2>Đấu trường</h2>
          <p className="muted">Bảng xếp hạng và kèo của bạn sẽ hiện ở đây.</p>
        </section>
      </div>
    </div>
  );
}
