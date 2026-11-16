import { Link } from "@tanstack/react-router";
import { useAdminMatches, useMoney, usePeriods, useShuttles } from "../hooks/useAdminData";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { usePendingMembers } from "../hooks/useMemberData";
import { formatDate, formatMoney } from "../lib/format";

const path = (to: string) => to as never;

function Tile({ to, title, value, note, tone, delay }: { to: string; title: string; value: string; note: string; tone?: "gold" | "warn" | "ok"; delay: number }) {
  return (
    <Link to={path(to)} className={`card card-link rise d${delay} admin-tile`}>
      <h2>{title}</h2>
      <p className={`big ${tone === "gold" ? "gold" : tone === "warn" ? "fee-unpaid" : tone === "ok" ? "fee-paid" : ""}`}>{value}</p>
      <p className="muted">{note}</p>
    </Link>
  );
}

/** Trang đầu của khu quản trị: những việc cần làm và tình hình kỳ đang mở. */
export function AdminHome() {
  const { role } = useBootstrapData();
  const owner = role === "owner";
  const pending = usePendingMembers(owner);
  const periods = usePeriods(owner);
  const money = useMoney(owner);
  const shuttles = useShuttles(owner);
  const matches = useAdminMatches(owner);

  if (!owner) {
    return (
      <section className="card rise">
        <h1>Quản trị</h1>
        <p className="muted">Chỉ owner của câu lạc bộ vào được khu quản trị.</p>
      </section>
    );
  }

  const open = periods.data?.find((p) => p.status === "open");
  const drafts = periods.data?.filter((p) => p.status === "draft").length ?? 0;
  const s = shuttles.data?.settlement;
  const openMatches = matches.data?.matches.filter((m) => m.status === "pending" || m.status === "active").length ?? 0;
  const loading = "…";

  return (
    <div className="home">
      <section className="hero rise">
        <p className="eyebrow">Khu quản trị</p>
        <h1>{open ? open.name : "Chưa có kỳ đang mở"}</h1>
        {open && (
          <p className="muted">
            {formatDate(open.startDate)} – {formatDate(open.endDate)} · {open.memberCount} người cố định
            {drafts ? ` · ${drafts} kỳ nháp` : ""}
          </p>
        )}
      </section>
      <div className="grid">
        <Tile
          to="/quan-tri/duyet"
          title="Chờ duyệt"
          value={pending.data ? `${pending.data.length} người` : loading}
          note={pending.data?.length ? "đang xin vào nhóm · chạm để duyệt" : "không có ai đang chờ"}
          tone={pending.data?.length ? "gold" : undefined}
          delay={1}
        />
        <Tile
          to="/quan-tri/cong-no"
          title="Công nợ chưa thu"
          value={money.data ? formatMoney(money.data.unpaidTotal) : loading}
          note={money.data ? `${money.data.unpaid.length} người còn nợ` : ""}
          tone={money.data?.unpaidTotal ? "warn" : "ok"}
          delay={1}
        />
        <Tile
          to="/quan-tri/cong-no"
          title="Quỹ kỳ"
          value={money.data ? formatMoney(money.data.fund.balance) : loading}
          note={money.data ? `thu ${formatMoney(money.data.fund.income)} · chi ${formatMoney(money.data.fund.expense)}` : ""}
          delay={2}
        />
        <Tile
          to="/quan-tri/tien-cau"
          title="Tiền cầu"
          value={s ? (s.settled ? "Đã chốt" : s.canSettle ? "Chốt được" : "Chưa chốt được") : loading}
          note={s ? (s.settled ? "kỳ này đã chia tiền cầu" : s.blocking.length ? `còn ${s.blocking.length} khoản phải thu trước` : `quỹ còn ${formatMoney(s.fundBalance)}`) : ""}
          tone={s?.settled ? "ok" : s?.canSettle ? "gold" : undefined}
          delay={2}
        />
        <Tile
          to="/quan-tri/keo"
          title="Kèo đang mở"
          value={matches.data ? String(openMatches) : loading}
          note="chờ nhận hoặc chờ ghi tỷ số"
          delay={3}
        />
        <Tile
          to={open ? `/quan-tri/bao-cao/${open.id}` : "/quan-tri/ky-quy"}
          title="Báo cáo kỳ"
          value={open ? open.name : "—"}
          note="phải thu, đã thu, quỹ, tiền cầu · in được"
          delay={3}
        />
      </div>
    </div>
  );
}
