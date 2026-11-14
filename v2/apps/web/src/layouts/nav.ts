import { CalendarDays, Home, Trophy, UserRound, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  to: "/" | "/lich" | "/dau-truong" | "/vi" | "/toi";
  label: string;
  icon: LucideIcon;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Nhà", icon: Home },
  { to: "/lich", label: "Lịch", icon: CalendarDays },
  { to: "/dau-truong", label: "Đấu trường", icon: Trophy },
  { to: "/vi", label: "Ví", icon: Wallet },
  { to: "/toi", label: "Tôi", icon: UserRound },
];
