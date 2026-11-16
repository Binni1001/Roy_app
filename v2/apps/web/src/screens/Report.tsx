import { Link, useParams } from "@tanstack/react-router";
import type { PeriodReport } from "@roy/shared";
import { useReport } from "../hooks/useAdminData";
import { debtLabel, formatDate, formatMoney } from "../lib/format";
import { QueryState } from "./QueryState";

function ReportView({ report }: { report: PeriodReport }) {
  const { period, fund, shuttles, settlement } = report;
  const charged = report.debts.reduce((a, d) => a + d.total, 0);
  const collected = report.debts.reduce((a, d) => a + d.paid, 0);
  const outstanding = report.debts.reduce((a, d) => a + d.unpaid, 0);

  return (
    <article className="report stack">
      <section className="card">
        <p className="eyebrow">Báo cáo kỳ</p>
        <h2>{period.name}</h2>
        <p className="row-sub">
          {formatDate(period.startDate)} – {formatDate(period.endDate)} · {period.status === "closed" ? "đã đóng" : period.status === "open" ? "đang mở" : "bản nháp"} ·{" "}
          {report.fixedCount} thành viên cố định · {report.sessionCount} buổi đã ghi · {report.guestCount} lượt khách
        </p>
        <div className="kpis">
          <div>
            <span className="muted small">Phải thu</span>
            <strong>{formatMoney(charged)}</strong>
          </div>
          <div>
            <span className="muted small">Đã thu</span>
            <strong>{formatMoney(collected)}</strong>
          </div>
          <div>
            <span className="muted small">Còn nợ</span>
            <strong className={outstanding ? "fee-unpaid" : ""}>{formatMoney(outstanding)}</strong>
          </div>
          <div>
            <span className="muted small">Quỹ cuối kỳ</span>
            <strong>{formatMoney(fund.balance)}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Thu theo loại</h3>
        <div className="table-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th>Loại</th>
                <th>Số khoản</th>
                <th>Phải thu</th>
                <th>Đã thu</th>
                <th>Còn nợ</th>
              </tr>
            </thead>
            <tbody>
              {report.debts.map((d) => (
                <tr key={d.type}>
                  <td className="row-title">{debtLabel(d.type)}</td>
                  <td>{d.count}</td>
                  <td>{formatMoney(d.total)}</td>
                  <td>{formatMoney(d.paid)}</td>
                  <td>{formatMoney(d.unpaid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {report.cancelledTotal > 0 && <p className="muted small">Đã hủy {formatMoney(report.cancelledTotal)} (không tính vào phải thu).</p>}
      </section>

      <section className="card">
        <h3>Quỹ</h3>
        <p>
          Thu {formatMoney(fund.income)} · chi {formatMoney(fund.expense)} · hoàn {formatMoney(fund.refund)}
          {fund.adjustment ? ` · điều chỉnh ${formatMoney(fund.adjustment)}` : ""} → còn <strong>{formatMoney(fund.balance)}</strong>
        </p>
        <h3>Tiền cầu</h3>
        <p>
          {shuttles.purchases} lần mua · {shuttles.shuttles} quả · thành viên tự bỏ {formatMoney(shuttles.personalAmount)}
        </p>
        <p className="muted">
          {settlement.settled
            ? `Đã chốt: ${settlement.positive.count} người được cộng ${formatMoney(settlement.positive.total)}, ${settlement.negative.count} người phải nộp ${formatMoney(settlement.negative.total)}.`
            : "Chưa chốt chia tiền cầu."}
        </p>
      </section>

      {report.unpaid.length > 0 && (
        <section className="card">
          <h3>Còn nợ trong kỳ</h3>
          <ul className="rows">
            {report.unpaid.map((p) => (
              <li className="row" key={p.personId}>
                <div className="grow">
                  <div className="row-title">{p.name}</div>
                  <div className="row-sub">{p.debts.map((d) => debtLabel(d.type)).join(", ")}</div>
                </div>
                <div className="row-amount">{formatMoney(p.total)}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export function Report() {
  const { id } = useParams({ strict: false }) as { id: string };
  const query = useReport(id);
  return (
    <>
      <div className="card-head no-print">
        <Link to="/quan-tri/ky-quy" className="back">
          ← Kỳ quỹ
        </Link>
        <button className="btn btn-ghost btn-small" onClick={() => window.print()}>
          In báo cáo
        </button>
      </div>
      <QueryState query={query}>{(report) => <ReportView report={report} />}</QueryState>
    </>
  );
}
