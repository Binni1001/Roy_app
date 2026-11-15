import { createContext, useContext } from "react";
import type { Bootstrap } from "@roy/shared";

export const BootstrapContext = createContext<Bootstrap | null>(null);

/** Dữ liệu /bootstrap đã tải ở Root; chỉ dùng bên trong app đã đăng nhập. */
export function useBootstrapData(): Bootstrap {
  const value = useContext(BootstrapContext);
  if (!value) throw new Error("Bootstrap data is not loaded");
  return value;
}
