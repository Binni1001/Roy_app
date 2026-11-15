const money = new Intl.NumberFormat("vi-VN");
const dayMonth = new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit" });
const weekday = new Intl.DateTimeFormat("vi-VN", { weekday: "short" });

export function formatMoney(amount: number): string {
  return `${money.format(Math.round(amount))}đ`;
}

/** Ngày dạng YYYY-MM-DD được hiểu theo giờ địa phương, không lệch múi giờ. */
function parseDate(value: string): Date {
  return new Date(value.length === 10 ? `${value}T00:00:00` : value);
}

export function formatDate(value: string): string {
  return dayMonth.format(parseDate(value));
}

export function formatWeekday(value: string): string {
  return weekday.format(parseDate(value));
}

export function isTodayOrLater(value: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseDate(value) >= today;
}

const DEBT_LABELS: Record<string, string> = {
  monthly_fee: "Phí cố định",
  guest_fee: "Phí khách",
  shuttle_extra: "Tiền cầu",
  other: "Khoản khác",
};

export function debtLabel(type: string): string {
  return DEBT_LABELS[type] ?? "Khoản khác";
}

const TRANSACTION_LABELS: Record<string, string> = {
  credit_from_shuttle_purchase: "Ứng tiền mua cầu",
  offset_next_period: "Bù vào công nợ",
  withdraw: "Rút số dư",
};

export function transactionLabel(type: string): string {
  return TRANSACTION_LABELS[type] ?? "Giao dịch số dư";
}
