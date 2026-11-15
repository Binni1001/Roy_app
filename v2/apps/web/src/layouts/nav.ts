import { CalendarDays, Home, Medal, Trophy, UserRound, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: "/" | "/lich" | "/dau-truong" | "/giai-dau" | "/vi" | "/toi";
  label: string;
  icon: LucideIcon;
  /** Chỉ hiện trên thanh điều hướng của web; trên app mục này mở từ màn hình khác. */
  webOnly?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Nhà", icon: Home },
  { to: "/lich", label: "Lịch", icon: CalendarDays },
  { to: "/dau-truong", label: "Đấu trường", icon: Trophy },
  { to: "/giai-dau", label: "Giải đấu", icon: Medal, webOnly: true },
  { to: "/vi", label: "Ví", icon: Wallet },
  { to: "/toi", label: "Tôi", icon: UserRound },
];
