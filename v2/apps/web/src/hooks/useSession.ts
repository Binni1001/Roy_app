import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

/**
 * undefined = đang kiểm tra, null = chưa đăng nhập.
 * Chỉ đổi state khi người dùng thật sự đổi, để việc làm mới token không vẽ lại cả app.
 */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    const apply = (next: Session | null) => {
      if (!mounted) return;
      setSession((prev) => (prev && next && prev.user.id === next.user.id ? prev : next));
    };

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => apply(null));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => apply(next));

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return session;
}
