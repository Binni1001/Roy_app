import { CalendarRange, LayoutDashboard, Swords, Users, Wallet, type LucideIcon } from "lucide-react";

export const ADMIN_ROOT = "/quan-tri";

export interface AdminTab {
  to: string;
  label: string;
}

export interface AdminSection {
  /** Trang mở khi bấm vào mục. */
  to: string;
  label: string;
  icon: LucideIcon;
  /** Tab con trong mục; trang con (chi tiết giải, báo cáo kỳ) cũng tính là của mục này. */
  tabs: AdminTab[];
  /** Tiền tố đường dẫn thuộc mục này. */
  match: string[];
}

/** Khu quản trị chia 5 mục, mỗi mục có tab con. Dùng cho cả thanh trên (web) và thanh đáy (app). */
export const ADMIN_NAV: AdminSection[] = [
  { to: ADMIN_ROOT, label: "Tổng quan", icon: LayoutDashboard, tabs: [], match: [] },
  {
    to: "/quan-tri/nhan-su",
    label: "Người",
    icon: Users,
    tabs: [
      { to: "/quan-tri/nhan-su", label: "Nhân sự" },
      { to: "/quan-tri/duyet", label: "Duyệt thành viên" },
    ],
    match: ["/quan-tri/nhan-su", "/quan-tri/duyet"],
  },
  {
    to: "/quan-tri/ky-quy",
    label: "Kỳ & lịch",
    icon: CalendarRange,
    tabs: [
      { to: "/quan-tri/ky-quy", label: "Kỳ quỹ" },
      { to: "/quan-tri/lich", label: "Lịch & điểm danh" },
    ],
    match: ["/quan-tri/ky-quy", "/quan-tri/lich", "/quan-tri/bao-cao"],
  },
  {
    to: "/quan-tri/cong-no",
    label: "Tiền",
    icon: Wallet,
    tabs: [
      { to: "/quan-tri/cong-no", label: "Công nợ & sổ quỹ" },
      { to: "/quan-tri/tien-cau", label: "Tiền cầu & chốt kỳ" },
    ],
    match: ["/quan-tri/cong-no", "/quan-tri/tien-cau"],
  },
  {
    to: "/quan-tri/keo",
    label: "Thi đấu",
    icon: Swords,
    tabs: [
      { to: "/quan-tri/keo", label: "Kèo" },
      { to: "/quan-tri/giai", label: "Giải đấu" },
    ],
    match: ["/quan-tri/keo", "/quan-tri/giai"],
  },
];

export const isAdminPath = (path: string) => path === ADMIN_ROOT || path.startsWith(ADMIN_ROOT + "/");

/** Mục quản trị đang mở theo đường dẫn. */
export function currentSection(path: string): AdminSection | undefined {
  if (path === ADMIN_ROOT || path === ADMIN_ROOT + "/") return ADMIN_NAV[0];
  return ADMIN_NAV.find((section) => section.match.some((prefix) => path === prefix || path.startsWith(prefix + "/")));
}
